# Configuración de Realtime en Supabase

Este documento explica cómo habilitar y verificar que Supabase Realtime esté funcionando correctamente para las actualizaciones en tiempo real del dashboard.

## Paso 1: Verificar que Realtime esté habilitado en Supabase

1. Accede a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **Database** → **Replication**
3. Asegúrate de que las siguientes tablas estén habilitadas para Realtime:
   - `products`
   - `carts`
   - `cart_items`
   - `inventory_products`
   - `purchase_orders`
   - `purchase_order_items`
   - `sales`

## Paso 2: Ejecutar el script SQL actualizado

Si las tablas no están habilitadas, ejecuta el archivo `supabase/schema.sql` actualizado que incluye las siguientes líneas al final:

```sql
-- Habilitar Realtime en las tablas principales para el dashboard
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.carts;
alter publication supabase_realtime add table public.cart_items;
alter publication supabase_realtime add table public.inventory_products;
alter publication supabase_realtime add table public.purchase_orders;
alter publication supabase_realtime add table public.purchase_order_items;
alter publication supabase_realtime add table public.sales;
```

### Cómo ejecutar:

1. Ve a **SQL Editor** en tu proyecto de Supabase
2. Copia y pega las líneas anteriores
3. Haz clic en **Run** para ejecutar el script

## Paso 3: Verificar que funcione

1. Abre la aplicación en el navegador
2. Abre la consola de desarrollo (F12)
3. Deberías ver mensajes como:
   ```
   [Realtime] Cambio en products: {...}
   [Realtime] Cambio en carts: {...}
   [Realtime] Cambio en inventory_products: {...}
   ```

## Funcionalidades en tiempo real implementadas

### Actividad Reciente
La sección de actividad reciente ahora muestra **todo lo relacionado con pedidos** en tiempo real:

#### 📦 Pedidos y Carritos:
- **Carritos creados:** Cuando se crea un nuevo carrito de compras
- **Pedidos confirmados:** Cuando un carrito cambia a estado "ordered"
- **Items agregados al carrito:** Cada producto que se agrega con su cantidad
- **Órdenes de compra:** Creación y cambios de estado (borrador, enviada, recibida, cancelada)
- **Items de órdenes de compra:** Productos ordenados y productos recibidos con cantidades

#### 📊 Otras Actividades:
- **Productos nuevos:** Cuando se registra un nuevo producto
- **Inventario:** Cuando se registra un producto en el inventario
- **Ventas:** Cuando se registra una venta importada

Todas estas actividades se actualizan **automáticamente** sin necesidad de refrescar la página, mostrando las 10 actividades más recientes de todas las fuentes.

### Métricas del Dashboard
Las siguientes métricas se actualizan en tiempo real:
- **Total de productos en inventario**
- **Pedidos pendientes**
- **Ventas del día**
- **Alertas** (stock bajo, productos por vencer)

## Solución de problemas

### Las actualizaciones no aparecen en tiempo real

1. **Verifica la conexión a Supabase:**
   - Abre la consola del navegador
   - Busca errores de conexión

2. **Verifica que Realtime esté habilitado:**
   - Ve a Database → Replication en Supabase
   - Asegúrate de que las tablas estén en la lista

3. **Verifica los permisos RLS:**
   - Las políticas de Row Level Security deben permitir SELECT en las tablas
   - El usuario debe estar autenticado

4. **Revisa los logs:**
   - Los cambios se registran en la consola con el prefijo `[Realtime]`
   - Si no ves estos mensajes, puede haber un problema de conexión

### Errores comunes

#### Error: "Realtime is not enabled for this table"
**Solución:** Ejecuta el script SQL del Paso 2

#### Error: "permission denied for table"
**Solución:** Verifica las políticas RLS en `supabase/schema.sql`

#### Las subscripciones no se limpian
**Solución:** El componente implementa `OnDestroy` que limpia automáticamente las subscripciones cuando se sale de la página

## Notas técnicas

- Las subscripciones de Realtime se configuran en `home.page.ts` en el método `setupRealtimeSubscriptions()`
- Se crean **7 canales diferentes**, uno por cada tabla:
  1. `products` - Productos
  2. `carts` - Carritos/Pedidos
  3. `cart_items` - Items de carritos
  4. `inventory_products` - Inventario
  5. `purchase_orders` - Órdenes de compra
  6. `purchase_order_items` - Items de órdenes de compra
  7. `sales` - Ventas
- Las subscripciones se limpian automáticamente en `ngOnDestroy()`
- Los cambios se procesan de forma asíncrona y no bloquean la UI
- La actualización de actividades es independiente de la actualización de métricas para optimizar el rendimiento
- El método `updateRecentActivities()` consulta todas las fuentes y ordena las actividades cronológicamente

## Limitaciones

- Supabase Realtime tiene límites en el plan gratuito:
  - Máximo 200 conexiones simultáneas
  - 2GB de ancho de banda por mes
  
Para proyectos en producción con muchos usuarios, considera el plan Pro de Supabase.

