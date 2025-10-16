# 📋 Instrucciones para Configurar Supabase

## ⚡ Configuración Rápida del Módulo POS

### Paso 1: Abrir SQL Editor

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. En el menú lateral, haz clic en **SQL Editor**
4. Click en **New Query**

### Paso 2: Ejecutar el Script

1. Abre el archivo `SUPABASE_POS_SETUP.sql`
2. Copia **TODO** el contenido
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en **Run** (o presiona Ctrl+Enter)

### Paso 3: Verificar

Deberías ver al final del resultado:

```
status: "Configuración completada!"
productos_disponibles: X
ventas_hoy: X
```

---

## 🔍 ¿Qué hace el script?

### 1️⃣ Campos Necesarios
```sql
✅ Agrega campo 'sku' en inventory_products
✅ Agrega campo 'price' en inventory_products
✅ Agrega campo 'category' en inventory_products
✅ Agrega campo 'status' en sales
```

### 2️⃣ Índices de Rendimiento
```sql
✅ Índices para búsqueda rápida
✅ Índices para filtrado eficiente
✅ Índices compuestos optimizados
```

### 3️⃣ Políticas de Seguridad (RLS)
```sql
✅ Lectura pública de productos
✅ Escritura autenticada en ventas
✅ Actualización de stock segura
```

### 4️⃣ Funcionalidades Avanzadas
```sql
✅ Función para actualizar stock (previene race conditions)
✅ Vista optimizada para el POS
✅ Función de resumen de ventas diarias
✅ Triggers para timestamps automáticos
```

### 5️⃣ Realtime Habilitado
```sql
✅ inventory_products → actualizaciones en tiempo real
✅ sales → nuevas ventas en tiempo real
```

### 6️⃣ Datos de Ejemplo (Opcional)
```sql
✅ 5 productos de muestra para pruebas
   (Solo si la tabla está vacía)
```

---

## 🚨 Problemas Comunes

### Error: "relation already exists"
**Solución:** Está bien, significa que ya existe. El script sigue adelante.

### Error: "permission denied"
**Solución:** Asegúrate de estar usando el rol correcto. Ve a Settings → Database → Connection string y usa el "service_role" key si es necesario.

### Error: "column already exists"
**Solución:** Perfecto, significa que ya tienes ese campo. El script lo detecta y continúa.

---

## ✅ Verificación Manual

### 1. Verificar Tabla `inventory_products`

```sql
-- Ejecuta esto en SQL Editor
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory_products';
```

**Deberías ver:**
- `id` (uuid)
- `name` (text)
- `sku` (text) ← NUEVO
- `price` (numeric) ← NUEVO
- `total_stock` (integer)
- `category` (text) ← NUEVO
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### 2. Verificar Tabla `sales`

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sales';
```

**Deberías ver:**
- `id` (uuid)
- `product_id` (uuid)
- `quantity` (integer)
- `unit_price` (numeric)
- `total_price` (numeric)
- `sale_date` (date)
- `customer_name` (text)
- `invoice_number` (text)
- `import_source` (text)
- `status` (text) ← NUEVO
- `user_id` (uuid)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### 3. Verificar Realtime

1. Ve a **Database** → **Replication**
2. Busca estas tablas:
   - ✅ `inventory_products`
   - ✅ `sales`

Si no están, ejecuta:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
```

---

## 🧪 Prueba Rápida

### Insertar un producto de prueba:

```sql
INSERT INTO inventory_products (name, sku, price, total_stock, category)
VALUES ('Producto de Prueba', 'TEST-001', 9.99, 10, 'Pruebas');
```

### Verificar que aparezca en el POS:

```sql
SELECT * FROM pos_available_products;
```

### Simular una venta:

```sql
INSERT INTO sales (
    product_id, 
    quantity, 
    unit_price, 
    total_price, 
    sale_date,
    invoice_number,
    import_source,
    status
)
SELECT 
    id,
    1,
    price,
    price * 1,
    CURRENT_DATE,
    'TEST-001',
    'pos_system',
    'reconciled'
FROM inventory_products
WHERE sku = 'TEST-001';
```

### Verificar resumen del día:

```sql
SELECT * FROM get_daily_sales_summary(CURRENT_DATE);
```

---

## 🔄 Si ya tienes datos

### Migrar productos existentes

Si ya tienes productos en `inventory_products` sin los campos nuevos:

```sql
-- Establecer precios predeterminados
UPDATE inventory_products 
SET price = 1.00 
WHERE price IS NULL OR price = 0;

-- Generar SKUs automáticos si faltan
UPDATE inventory_products 
SET sku = 'SKU-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 6, '0')
WHERE sku IS NULL;
```

### Migrar ventas existentes

Si ya tienes ventas sin el campo `status`:

```sql
-- Marcar todas las ventas existentes como conciliadas
UPDATE sales 
SET status = 'reconciled' 
WHERE status IS NULL;
```

---

## 📊 Consultas Útiles

### Ver productos más vendidos:

```sql
SELECT 
    p.name,
    COUNT(*) as veces_vendido,
    SUM(s.quantity) as cantidad_total,
    SUM(s.total_price) as ingresos_totales
FROM sales s
JOIN inventory_products p ON s.product_id = p.id
WHERE s.sale_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p.name
ORDER BY ingresos_totales DESC
LIMIT 10;
```

### Ver ventas del POS hoy:

```sql
SELECT 
    invoice_number,
    customer_name,
    SUM(total_price) as total,
    COUNT(*) as items,
    MAX(created_at) as fecha_hora
FROM sales
WHERE sale_date = CURRENT_DATE
    AND import_source = 'pos_system'
GROUP BY invoice_number, customer_name
ORDER BY fecha_hora DESC;
```

### Ver stock bajo:

```sql
SELECT 
    name,
    sku,
    total_stock as stock_actual,
    price
FROM inventory_products
WHERE total_stock < 10
    AND total_stock > 0
ORDER BY total_stock ASC;
```

---

## 🎯 Siguiente Paso

Después de ejecutar el script:

1. ✅ Verifica que no haya errores en rojo
2. ✅ Comprueba que las tablas tengan los campos nuevos
3. ✅ Verifica que Realtime esté habilitado
4. ✅ Abre tu aplicación y prueba el POS
5. ✅ Intenta hacer una venta de prueba
6. ✅ Verifica que aparezca en el Historial de Ventas

---

## 🆘 ¿Necesitas ayuda?

Si algo no funciona:

1. **Copia el mensaje de error**
2. **Verifica qué parte del script falló**
3. **Revisa los logs en Supabase:**
   - Dashboard → Logs → Database

---

## 🔐 Seguridad

El script incluye:
- ✅ Políticas RLS configuradas
- ✅ Funciones con SECURITY DEFINER
- ✅ Validaciones de stock
- ✅ Prevención de race conditions
- ✅ Triggers automáticos

**No necesitas configurar nada más** ✨

---

## ✅ Checklist Final

Marca cuando completes cada paso:

- [ ] Script ejecutado sin errores
- [ ] Campos nuevos verificados
- [ ] Índices creados
- [ ] Políticas RLS activas
- [ ] Realtime habilitado
- [ ] Vista `pos_available_products` funciona
- [ ] Función `update_product_stock()` existe
- [ ] Función `get_daily_sales_summary()` existe
- [ ] POS abre sin errores
- [ ] Puedo buscar productos
- [ ] Puedo agregar al carrito
- [ ] Puedo completar una venta
- [ ] La venta aparece en el historial
- [ ] El stock se actualiza

**Si marcaste todos ✅ → ¡Está todo listo!** 🎉

---

**Tiempo estimado:** 5 minutos  
**Dificultad:** Fácil  
**Requiere:** Acceso a Supabase Dashboard

