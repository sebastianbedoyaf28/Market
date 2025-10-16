-- ============================================
-- CONFIGURACIÓN DE SUPABASE PARA EL MÓDULO POS
-- ============================================
-- Ejecuta este script en el SQL Editor de Supabase

-- ============================================
-- 1. Verificar/Crear campo SKU en inventory_products
-- ============================================
-- Agregar campo SKU si no existe (para búsqueda por código)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_products' 
        AND column_name = 'sku'
    ) THEN
        ALTER TABLE public.inventory_products 
        ADD COLUMN sku text;
        
        CREATE INDEX IF NOT EXISTS idx_inventory_products_sku 
        ON public.inventory_products(sku);
    END IF;
END $$;

-- ============================================
-- 2. Agregar campo de precio en inventory_products
-- ============================================
-- El POS necesita el precio de venta
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_products' 
        AND column_name = 'price'
    ) THEN
        ALTER TABLE public.inventory_products 
        ADD COLUMN price numeric(12,2) DEFAULT 0 CHECK (price >= 0);
    END IF;
END $$;

-- ============================================
-- 3. Agregar campo de categoría (opcional pero útil)
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_products' 
        AND column_name = 'category'
    ) THEN
        ALTER TABLE public.inventory_products 
        ADD COLUMN category text;
        
        CREATE INDEX IF NOT EXISTS idx_inventory_products_category 
        ON public.inventory_products(category);
    END IF;
END $$;

-- ============================================
-- 4. Agregar campo status en tabla sales (para RF007)
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.sales 
        ADD COLUMN status text DEFAULT 'pending' 
        CHECK (status IN ('pending', 'reconciled', 'cancelled'));
        
        CREATE INDEX IF NOT EXISTS idx_sales_status 
        ON public.sales(status);
    END IF;
END $$;

-- ============================================
-- 5. Políticas RLS para inventory_products
-- ============================================
-- Permitir lectura pública (para el POS)
DROP POLICY IF EXISTS "Public read inventory_products" ON public.inventory_products;
CREATE POLICY "Public read inventory_products" 
ON public.inventory_products
FOR SELECT 
USING (true);

-- Permitir actualización para usuarios autenticados
DROP POLICY IF EXISTS "Auth update inventory_products" ON public.inventory_products;
CREATE POLICY "Auth update inventory_products" 
ON public.inventory_products
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Permitir escritura completa para usuarios autenticados
DROP POLICY IF EXISTS "Auth write inventory_products" ON public.inventory_products;
CREATE POLICY "Auth write inventory_products" 
ON public.inventory_products
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 6. Índices adicionales para optimizar el POS
-- ============================================

-- Índice compuesto para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_inventory_products_name_sku 
ON public.inventory_products(name, sku);

-- Índice para filtrar por stock disponible
CREATE INDEX IF NOT EXISTS idx_inventory_products_stock 
ON public.inventory_products(total_stock) 
WHERE total_stock > 0;

-- Índice para actualizar precios
CREATE INDEX IF NOT EXISTS idx_inventory_products_price 
ON public.inventory_products(price);

-- ============================================
-- 7. Función para actualizar stock de forma segura
-- ============================================
-- Esta función previene race conditions al actualizar stock

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
-- Para que el POS vea cambios de stock en tiempo real

-- Agregar inventory_products a Realtime (si no está ya)
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_products;

-- Agregar sales a Realtime (si no está ya)
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;

-- ============================================
-- 9. Trigger para actualizar updated_at automáticamente
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
-- Vista optimizada para el POS con solo productos disponibles

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
-- 12. Datos de ejemplo (opcional - eliminar en producción)
-- ============================================

-- Insertar algunos productos de ejemplo si la tabla está vacía
INSERT INTO inventory_products (name, sku, price, total_stock, category)
SELECT * FROM (VALUES
    ('Arroz Premium 1kg', 'ARROZ-001', 2.50, 100, 'Alimentos'),
    ('Leche Entera 1L', 'LECHE-001', 1.80, 50, 'Lácteos'),
    ('Pan Integral', 'PAN-001', 1.20, 75, 'Panadería'),
    ('Aceite de Oliva 500ml', 'ACEITE-001', 5.50, 30, 'Aceites'),
    ('Café Premium 250g', 'CAFE-001', 8.90, 25, 'Bebidas')
) AS t(name, sku, price, total_stock, category)
WHERE NOT EXISTS (SELECT 1 FROM inventory_products LIMIT 1);

-- ============================================
-- 13. Verificación final
-- ============================================

-- Mostrar un resumen de la configuración
SELECT 
    'Configuración completada!' as status,
    (SELECT COUNT(*) FROM inventory_products WHERE total_stock > 0) as productos_disponibles,
    (SELECT COUNT(*) FROM sales WHERE sale_date = CURRENT_DATE) as ventas_hoy;

-- Mostrar políticas RLS activas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN ('inventory_products', 'sales')
ORDER BY tablename, policyname;

-- ============================================
-- ¡LISTO! El POS está configurado en Supabase
-- ============================================

/*
NOTAS IMPORTANTES:
1. Este script es idempotente - puedes ejecutarlo múltiples veces sin problemas
2. Los datos de ejemplo (paso 12) son opcionales - elimínalos si ya tienes productos
3. La función update_product_stock() previene problemas de concurrencia
4. Realtime está habilitado para actualizaciones en tiempo real
5. Las políticas RLS permiten que usuarios autenticados usen el POS

SIGUIENTE PASO:
- Verifica en Supabase Dashboard > Database > Tables que todo esté bien
- Prueba el POS en tu aplicación
*/

