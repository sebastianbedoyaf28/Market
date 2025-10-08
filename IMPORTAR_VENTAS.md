# Importar Ventas desde Sistemas Externos

## Descripción
Esta funcionalidad permite importar ventas registradas en sistemas externos (POS, ERP, etc.) mediante archivos CSV o Excel, facilitando la integración y conciliación automática con el inventario.

## Características Principales

### ✅ Formatos Soportados
- **CSV**: Archivos de texto separados por comas
- **Excel**: Archivos .xlsx y .xls

### ✅ Funcionalidades
- **Vista previa**: Visualiza los datos antes de importar
- **Mapeo flexible**: Asocia las columnas del archivo con los campos del sistema
- **Validación automática**: Verifica la integridad de los datos
- **Conciliación de inventario**: Actualiza automáticamente el stock
- **Registro de transacciones**: Mantiene historial de movimientos

## Cómo Usar

### 1. Acceder a la Funcionalidad
- Desde el **Dashboard principal**, hacer clic en la tarjeta **"Importar Ventas"**
- O navegar directamente a `/sales-import`

### 2. Preparar el Archivo
El archivo debe contener las siguientes columnas (nombres flexibles):

#### Columnas Requeridas:
- **SKU o Código del Producto**: Identificador único del producto
- **Cantidad**: Cantidad vendida (número entero positivo)

#### Columnas Opcionales:
- **Nombre del Producto**: Descripción del producto
- **Precio Unitario**: Precio por unidad
- **Precio Total**: Precio total de la venta
- **Fecha de Venta**: Fecha de la transacción (DD/MM/YYYY o YYYY-MM-DD)
- **Cliente**: Nombre del cliente
- **Número de Factura**: Número de factura o referencia

### 3. Proceso de Importación

#### Paso 1: Seleccionar Archivo
- Hacer clic en **"Seleccionar Archivo"** o arrastrar el archivo
- El sistema acepta archivos hasta 10MB
- Descargar el **"Archivo de Ejemplo"** si necesitas una plantilla

#### Paso 2: Mapear Columnas
- El sistema sugiere automáticamente los mapeos basándose en los nombres de las columnas
- Revisar y ajustar los mapeos según sea necesario
- Asegurar que al menos **SKU/Nombre** y **Cantidad** estén mapeados

#### Paso 3: Procesar
- Hacer clic en **"Procesar Importación"**
- El sistema validará los datos y actualizará el inventario
- Ver el progreso en tiempo real

#### Paso 4: Revisar Resultados
- Ver resumen de registros procesados exitosamente
- Revisar errores y advertencias si los hay
- Los productos sin stock suficiente generarán advertencias

## Formato de Archivo de Ejemplo

```csv
SKU,Nombre del Producto,Cantidad,Precio Unitario,Precio Total,Fecha de Venta,Cliente,Número de Factura
PROD001,Producto Ejemplo 1,5,10.50,52.50,2024-10-07,Juan Pérez,FAC-001
PROD002,Producto Ejemplo 2,3,25.00,75.00,2024-10-07,María García,FAC-002
```

## Validaciones del Sistema

### ✅ Validaciones de Datos
- **Cantidad**: Debe ser un número positivo mayor a 0
- **Precios**: No pueden ser negativos
- **Fecha**: Debe tener un formato válido
- **Producto**: Debe existir en el sistema (por SKU o nombre)

### ✅ Validaciones de Inventario
- **Stock disponible**: Verifica que hay suficiente inventario
- **Stock insuficiente**: Permite ventas parciales si hay algo de stock
- **Productos no encontrados**: Genera advertencias para productos no localizados

## Conciliación Automática

### Actualización de Inventario
- **Registro de salidas**: Cada venta genera un movimiento de salida en el inventario
- **Razón**: "venta" con detalles de la importación
- **Trazabilidad**: Incluye información de factura y cliente
- **Historial**: Mantiene registro completo de movimientos

### Registro de Ventas
- **Tabla de ventas**: Almacena cada registro de venta importado
- **Origen**: Marca las ventas como "csv_excel_import"
- **Metadatos**: Conserva información adicional como cliente y factura

## Errores Comunes y Soluciones

### ❌ "Producto no encontrado"
**Solución**: Verificar que el SKU o nombre del producto existe en el sistema

### ❌ "Stock insuficiente"
**Solución**: Revisar inventario disponible antes de importar ventas futuras

### ❌ "Formato de fecha inválido"
**Solución**: Usar formatos DD/MM/YYYY o YYYY-MM-DD

### ❌ "Cantidad inválida"
**Solución**: Asegurar que las cantidades sean números enteros positivos

## Consideraciones Técnicas

### Rendimiento
- **Límite de archivo**: Máximo 10MB
- **Procesamiento**: Se procesan todos los registros secuencialmente
- **Memoria**: Optimizado para archivos grandes mediante streaming

### Seguridad
- **Autenticación**: Requiere usuario autenticado
- **Validación**: Todos los datos son validados antes del procesamiento
- **Transacciones**: Las operaciones son atómicas para mantener consistencia

### Base de Datos
La funcionalidad utiliza las siguientes tablas:
- `products`: Para verificar existencia de productos
- `inventory_movements`: Para registrar salidas de inventario
- `sales`: Para almacenar registros de ventas importadas

## Soporte
Para problemas o dudas sobre esta funcionalidad, contactar al administrador del sistema o revisar los logs de errores en la aplicación.