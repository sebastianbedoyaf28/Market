import { NgModule } from '@angular/core';
import { RouterModule, Routes, PreloadAllModules } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage) },
  { path: 'home',  canActivate: [AuthGuard], loadComponent: () => import('./home/home.page').then(m => m.HomePage) },
  { path: 'forgot-password', loadComponent: () => import('./pages/forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage) },
  { path: 'reset-password', loadComponent: () => import('./pages/reset-password/reset-password.page').then(m => m.ResetPasswordPage) },
  {
    path: 'inventory',
    // TODO: Re-enable PermissionGuard when role-based access is required again.
    // canActivate: [AuthGuard, PermissionGuard],
    loadChildren: () => import('./modules/inventory/inventory.module').then(m => m.InventoryModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'orders',
    // canActivate: [AuthGuard, PermissionGuard],
    loadChildren: () => import('./modules/purchase-orders/purchase-orders.module').then(m => m.PurchaseOrdersModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'alerts',
    // canActivate: [AuthGuard, PermissionGuard],
    loadComponent: () => import('./modules/alerts/pages/list/alerts-list.page').then(m => m.AlertsListPage),
    canActivate: [AuthGuard],
  },
  {
    path: 'users',
    // canActivate: [AuthGuard, PermissionGuard],
    loadChildren: () => import('./modules/users/users.module').then(m => m.UsersModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'roles',
    // canActivate: [AuthGuard, PermissionGuard],
    loadChildren: () => import('./modules/roles/roles.module').then(m => m.RolesModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'pos',
    // Punto de Ventas - Integrado con RF006/RF007
    loadChildren: () => import('./modules/pos/pos.module').then(m => m.POSModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'sales',
    // RF007 - Historial de Ventas y Reportes
    loadChildren: () => import('./modules/sales/sales.module').then(m => m.SalesModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'sales-import',
    // RF006 - Importación de Ventas Externas
    // canActivate: [AuthGuard, PermissionGuard],
    loadComponent: () => import('./pages/sales-import/sales-import.page').then(m => m.SalesImportPage),
    canActivate: [AuthGuard],
  },
  {
    path: 'reports',
    // canActivate: [AuthGuard, PermissionGuard],
    loadComponent: () => import('./pages/reports/reports.page').then(m => m.ReportsPage),
    canActivate: [AuthGuard],
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}

