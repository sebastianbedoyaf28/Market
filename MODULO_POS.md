# 🛒 Módulo de Punto de Ventas (POS)

Sistema completo de Punto de Ventas integrado con los módulos de Ventas e Inventario.

---

## 🎯 Descripción

El módulo de Punto de Ventas (POS) permite registrar ventas en tiempo real de forma intuitiva y rápida. Se integra perfectamente con:
- **Módulo de Ventas** (RF006/RF007) - Las ventas del POS aparecen en el historial
- **Módulo de Inventario** - Actualiza el stock automáticamente

---

## 🏗️ Estructura del Módulo

```
src/app/modules/pos/
├── models/
│   └── pos.models.ts              # Interfaces del POS
├── services/
│   └── pos.service.ts             # Lógica de negocio
├── pages/
│   └── pos-main/
│       ├── pos-main.page.ts       # Página principal del POS
│       ├── pos-main.page.html
│       └── pos-main.page.scss
├── pos-routing.module.ts          # Routing del módulo
└── pos.module.ts                  # Configuración del módulo
```

---

## 🔗 Integración con Otros Módulos

### ✅ Módulo de Ventas
Cada venta procesada en el POS:
1. Crea registros individuales en la tabla `sales`
2. Marca el origen como `'pos_system'`
3. Asigna un número de factura único
4. Aparece automáticamente en el **Historial de Ventas**

### ✅ Módulo de Inventario
Después de cada venta:
1. Decrementa el stock de cada producto vendido
2. Actualiza `total_stock` en `inventory_products`
3. Previene sobreventa validando stock disponible

---

## 🎨 Características Principales

### 1. Búsqueda de Productos
- 🔍 Búsqueda en tiempo real por nombre o SKU
- ⚡ Debounce de 300ms para optimizar
- 📦 Muestra solo productos con stock disponible
- 💰 Visualización de precio y stock

### 2. Carrito de Compras
- ➕ Agregar productos con un clic
- 🔢 Ajustar cantidades fácilmente
- ❌ Eliminar items individuales
- 🗑️ Limpiar carrito completo
- 💾 Persistencia en localStorage
- ✅ Validación de stock en tiempo real

### 3. Procesamiento de Ventas
- 👤 Información del cliente (opcional)
- 💳 Múltiples métodos de pago
- 📝 Notas adicionales
- 🧾 Generación de número de factura único
- ✅ Confirmación de venta exitosa

### 4. Interfaz Moderna
- 📱 Responsive (móvil, tablet, desktop)
- 🎨 Diseño intuitivo y limpio
- ⚡ Feedback visual inmediato
- 🛒 Carrito lateral siempre visible

---

## 💻 Modelos de Datos

### `POSProduct`
```typescript
interface POSProduct {
  id: string;
  name: string;
  sku?: string;
  price: number;
  stock: number;        // Stock disponible
  imageUrl?: string;
  category?: string;
}
```

### `POSCartItem`
```typescript
interface POSCartItem {
  productId: string;
  productName: string;
  productSku?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;     // Calculado automáticamente
  stock: number;        // Para validación
}
```

### `POSCart`
```typescript
interface POSCart {
  items: POSCartItem[];
  subtotal: number;     // Suma de subtotales
  tax: number;          // Impuestos (configurable)
  discount: number;     // Descuentos (configurable)
  total: number;        // Total final
  itemsCount: number;   // Total de items
}
```

### `POSTransaction`
```typescript
interface POSTransaction {
  cart: POSCart;
  customer?: POSCustomer;
  invoiceNumber?: string;
  paymentMethod: 'cash' | 'card' | 'transfer';
  notes?: string;
  saleDate: string;
}
```

---

## 🛠️ Servicios

### `POSService`

#### Métodos de Búsqueda:
```typescript
// Buscar productos por nombre o SKU
searchProducts(query: string): Promise<POSProduct[]>

// Obtener productos por categoría
getProductsByCategory(category?: string): Promise<POSProduct[]>
```

#### Gestión del Carrito:
```typescript
// Agregar producto al carrito
addToCart(product: POSProduct, quantity: number): void

// Actualizar cantidad de un item
updateItemQuantity(productId: string, quantity: number): void

// Remover producto del carrito
removeFromCart(productId: string): void

// Limpiar carrito completo
clearCart(): void

// Obtener carrito actual
getCurrentCart(): POSCart

// Observable del carrito (para suscripciones)
cart$: Observable<POSCart>
```

#### Procesamiento de Ventas:
```typescript
// Completar venta y crear registros
completeSale(transaction: POSTransaction): Promise<POSCompletedSale>
```

---

## 🔄 Flujo de Venta Completo

```
1. Cliente llega al negocio
   ↓
2. Cajero busca productos (búsqueda/escaneo)
   ↓
3. Productos se agregan al carrito
   ├─ Validación de stock ✅
   ├─ Cálculo automático de totales 💰
   └─ Actualización en tiempo real 🔄
   ↓
4. Cliente decide comprar
   ↓
5. Cajero hace clic en "Finalizar Venta"
   ↓
6. Modal de checkout se abre
   ├─ Información del cliente (opcional) 👤
   ├─ Método de pago 💳
   └─ Notas adicionales 📝
   ↓
7. Procesar venta
   ├─ Crear ventas individuales en tabla `sales` 📊
   ├─ Asignar número de factura único 🧾
   ├─ Actualizar inventario (decrementar stock) 📦
   └─ Limpiar carrito 🗑️
   ↓
8. Confirmación de venta
   ├─ Mostrar resumen 📄
   ├─ Opción de ver en historial 📋
   └─ Opción de nueva venta ➕
```

---

## 🧮 Cálculos Automáticos

### Por Item:
```
subtotal = unitPrice × quantity
```

### Total del Carrito:
```
subtotal = Σ(item.subtotal)
tax = subtotal × taxRate
total = subtotal + tax - discount
itemsCount = Σ(item.quantity)
```

### Stock Después de Venta:
```
newStock = currentStock - quantitySold
```

---

## 🔐 Validaciones

### Antes de Agregar al Carrito:
- ✅ Stock disponible > 0
- ✅ Cantidad solicitada ≤ stock disponible

### Antes de Finalizar Venta:
- ✅ Carrito no vacío
- ✅ Stock suficiente para todos los items
- ✅ Precios válidos (> 0)

### Durante el Procesamiento:
- ✅ Usuario autenticado
- ✅ Productos existen en inventario
- ✅ Stock no ha cambiado mientras compraba

---

## 📊 Integración con Base de Datos

### Tabla: `sales`
Cada venta del POS crea **un registro por producto**:

```sql
INSERT INTO sales (
  product_id,
  quantity,
  unit_price,
  total_price,
  sale_date,
  customer_name,
  invoice_number,
  import_source,  -- 'pos_system'
  user_id
);
```

### Tabla: `inventory_products`
Actualiza el stock después de cada venta:

```sql
UPDATE inventory_products
SET total_stock = total_stock - quantity_sold,
    updated_at = NOW()
WHERE id = product_id;
```

---

## 🎯 Características Únicas del POS

### 1. Persistencia del Carrito
- 💾 Se guarda en `localStorage`
- 🔄 Se restaura al recargar la página
- ❌ Se limpia después de cada venta exitosa

### 2. Números de Factura Únicos
Formato: `INV-YYYYMMDD-XXXX`
- Ejemplo: `INV-20241015-0001`
- Incluye fecha y número aleatorio

### 3. Multi-item por Transacción
Una venta puede incluir:
- ✅ Múltiples productos
- ✅ Diferentes cantidades
- ✅ Un solo número de factura
- ✅ Una sola transacción

### 4. Carrito en Tiempo Real
- 🔄 Observable pattern con RxJS
- ⚡ Actualizaciones instantáneas
- 📊 Cálculos automáticos

---

## 🚀 Cómo Usar el POS

### 1. Acceder al Módulo
```
Dashboard → "Punto de Venta"
o
Navega a: /pos
```

### 2. Buscar Productos
```
1. Escribe en la barra de búsqueda
2. O explora la lista completa
3. Click en cualquier producto para agregar
```

### 3. Gestionar Carrito
```
➕ Click en el producto para agregar
➕➖ Usa los botones para ajustar cantidad
❌ Click en X para eliminar item
🗑️ "Limpiar carrito" para vaciar todo
```

### 4. Finalizar Venta
```
1. Click en 🛒 en el header
   o
   Click en "Finalizar Venta"
2. Llenar información del cliente (opcional)
3. Seleccionar método de pago
4. Click en "Procesar Venta"
5. ¡Listo! ✅
```

---

## 📱 Interfaz de Usuario

### Vista Principal
```
┌─────────────────────────────────────────────────────┐
│ 🔙 Punto de Venta                          🛒(3)    │
│ 🔍 [Buscar producto...]                             │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Productos Disponibles              │ Carrito       │
│                                     │               │
│  ┌──────┐ ┌──────┐ ┌──────┐       │ • Arroz 1kg  │
│  │Arroz │ │Leche │ │Pan   │       │   $2.50 x 2  │
│  │$2.50 │ │$1.80 │ │$1.20 │       │   $5.00      │
│  │⭐10  │ │⭐25  │ │⭐50  │       │               │
│  └──────┘ └──────┘ └──────┘       │ • Leche 1L   │
│                                     │   $1.80 x 1  │
│  ┌──────┐ ┌──────┐ ┌──────┐       │   $1.80      │
│  │...   │ │...   │ │...   │       │               │
│  └──────┘ └──────┘ └──────┘       │ Subtotal:    │
│                                     │   $6.80      │
│                                     │ Total:       │
│                                     │   $6.80      │
│                                     │               │
│                                     │ [Finalizar]  │
└─────────────────────────────────────────────────────┘
```

### Modal de Checkout
```
┌─────────────────────────────────────┐
│ Finalizar Venta            [Cerrar] │
├─────────────────────────────────────┤
│ Resumen:                            │
│ Items: 3                            │
│ Total: $6.80                        │
│                                     │
│ Cliente (Opcional):                 │
│ Nombre: [           ]               │
│ Email:  [           ]               │
│ Tel:    [           ]               │
│                                     │
│ Método de Pago:                     │
│ ○ Efectivo  ○ Tarjeta  ○ Transfer. │
│                                     │
│ Notas:                              │
│ [                    ]              │
│                                     │
│ [✅ Procesar Venta - $6.80]        │
└─────────────────────────────────────┘
```

---

## 🎨 Diseño Responsive

### 📱 Móvil (< 768px)
- Lista de productos en columna única
- Carrito abajo de los productos
- Botón flotante del carrito

### 💻 Tablet/Desktop (≥ 768px)
- Grid de productos (2-3 columnas)
- Carrito lateral sticky
- Mayor espacio y visualización

---

## ✨ Ventajas del Sistema

### Para el Negocio:
1. ✅ **Ventas más rápidas** - Proceso simplificado
2. ✅ **Menos errores** - Cálculos automáticos
3. ✅ **Control de stock** - Actualización en tiempo real
4. ✅ **Historial completo** - Todo registrado
5. ✅ **Análisis de ventas** - Integrado con reportes

### Para el Cajero:
1. ✅ **Interfaz intuitiva** - Fácil de usar
2. ✅ **Búsqueda rápida** - Encuentra productos al instante
3. ✅ **Validación automática** - No vende sin stock
4. ✅ **Persistencia** - No pierde el carrito
5. ✅ **Feedback visual** - Siempre sabe qué pasa

### Para el Cliente:
1. ✅ **Servicio rápido** - Menos tiempo de espera
2. ✅ **Precisión** - Sin errores en precios
3. ✅ **Factura clara** - Número único
4. ✅ **Registro** - Historial para devoluciones

---

## 🔗 Correlación con Módulos Existentes

### Con RF006 (Importación de Ventas):
```
RF006: CSV/Excel → tabla sales
POS:   Tiempo real → tabla sales
Ambos: Mismo formato, mismo sistema ✅
```

### Con RF007 (Historial de Ventas):
```
POS → Crea ventas → Aparecen en historial
Filtro: import_source = 'pos_system'
Todo: Reportes, exportación, análisis ✅
```

### Con Inventario:
```
POS → Vende producto → Decrementa stock
Validación: Stock > 0 antes de vender
Alertas: Stock bajo activadas automáticamente ✅
```

---

## 📊 Métricas y Reportes

Las ventas del POS se incluyen automáticamente en:
- ✅ Total de ventas del día
- ✅ Productos más vendidos
- ✅ Ingresos por día/semana/mes
- ✅ Exportación CSV/PDF
- ✅ Análisis de inventario

---

## 🚧 Próximas Mejoras

### Funcionalidades futuras:
- [ ] Escáner de código de barras
- [ ] Impresión de tickets
- [ ] Descuentos y promociones
- [ ] Múltiples métodos de pago en una venta
- [ ] Devoluciones y reembolsos
- [ ] Turnos de caja
- [ ] Múltiples cajas simultáneas
- [ ] Integración con impresora térmica
- [ ] Modo offline con sincronización

---

## 🎉 Estado del Módulo

| Característica | Estado |
|---------------|--------|
| Búsqueda de productos | ✅ Completo |
| Carrito de compras | ✅ Completo |
| Validación de stock | ✅ Completo |
| Persistencia del carrito | ✅ Completo |
| Finalizar venta | ✅ Completo |
| Integración con ventas | ✅ Completo |
| Integración con inventario | ✅ Completo |
| Números de factura | ✅ Completo |
| Información del cliente | ✅ Completo |
| Métodos de pago | ✅ Completo |
| UI Responsive | ✅ Completo |
| Documentación | ✅ Completo |

---

**Módulo POS: 100% COMPLETO** 🎉

Integrado perfectamente con:
- ✅ Módulo de Ventas (RF006/RF007)
- ✅ Módulo de Inventario
- ✅ Dashboard principal
- ✅ Sistema de reportes

---

**Desarrollado por:** CR  
**Fecha:** Octubre 2024  
**Versión:** 1.0  
**Estado:** Producción Ready ✅



