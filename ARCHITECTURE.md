# Arquitectura del Sistema Market POS

## 📋 Descripción General

Este proyecto sigue una **arquitectura limpia (Clean Architecture)** combinada con principios de **Domain-Driven Design (DDD)** para garantizar escalabilidad, mantenibilidad y calidad del software.

## 🏗️ Estructura de Directorios

```
src/app/
├── core/                          # 🔒 Servicios centrales y configuración
│   ├── guards/                    # Guards de autenticación y permisos
│   ├── interceptors/              # Interceptors HTTP (errores, auth, etc.)
│   ├── services/                  # Servicios singleton (auth, permissions)
│   ├── config/                    # Configuración de la aplicación
│   └── index.ts                   # Barrel exports
├── shared/                        # 🔄 Recursos compartidos
│   ├── components/                # Componentes reutilizables
│   ├── pipes/                     # Pipes personalizados
│   ├── directives/                # Directivas personalizadas
│   ├── models/                    # Interfaces y tipos globales
│   ├── utils/                     # Utilidades y helpers
│   └── index.ts                   # Barrel exports
├── modules/                       # 📦 Módulos de funcionalidad
│   ├── inventory/                 # Gestión de inventario
│   ├── pos/                       # Punto de venta
│   ├── sales/                     # Gestión de ventas
│   ├── purchase-orders/           # Órdenes de compra
│   ├── users/                     # Gestión de usuarios
│   └── alerts/                    # Sistema de alertas
├── pages/                         # 📄 Páginas independientes (legacy)
├── layout/                        # 🎨 Componentes de layout
│   ├── header/
│   ├── sidebar/
│   └── footer/
└── features/                      # 🚀 Futuras features organizadas por dominio
```

## 🎯 Principios de Arquitectura

### 1. **Separation of Concerns**
- **Core**: Lógica de negocio fundamental
- **Shared**: Recursos reutilizables
- **Modules**: Funcionalidades específicas
- **Features**: Organización por dominio de negocio

### 2. **Dependency Inversion**
- Los módulos de alto nivel no dependen de los de bajo nivel
- Ambos dependen de abstracciones (interfaces)

### 3. **Single Responsibility**
- Cada clase/servicio tiene una sola razón para cambiar
- Separación clara entre UI, lógica de negocio y acceso a datos

### 4. **Domain-Driven Design**
- Organización por dominios de negocio
- Lenguaje ubicuo en el código
- Modelos ricos en el dominio

## 📚 Convenciones de Código

### Naming Conventions
- **Archivos**: `kebab-case.extension.ts`
- **Clases**: `PascalCase`
- **Métodos/Variables**: `camelCase`
- **Constantes**: `UPPER_SNAKE_CASE`
- **Interfaces**: `PascalCase` (con prefijo I opcional)

### Import Organization
```typescript
// 1. Angular Core
import { Component, OnInit } from '@angular/core';

// 2. Angular Libraries
import { FormBuilder, Validators } from '@angular/forms';

// 3. Third-party libraries
import { Observable } from 'rxjs';

// 4. Application core
import { AuthService } from '@core/services';

// 5. Shared resources
import { BaseEntity, NumberUtils } from '@shared';

// 6. Feature-specific imports
import { Product } from '../models/product.model';
```

### Barrel Exports
Utiliza los archivos `index.ts` para exportaciones limpias:
```typescript
// ✅ Bien
import { AuthService, UserContextService } from '@core';

// ❌ Evitar
import { AuthService } from '../../core/services/auth.service';
import { UserContextService } from '../../core/services/user-context.service';
```

## 🛠️ Servicios por Categoría

### Core Services (Singleton)
- `AuthService`: Autenticación y autorización
- `PermissionService`: Gestión de permisos
- `UserContextService`: Contexto del usuario actual

### Feature Services
- `InventoryService`: Gestión de inventario
- `POSService`: Lógica del punto de venta
- `SalesService`: Operaciones de ventas
- `ExportService`: Exportación de reportes

### Shared Utilities
- `DateUtils`: Utilidades de fecha
- `NumberUtils`: Formateo de números y monedas
- `ValidationUtils`: Validaciones comunes
- `StorageUtils`: Gestión de localStorage

## 🔒 Seguridad y Permisos

### Guards
- `AuthGuard`: Verifica autenticación
- `PermissionGuard`: Verifica permisos específicos

### Interceptors
- `ErrorInterceptor`: Manejo centralizado de errores HTTP
- `AuthInterceptor`: Inyección automática de tokens

## 📊 Manejo de Estados

### Estado Local
- Usar Angular Signals para reactividad
- Estado temporal en servicios

### Estado Compartido
- Context services para datos del usuario
- BehaviorSubjects para datos que cambian

## 🧪 Testing Strategy

### Unit Tests
```
src/
├── app/
│   ├── core/
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   └── auth.service.spec.ts
```

### Integration Tests
- Tests de módulos completos
- Tests de flujos de usuario

### E2E Tests
- Cypress para tests end-to-end
- Scenarios críticos de negocio

## 🚀 Escalabilidad

### Lazy Loading
- Todos los módulos se cargan bajo demanda
- Optimización de bundle size

### Code Splitting
- División por features
- Carga incremental de funcionalidades

### Performance
- OnPush change detection
- TrackBy functions en listas
- Memoización donde corresponda

## 📈 Métricas de Calidad

### Code Quality
- ESLint + Prettier configurado
- Husky para pre-commit hooks
- SonarQube para análisis estático

### Performance Monitoring
- Bundle analyzer
- Core Web Vitals
- Memory leak detection

## 🔄 Flujo de Desarrollo

### Feature Development
1. Crear feature branch desde develop
2. Implementar en módulo correspondiente
3. Agregar tests unitarios
4. Code review
5. Merge a develop

### Release Process
1. Testing completo en staging
2. Tag de versión semántica
3. Deploy a producción
4. Monitoring post-deploy

## 📖 Documentación

- **Architecture Decision Records (ADR)**: Decisiones arquitectónicas importantes
- **API Documentation**: Swagger/OpenAPI para APIs
- **Component Library**: Storybook para componentes UI
- **Code Comments**: JSDoc para funciones públicas

---

*Esta arquitectura asegura que el sistema sea escalable, mantenible y siga las mejores prácticas de desarrollo de software empresarial.*