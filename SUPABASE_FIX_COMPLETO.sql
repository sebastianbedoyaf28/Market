-- ============================================
-- FIX COMPLETO PARA SUPABASE - MÓDULO POS
-- ============================================
-- Este script crea TODAS las tablas faltantes y configura el POS

-- ============================================
-- 1. Verificar/Crear tabla inventory_products
-- ============================================

CREATE TABLE IF NOT EXISTS public.inventory_products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  sku text,
  price numeric(12,2) DEFAULT 0 CHECK (price >= 0),
  total_stock integer DEFAULT 0 CHECK (total_stock >= 0),
  category text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 2. Verificar/Crear tabla sales (si no existe)
-- ============================================

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid REFERENCES public.inventory_products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  total_price numeric(12,2) NOT NULL CHECK (total_price >= 0),
  sale_date date NOT NULL,
  customer_name text,
  invoice_number text,
  import_source text DEFAULT 'manual' CHECK (import_source IN ('manual', 'csv_excel_import', 'pos_system')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled', 'cancelled')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 3. Habilitar RLS en las tablas
-- ============================================

ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. Políticas RLS para inventory_products
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
-- 5. Políticas RLS para sales
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
-- 6. Índices para optimizar el rendimiento
-- ============================================

-- Índices para inventory_products
CREATE INDEX IF NOT EXISTS idx_inventory_products_name ON public.inventory_products(name);
CREATE INDEX IF NOT EXISTS idx_inventory_products_sku ON public.inventory_products(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_products_category ON public.inventory_products(category);
CREATE INDEX IF NOT EXISTS idx_inventory_products_stock ON public.inventory_products(total_stock) WHERE total_stock > 0;
CREATE INDEX IF NOT EXISTS idx_inventory_products_name_sku ON public.inventory_products(name, sku);

-- Índices para sales
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON public.sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON public.sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_import_source ON public.sales(import_source);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);

-- ============================================
-- 7. Función para actualizar stock de forma segura
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
    SELECT total_stock INTO v_current_stock
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
    SET total_stock = total_stock - p_quantity_sold,
        updated_at = NOW()
    WHERE id = p_product_id;
    
    RETURN true;
END;
$$;

-- ============================================
-- 8. Habilitar Realtime para actualizaciones en tiempo real
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;

-- ============================================
-- 9. Triggers para actualizar timestamps automáticamente
-- ============================================

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger en inventory_products
DROP TRIGGER IF EXISTS update_inventory_products_updated_at ON public.inventory_products;
CREATE TRIGGER update_inventory_products_updated_at
    BEFORE UPDATE ON public.inventory_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger en sales
DROP TRIGGER IF EXISTS update_sales_updated_at ON public.sales;
CREATE TRIGGER update_sales_updated_at
    BEFORE UPDATE ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. Vista para productos disponibles en el POS
-- ============================================

CREATE OR REPLACE VIEW pos_available_products AS
SELECT 
    id,
    name,
    sku,
    price,
    total_stock as stock,
    category,
    updated_at
FROM inventory_products
WHERE total_stock > 0
    AND price > 0
ORDER BY name;

-- Permitir lectura de la vista
GRANT SELECT ON pos_available_products TO authenticated;
GRANT SELECT ON pos_available_products TO anon;

-- ============================================
-- 11. Función para obtener resumen de ventas del día
-- ============================================

CREATE OR REPLACE FUNCTION get_daily_sales_summary(sale_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
    total_sales bigint,
    total_amount numeric,
    total_items bigint,
    pos_sales bigint,
    imported_sales bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::bigint as total_sales,
        SUM(total_price)::numeric as total_amount,
        SUM(quantity)::bigint as total_items,
        COUNT(*) FILTER (WHERE import_source = 'pos_system')::bigint as pos_sales,
        COUNT(*) FILTER (WHERE import_source != 'pos_system')::bigint as imported_sales
    FROM sales
    WHERE sales.sale_date = get_daily_sales_summary.sale_date;
END;
$$;

-- ============================================
-- 12. Migrar productos de la tabla products a inventory_products
-- ============================================

-- Si tienes productos en la tabla 'products', los migramos a 'inventory_products'
INSERT INTO public.inventory_products (id, name, price, total_stock, category)
SELECT 
    id,
    name,
    price,
    100, -- Stock inicial por defecto
    'General' -- Categoría por defecto
FROM public.products
WHERE NOT EXISTS (
    SELECT 1 FROM public.inventory_products ip 
    WHERE ip.id = products.id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 13. Datos de ejemplo (solo si las tablas están vacías)
-- ============================================

-- Insertar algunos productos de ejemplo si no hay productos
INSERT INTO public.inventory_products (name, sku, price, total_stock, category)
SELECT * FROM (VALUES
    ('Arroz Premium 1kg', 'ARROZ-001', 2.50, 100, 'Alimentos'),
    ('Leche Entera 1L', 'LECHE-001', 1.80, 50, 'Lácteos'),
    ('Pan Integral', 'PAN-001', 1.20, 75, 'Panadería'),
    ('Aceite de Oliva 500ml', 'ACEITE-001', 5.50, 30, 'Aceites'),
    ('Café Premium 250g', 'CAFE-001', 8.90, 25, 'Bebidas'),
    ('Azúcar 1kg', 'AZUCAR-001', 1.50, 80, 'Alimentos'),
    ('Huevos (docena)', 'HUEVOS-001', 3.20, 60, 'Lácteos'),
    ('Aceite de Girasol 1L', 'ACEITE-002', 4.50, 40, 'Aceites')
) AS t(name, sku, price, total_stock, category)
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_products LIMIT 1);

-- ============================================
-- 14. Verificación final
-- ============================================

-- Mostrar un resumen de la configuración
SELECT 
    'Configuración completada!' as status,
    (SELECT COUNT(*) FROM public.inventory_products WHERE total_stock > 0) as productos_disponibles,
    (SELECT COUNT(*) FROM public.sales WHERE sale_date = CURRENT_DATE) as ventas_hoy,
    (SELECT COUNT(*) FROM public.products) as productos_originales,
    (SELECT COUNT(*) FROM public.inventory_products) as productos_inventario;

-- Mostrar productos disponibles para el POS
SELECT 
    'Productos disponibles en POS:' as info,
    name,
    sku,
    price,
    total_stock as stock,
    category
FROM public.inventory_products
WHERE total_stock > 0
ORDER BY name
LIMIT 10;

-- ============================================
-- ¡LISTO! El POS está completamente configurado
-- ============================================

/*
NOTAS IMPORTANTES:
1. Este script es completamente seguro y no elimina datos existentes
2. Migra automáticamente productos de 'products' a 'inventory_products'
3. Crea datos de ejemplo si no tienes productos
4. Configura todas las políticas de seguridad necesarias
5. Habilita Realtime para actualizaciones en tiempo real
6. Incluye funciones optimizadas para el POS

SIGUIENTE PASO:
- Verifica que no haya errores
- Abre tu aplicación y prueba el POS
- Los productos deberían aparecer automáticamente
*/
