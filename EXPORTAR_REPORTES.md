# Exportar Reportes a CSV/PDF

## Descripción
Esta funcionalidad permite exportar datos de inventario, ventas y pedidos a formatos CSV y PDF, marcando automáticamente el responsable y la fecha de exportación para facilitar el intercambio de información con otros sistemas y áreas.

## Características Principales

### ✅ Tipos de Reportes Disponibles
- **Inventario**: Productos y movimientos de stock con detalles completos
- **Ventas**: Registro de ventas realizadas con información de clientes
- **Pedidos**: Órdenes de compra y su estado de recepción

### ✅ Formatos de Exportación
- **CSV**: Archivo de valores separados por comas para análisis de datos
- **PDF**: Documento portable con formato profesional para presentaciones

### ✅ Funcionalidades Avanzadas
- **Filtros por fecha**: Exportar solo datos de un rango específico
- **Metadata automática**: Responsable, fecha y estadísticas incluidas
- **Historial de exportaciones**: Auditoría completa de todas las exportaciones
- **Validación de datos**: Verificación antes de generar reportes
- **Diseño profesional**: PDFs con formato corporativo

## Cómo Usar

### 1. Acceder a la Funcionalidad
- Desde el **Dashboard principal**, hacer clic en la tarjeta **"Exportar Reportes"**
- O navegar directamente a `/reports`

### 2. Configurar Exportación

#### Opciones Principales:
- **Tipo de Reporte**: Seleccionar entre Inventario, Ventas o Pedidos
- **Formato**: Elegir CSV o PDF según la necesidad
- **Rango de Fechas** (Opcional): Filtrar datos por período específico
- **Incluir Metadata**: Agregar información de responsable y exportación

#### Proceso de Exportación:
1. **Seleccionar** tipo de reporte y formato deseado
2. **Configurar** filtros de fecha si es necesario
3. **Revisar** la vista previa de opciones seleccionadas
4. **Confirmar** y ejecutar la exportación
5. **Descargar** automáticamente el archivo generado

### 3. Contenido de los Reportes

#### Reporte de Inventario
- SKU y nombre del producto
- Precio de los productos
- Tipo de movimiento (Entrada/Salida)
- Cantidad del movimiento
- Razón del movimiento
- Fecha del movimiento
- Notas adicionales

#### Reporte de Ventas
- Fecha de venta
- SKU y nombre del producto
- Cantidad vendida
- Precio unitario y total
- Cliente y número de factura
- Origen de la venta
- Fecha de registro

#### Reporte de Pedidos
- Número de pedido
- Proveedor
- Estado del pedido
- Productos incluidos
- Cantidades pedidas vs recibidas
- Costos unitarios y totales
- Fechas esperadas y de creación

## Metadata Incluida

### Información Automática
- **Responsable**: Usuario que realizó la exportación
- **Fecha y Hora**: Momento exacto de la exportación
- **Tipo de Reporte**: Inventario, Ventas o Pedidos
- **Formato**: CSV o PDF
- **Total de Registros**: Cantidad de datos exportados
- **Rango de Fechas**: Si se aplicaron filtros temporales

### Historial de Auditoría
- Registro permanente de todas las exportaciones
- Información del usuario responsable
- Fecha y hora de cada exportación
- Detalles de configuración utilizada
- Nombre del archivo generado

## Casos de Uso

### 📊 Análisis de Datos
- **CSV para Excel**: Importar datos para análisis detallado
- **Compartir con equipos**: Enviar datos a otras áreas
- **Integración sistemas**: Importar en herramientas de BI

### 📄 Reportes Formales
- **PDF ejecutivos**: Presentaciones para gerencia
- **Auditorías**: Documentación formal para revisiones
- **Proveedores**: Compartir datos de pedidos y recepciones

### 🔄 Intercambio de Información
- **Sistemas externos**: Integración con ERP/CRM
- **Respaldos**: Exportación periódica de datos
- **Migración**: Transferencia de información entre sistemas

## Ventajas del Sistema

### ✅ Trazabilidad Completa
- Cada exportación queda registrada con responsable
- Historial permanente para auditorías
- Información de configuración utilizada

### ✅ Formatos Optimizados
- **CSV**: Ideal para análisis y procesamiento automático
- **PDF**: Perfecto para presentaciones y documentación formal

### ✅ Filtros Inteligentes
- Exportar solo datos necesarios por rango de fechas
- Reducir tamaño de archivos y mejorar rendimiento
- Focalizar análisis en períodos específicos

### ✅ Metadata Rica
- Información contextual automática
- Estadísticas incluidas en los reportes
- Datos de responsabilidad y trazabilidad

## Consideraciones Técnicas

### Rendimiento
- **Optimización**: Consultas eficientes para grandes volúmenes
- **Filtros**: Reducir carga usando rangos de fecha
- **Formato CSV**: Más rápido para datos grandes
- **Formato PDF**: Mejor para presentaciones pequeñas/medianas

### Seguridad
- **Autenticación**: Solo usuarios autenticados pueden exportar
- **Auditoría**: Registro completo de quién exporta qué y cuándo
- **Datos sensibles**: Control de acceso según permisos de usuario

### Limitaciones
- **Volumen**: PDFs optimizados para hasta ~10,000 registros
- **CSV**: Sin límite práctico de registros
- **Memoria**: Los datos se procesan en lotes para eficiencia

## Base de Datos

### Tabla de Historial (`export_history`)
```sql
- id: Identificador único
- user_id: Usuario responsable
- user_name: Nombre del usuario
- report_type: Tipo de reporte (inventory/sales/orders)
- format: Formato (csv/pdf)
- date_from/date_to: Filtros de fecha aplicados
- total_records: Cantidad de registros exportados
- file_name: Nombre del archivo generado
- created_at: Fecha y hora de exportación
```

### Índices Optimizados
- Por usuario para historial personal
- Por tipo de reporte para estadísticas
- Por fecha para consultas temporales

## Soporte
Para problemas o dudas sobre esta funcionalidad:
1. Revisar el historial de exportaciones en la aplicación
2. Verificar permisos de usuario
3. Contactar al administrador del sistema
4. Revisar logs de errores si la exportación falla