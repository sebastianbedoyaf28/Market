-- ============================================
-- FIX RELATIONSHIP BETWEEN SALES AND PRODUCTS
-- ============================================
-- Este script corrige la relación entre sales e inventory_products

-- ============================================
-- 1. Verificar estructura actual de las tablas
-- ============================================

-- Verificar que la tabla sales existe y tiene la estructura correcta
SELECT 
    'Estructura de tabla sales:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'sales'
ORDER BY ordinal_position;

-- Verificar que la tabla inventory_products existe
SELECT 
    'Estructura de tabla inventory_products:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'inventory_products'
ORDER BY ordinal_position;

-- ============================================
-- 2. Verificar la relación (foreign key) entre sales e inventory_products
-- ============================================

-- Verificar constraints de foreign key
SELECT 
    'Foreign Keys en tabla sales:' as info,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'sales'
    AND kcu.column_name = 'product_id';

-- ============================================
-- 3. Crear la relación si no existe
-- ============================================

-- Agregar foreign key constraint si no existe
DO $$
BEGIN
    -- Verificar si ya existe la constraint
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'sales_product_id_fkey'
        AND table_name = 'sales'
    ) THEN
        -- Crear la foreign key constraint
        ALTER TABLE public.sales 
        ADD CONSTRAINT sales_product_id_fkey 
        FOREIGN KEY (product_id) 
        REFERENCES public.inventory_products(id) 
        ON DELETE RESTRICT;
        
        RAISE NOTICE 'Foreign key constraint creada: sales_product_id_fkey';
    ELSE
        RAISE NOTICE 'Foreign key constraint ya existe: sales_product_id_fkey';
    END IF;
END $$;

-- ============================================
-- 4. Verificar que los datos son consistentes
-- ============================================

-- Verificar si hay sales con product_id que no existen en inventory_products
SELECT 
    'Sales con product_id inválido:' as info,
    COUNT(*) as count_invalid
FROM public.sales s
LEFT JOIN public.inventory_products ip ON s.product_id = ip.id
WHERE ip.id IS NULL;

-- Mostrar ejemplos de sales con product_id inválido (si los hay)
SELECT 
    'Ejemplos de sales con product_id inválido:' as info,
    s.id,
    s.product_id,
    s.quantity,
    s.total_price
FROM public.sales s
LEFT JOIN public.inventory_products ip ON s.product_id = ip.id
WHERE ip.id IS NULL
LIMIT 5;

-- ============================================
-- 5. Verificar que hay productos en inventory_products
-- ============================================

-- Contar productos disponibles
SELECT 
    'Productos en inventory_products:' as info,
    COUNT(*) as total_productos,
    COUNT(CASE WHEN total_stock > 0 THEN 1 END) as con_stock,
    COUNT(CASE WHEN sale_price > 0 THEN 1 END) as con_precio
FROM public.inventory_products;

-- Mostrar algunos productos de ejemplo
SELECT 
    'Productos de ejemplo:' as info,
    id,
    name,
    sku,
    sale_price,
    total_stock,
    category
FROM public.inventory_products
WHERE sale_price > 0
ORDER BY name
LIMIT 10;

-- ============================================
-- 6. Verificar que hay ventas en la tabla sales
-- ============================================

-- Contar ventas
SELECT 
    'Ventas en tabla sales:' as info,
    COUNT(*) as total_ventas,
    COUNT(CASE WHEN import_source = 'pos_system' THEN 1 END) as ventas_pos,
    COUNT(CASE WHEN import_source = 'manual' THEN 1 END) as ventas_manual
FROM public.sales;

-- Mostrar algunas ventas de ejemplo
SELECT 
    'Ventas de ejemplo:' as info,
    s.id,
    s.product_id,
    s.quantity,
    s.unit_price,
    s.total_price,
    s.import_source,
    ip.name as product_name
FROM public.sales s
LEFT JOIN public.inventory_products ip ON s.product_id = ip.id
ORDER BY s.created_at DESC
LIMIT 5;

-- ============================================
-- 7. Crear índices para optimizar las consultas
-- ============================================

-- Índice en product_id de sales para mejorar JOINs
CREATE INDEX IF NOT EXISTS idx_sales_product_id 
ON public.sales(product_id);

-- Índice en id de inventory_products (ya debería existir como PRIMARY KEY)
-- Pero verificamos que existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'inventory_products' 
        AND indexname = 'inventory_products_pkey'
    ) THEN
        RAISE NOTICE 'Primary key en inventory_products no encontrada - esto es un problema';
    ELSE
        RAISE NOTICE 'Primary key en inventory_products existe correctamente';
    END IF;
END $$;

-- ============================================
-- 8. Verificar políticas RLS
-- ============================================

-- Verificar políticas RLS en sales
SELECT 
    'Políticas RLS en sales:' as info,
    policyname,
    permissive,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'sales'
ORDER BY policyname;

-- Verificar políticas RLS en inventory_products
SELECT 
    'Políticas RLS en inventory_products:' as info,
    policyname,
    permissive,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'inventory_products'
ORDER BY policyname;

-- ============================================
-- 9. Test de la relación
-- ============================================

-- Probar una consulta JOIN para verificar que la relación funciona
SELECT 
    'Test de relación sales-inventory_products:' as info,
    s.id as sale_id,
    s.quantity,
    s.total_price,
    ip.name as product_name,
    ip.sku,
    ip.sale_price
FROM public.sales s
INNER JOIN public.inventory_products ip ON s.product_id = ip.id
LIMIT 5;

-- ============================================
-- ¡LISTO! Relación verificada y corregida
-- ============================================

/*
NOTAS IMPORTANTES:
1. Este script verifica y corrige la relación entre sales e inventory_products
2. Crea la foreign key constraint si no existe
3. Verifica la consistencia de los datos
4. Crea índices para optimizar las consultas
5. Verifica las políticas RLS

SIGUIENTE PASO:
- Ejecuta este script en Supabase
- Verifica que no hay errores
- Prueba el POS nuevamente
*/
