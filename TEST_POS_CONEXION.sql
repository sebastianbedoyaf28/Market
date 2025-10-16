-- ============================================
-- SCRIPT DE PRUEBA PARA VERIFICAR CONEXIÓN POS
-- ============================================

-- 1. Verificar que la tabla inventory_products tiene datos
SELECT 
    'Productos en inventory_products:' as info,
    COUNT(*) as total_productos
FROM public.inventory_products;

-- 2. Verificar estructura de campos necesarios
SELECT 
    'Campos necesarios para POS:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'inventory_products'
    AND column_name IN ('id', 'name', 'sku', 'sale_price', 'total_stock', 'category')
ORDER BY column_name;

-- 3. Mostrar productos disponibles para el POS
SELECT 
    'Productos disponibles para POS:' as info,
    id,
    name,
    sku,
    sale_price,
    COALESCE(total_stock, 100) as total_stock,
    category,
    provider
FROM public.inventory_products
WHERE sale_price > 0
ORDER BY name
LIMIT 10;

-- 4. Verificar que la tabla sales existe
SELECT 
    'Tabla sales:' as info,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') 
        THEN '✅ Existe' 
        ELSE '❌ No existe' 
    END as status;

-- 5. Contar productos con stock > 0
SELECT 
    'Productos con stock disponible:' as info,
    COUNT(*) as productos_con_stock
FROM public.inventory_products
WHERE COALESCE(total_stock, 100) > 0
    AND sale_price > 0;

-- 6. Verificar políticas RLS
SELECT 
    'Políticas RLS para inventory_products:' as info,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE tablename = 'inventory_products'
ORDER BY policyname;

-- ============================================
-- RESULTADO ESPERADO:
-- ✅ Total productos > 0
-- ✅ Todos los campos necesarios existen
-- ✅ Productos con precios y stock
-- ✅ Tabla sales existe
-- ✅ Políticas RLS configuradas
-- ============================================
