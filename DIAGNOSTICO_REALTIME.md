# 🔍 Diagnóstico de Realtime - Actividad Reciente

Si las actividades no aparecen en tiempo real, sigue esta guía para diagnosticar el problema.

## ✅ Checklist de Verificación

### 1. ¿Ejecutaste el script SQL en Supabase?

**IMPORTANTE:** Debes ejecutar este script en el SQL Editor de Supabase:

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

#### Cómo verificar si ya lo ejecutaste:

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **Database** → **Replication**
3. Busca las tablas en la lista:
   - ✅ `products`
   - ✅ `carts`
   - ✅ `cart_items`
   - ✅ `inventory_products`
   - ✅ `purchase_orders` ← **IMPORTANTE para gestión de pedidos**
   - ✅ `purchase_order_items` ← **IMPORTANTE para items de pedidos**
   - ✅ `sales`

Si NO ves estas tablas en la lista de Replication, **debes ejecutar el script SQL**.

---

### 2. ¿Están apareciendo los logs en la consola?

Abre la **Consola del navegador** (F12) y busca mensajes como:

```
[Realtime] Cambio en purchase_orders: {...}
[Realtime] Cambio en purchase_order_items: {...}
```

#### Si NO ves estos logs:
- ❌ Realtime NO está habilitado → Ejecuta el script SQL del paso 1
- ❌ Hay un error de conexión → Revisa que tu proyecto de Supabase esté activo

#### Si SÍ ves estos logs:
- ✅ Realtime está funcionando
- El problema puede estar en la consulta de actividades

---

### 3. ¿La página está actualizada?

Después de crear un pedido:
1. Abre la **Consola del navegador** (F12)
2. Ve a la pestaña **Console**
3. Busca mensajes de error en color rojo

Los errores comunes incluyen:
- `permission denied` → Problema de políticas RLS
- `column does not exist` → Problema de esquema de base de datos
- `relation does not exist` → La tabla no existe

---

## 🧪 Prueba Manual

Sigue estos pasos para probar que Realtime funciona:

### Paso 1: Abre dos ventanas
1. Abre la aplicación en Chrome
2. Abre la aplicación en una ventana de incógnito (o en otro navegador)
3. Inicia sesión en ambas ventanas

### Paso 2: Verifica la consola
1. En AMBAS ventanas, abre la Consola (F12)
2. Ve a la pestaña **Console**
3. Deberías ver mensajes como:
   ```
   [Realtime] Setup complete - 7 channels subscribed
   ```

### Paso 3: Crea un pedido
1. En la **primera ventana**, ve a "Gestión de Pedidos"
2. Crea un nuevo pedido
3. Guarda el pedido

### Paso 4: Observa la segunda ventana
1. En la **segunda ventana**, deberías ver INMEDIATAMENTE:
   - Nuevo mensaje en la consola: `[Realtime] Cambio en purchase_orders: {...}`
   - La actividad aparece en "Actividad reciente" sin refrescar

### Resultados esperados:
- ✅ **Funciona:** El pedido aparece en la segunda ventana sin refrescar
- ❌ **No funciona:** No pasa nada en la segunda ventana

---

## 🔧 Soluciones según el problema

### Problema 1: No aparecen los logs `[Realtime]` en la consola

**Causa:** Realtime no está habilitado en Supabase

**Solución:**
1. Ve a Supabase Dashboard → SQL Editor
2. Ejecuta el script SQL del principio de este documento
3. Espera 10-20 segundos
4. Refresca la página de tu aplicación

---

### Problema 2: Aparecen los logs pero no se actualiza la actividad

**Causa:** Puede haber un error en la consulta de actividades

**Solución:**
1. Abre la Consola (F12)
2. Busca errores en rojo
3. Si ves `Error cargando órdenes de compra:`, revisa que:
   - La tabla `purchase_orders` existe
   - La tabla `suppliers` existe
   - Hay relación entre ellas (foreign key `supplier_id`)

---

### Problema 3: Error "permission denied"

**Causa:** Las políticas RLS no permiten leer las tablas

**Solución:**
Ejecuta en SQL Editor:

```sql
-- Verificar políticas de purchase_orders
select * from pg_policies where tablename = 'purchase_orders';

-- Si no hay política de lectura, créala:
create policy "Public read purchase_orders" on public.purchase_orders
  for select using (true);
```

---

### Problema 4: Solo aparece en la misma ventana

**Causa:** Puede ser un problema de Row Level Security (RLS)

**Solución:**
Las políticas de RLS están configuradas para que TODOS puedan leer:

```sql
create policy "Public read purchase_orders" on public.purchase_orders
  for select using (true);
```

Verifica que esta política exista ejecutando:
```sql
select * from pg_policies where tablename = 'purchase_orders';
```

---

## 📊 Tabla de diagnóstico

Usa esta tabla para identificar tu problema:

| ¿Ves logs `[Realtime]`? | ¿Aparece en misma ventana? | ¿Aparece en otra ventana? | Problema |
|-------------------------|----------------------------|---------------------------|----------|
| ❌ NO | ❌ NO | ❌ NO | Realtime no habilitado |
| ✅ SÍ | ✅ SÍ | ❌ NO | Problema de RLS |
| ✅ SÍ | ❌ NO | ❌ NO | Error en consulta |
| ✅ SÍ | ✅ SÍ | ✅ SÍ | **¡FUNCIONA!** |

---

## 🚑 Solución rápida

Si nada de lo anterior funciona, ejecuta este script completo:

```sql
-- 1. Habilitar Realtime
alter publication supabase_realtime add table public.purchase_orders;
alter publication supabase_realtime add table public.purchase_order_items;

-- 2. Verificar políticas RLS
drop policy if exists "Public read purchase_orders" on public.purchase_orders;
create policy "Public read purchase_orders" on public.purchase_orders
  for select using (true);

drop policy if exists "Public read purchase_order_items" on public.purchase_order_items;
create policy "Public read purchase_order_items" on public.purchase_order_items
  for select using (true);

-- 3. Verificar que la tabla suppliers tenga política de lectura
drop policy if exists "Public read suppliers" on public.suppliers;
create policy "Public read suppliers" on public.suppliers
  for select using (true);
```

Después de ejecutar esto:
1. Espera 10 segundos
2. Refresca la página
3. Crea un nuevo pedido
4. ¡Debería aparecer en actividad reciente!

---

## 📞 ¿Aún no funciona?

Si después de seguir todos estos pasos aún no funciona:

1. **Captura de pantalla de la consola** cuando crees un pedido
2. **Copia el error completo** (si hay alguno)
3. **Verifica en Supabase Dashboard** → Database → Tables que las tablas existan:
   - `purchase_orders`
   - `purchase_order_items`
   - `suppliers`

---

## ✨ Confirmación de que funciona

Cuando todo funciona correctamente, deberías ver:

```
Console:
[Realtime] Cambio en purchase_orders: {eventType: "INSERT", new: {...}}
[Realtime] Cambio en purchase_order_items: {eventType: "INSERT", new: {...}}

Dashboard > Actividad reciente:
📄 Orden de compra borrador         ahora
   Proveedor ABC - 7a2c4b1f...
```

¡Y debería aparecer en TODAS las ventanas/dispositivos conectados! 🎉

