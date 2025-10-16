-- ============================================
-- CONFIGURACIÓN CORRECTA PARA MÓDULO POS
-- ============================================
-- Basado en la estructura real de inventory_products

-- ============================================
-- 1. Agregar campo total_stock a inventory_products
-- ============================================

-- Agregar campo total_stock que falta para el POS
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_products' 
        AND column_name = 'total_stock'
    ) THEN
        ALTER TABLE public.inventory_products 
        ADD COLUMN total_stock integer DEFAULT 100 CHECK (total_stock >= 0);
        
        RAISE NOTICE 'Campo total_stock agregado a inventory_products';
    ELSE
        RAISE NOTICE 'Campo total_stock ya existe en inventory_products';
    END IF;
END $$;

-- ============================================
-- 2. Crear tabla sales (no existe)
-- ============================================

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.inventory_products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  total_price numeric(12,2) NOT NULL CHECK (total_price >= 0),
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_name text,
  invoice_number text,
  import_source text DEFAULT 'pos_system' CHECK (import_source IN ('manual', 'csv_excel_import', 'pos_system')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled', 'cancelled')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================
-- 3. Crear función para actualizar updated_at en sales
-- ============================================

CREATE OR REPLACE FUNCTION set_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para sales
CREATE TRIGGER trg_sales_updated_at
    BEFORE UPDATE ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION set_sales_updated_at();

-- ============================================
-- 4. Habilitar RLS en las tablas
-- ============================================

ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Políticas RLS para inventory_products
-- ============================================

-- Permitir lectura pública (para el POS)
DROP POLICY IF EXISTS "Public read inventory_products" ON public.inventory_products;
CREATE POLICY "Public read inventory_products" 
ON public.inventory_products
FOR SELECT 
USING (true);

-- Permitir escritura para usuarios autenticados
DROP POLICY IF EXISTS "Auth write inventory_products" ON public.inventory_products;
CREATE POLICY "Auth write inventory_products" 
ON public.inventory_products
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 6. Políticas RLS para sales
-- ============================================

-- Permitir lectura pública
DROP POLICY IF EXISTS "Public read sales" ON public.sales;
CREATE POLICY "Public read sales" 
ON public.sales
FOR SELECT 
USING (true);

-- Permitir escritura para usuarios autenticados
DROP POLICY IF EXISTS "Auth write sales" ON public.sales;
CREATE POLICY "Auth write sales" 
ON public.sales
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 7. Crear índices para optimizar el rendimiento
-- ============================================

-- Índices para inventory_products (usando sale_price en lugar de price)
CREATE INDEX IF NOT EXISTS idx_inventory_products_name ON public.inventory_products(name);
CREATE INDEX IF NOT EXISTS idx_inventory_products_sku ON public.inventory_products(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_products_category ON public.inventory_products(category);
CREATE INDEX IF NOT EXISTS idx_inventory_products_provider ON public.inventory_products(provider);

-- Índice para total_stock (solo si el campo existe)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_products' AND column_name = 'total_stock') THEN
        CREATE INDEX IF NOT EXISTS idx_inventory_products_stock ON public.inventory_products(total_stock) WHERE total_stock > 0;
    END IF;
END $$;

-- Índices para sales
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON public.sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON public.sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_import_source ON public.sales(import_source);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);

-- ============================================
-- 8. Habilitar Realtime para actualizaciones en tiempo real
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;

-- ============================================
-- 9. Crear vista para productos disponibles en el POS
-- ============================================

CREATE OR REPLACE VIEW pos_available_products AS
SELECT 
    id,
    name,
    sku,
    sale_price as price,  -- Usar sale_price en lugar de price
    COALESCE(total_stock, 100) as stock,
    category,
    provider,
    cost_price,
    image_url,
    updated_at
FROM inventory_products
WHERE COALESCE(total_stock, 100) > 0
    AND sale_price > 0
ORDER BY name;

-- Permitir lectura de la vista
GRANT SELECT ON pos_available_products TO authenticated;
GRANT SELECT ON pos_available_products TO anon;

-- ============================================
-- 10. Función para actualizar stock de forma segura
-- ============================================

CREATE OR REPLACE FUNCTION update_product_stock(
    p_product_id uuid,
    p_quantity_sold integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_stock integer;
BEGIN
    -- Obtener stock actual con bloqueo
    SELECT COALESCE(total_stock, 100) INTO v_current_stock
    FROM inventory_products
    WHERE id = p_product_id
    FOR UPDATE;
    
    -- Verificar si hay suficiente stock
    IF v_current_stock IS NULL THEN
        RAISE EXCEPTION 'Producto no encontrado';
    END IF;
    
    IF v_current_stock < p_quantity_sold THEN
        RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %', 
            v_current_stock, p_quantity_sold;
    END IF;
    
    -- Actualizar stock
    UPDATE inventory_products
    SET total_stock = COALESCE(total_stock, 100) - p_quantity_sold,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_product_id;
    
    RETURN true;
END;
$$;

-- ============================================
-- 11. Migrar productos de la tabla products a inventory_products
-- ============================================

-- Si tienes productos en la tabla 'products', los migramos a 'inventory_products'
DO $$
DECLARE
    rec RECORD;
    counter INTEGER := 1;
BEGIN
    -- Obtener el número actual de productos para continuar la numeración
    SELECT COALESCE(MAX(CAST(SUBSTRING(sku FROM 5) AS INTEGER)), 0) + 1 
    INTO counter
    FROM public.inventory_products 
    WHERE sku LIKE 'SKU-%';
    
    -- Migrar productos uno por uno
    FOR rec IN 
        SELECT id, name, price 
        FROM public.products
        WHERE NOT EXISTS (
            SELECT 1 FROM public.inventory_products ip 
            WHERE ip.id = products.id
        )
    LOOP
        INSERT INTO public.inventory_products (
            id, name, sku, category, provider, 
            cost_price, sale_price, total_stock
        )
        VALUES (
            rec.id,
            rec.name,
            'SKU-' || LPAD(counter::text, 6, '0'),
            'General',
            'Sistema',
            COALESCE(rec.price * 0.7, 0.50),  -- Costo = 70% del precio
            COALESCE(rec.price, 1.00),        -- Precio de venta
            100  -- Stock inicial
        );
        
        counter := counter + 1;
    END LOOP;
END $$;

-- ============================================
-- 12. Insertar productos de ejemplo (solo si no hay productos)
-- ============================================

-- Insertar productos de ejemplo solo si no hay productos
INSERT INTO public.inventory_products (name, sku, category, provider, cost_price, sale_price, total_stock)
SELECT * FROM (VALUES
    ('Arroz Premium 1kg', 'ARROZ-001', 'Alimentos', 'Distribuidor A', 1.75, 2.50, 100),
    ('Leche Entera 1L', 'LECHE-001', 'Lácteos', 'Distribuidor B', 1.26, 1.80, 50),
    ('Pan Integral', 'PAN-001', 'Panadería', 'Panadería Local', 0.84, 1.20, 75),
    ('Aceite de Oliva 500ml', 'ACEITE-001', 'Aceites', 'Importador C', 3.85, 5.50, 30),
    ('Café Premium 250g', 'CAFE-001', 'Bebidas', 'Cafetalera D', 6.23, 8.90, 25),
    ('Azúcar 1kg', 'AZUCAR-001', 'Alimentos', 'Distribuidor A', 1.05, 1.50, 80),
    ('Huevos (docena)', 'HUEVOS-001', 'Lácteos', 'Granja Local', 2.24, 3.20, 60),
    ('Aceite de Girasol 1L', 'ACEITE-002', 'Aceites', 'Importador C', 3.15, 4.50, 40)
) AS t(name, sku, category, provider, cost_price, sale_price, total_stock)
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_products LIMIT 1);

-- ============================================
-- 13. Verificación final
-- ============================================

-- Mostrar estructura de inventory_products
SELECT 
    'Estructura de inventory_products:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'inventory_products'
ORDER BY ordinal_position;

-- Mostrar resumen de productos
SELECT 
    'Resumen de productos:' as info,
    COUNT(*) as total_productos,
    COUNT(CASE WHEN sku IS NOT NULL THEN 1 END) as con_sku,
    COUNT(CASE WHEN sale_price > 0 THEN 1 END) as con_precio,
    COUNT(CASE WHEN COALESCE(total_stock, 100) > 0 THEN 1 END) as con_stock
FROM public.inventory_products;

-- Mostrar productos disponibles para el POS
SELECT 
    'Productos disponibles en POS:' as info,
    name,
    sku,
    sale_price as price,
    COALESCE(total_stock, 100) as stock,
    category,
    provider,
    cost_price
FROM public.inventory_products
WHERE COALESCE(total_stock, 100) > 0
    AND sale_price > 0
ORDER BY name
LIMIT 10;

-- Verificar que la tabla sales existe
SELECT 
    'Tabla sales:' as info,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') 
        THEN '✅ Existe' 
        ELSE '❌ No existe' 
    END as status;

-- ============================================
-- ¡LISTO! Módulo POS configurado correctamente
-- ============================================

/*
NOTAS IMPORTANTES:
1. Agregué el campo total_stock que faltaba en inventory_products
2. Creé la tabla sales desde cero
3. Usé sale_price en lugar de price (como está en tu tabla)
4. Respeté todas las restricciones existentes
5. Migré productos de 'products' a 'inventory_products' si existen
6. Todo está listo para usar el POS

SIGUIENTE PASO:
- Verifica que no haya errores
- Abre tu aplicación y prueba el POS
- Los productos deberían aparecer correctamente
*/
