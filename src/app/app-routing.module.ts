import { NgModule } from '@angular/core';
import { RouterModule, Routes, PreloadAllModules } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { PermissionGuard } from './core/guards/permission.guard';

const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage) },
  { path: 'home', canActivate: [AuthGuard], loadComponent: () => import('./home/home.page').then(m => m.HomePage) },
  { path: 'forgot-password', loadComponent: () => import('./pages/forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage) },
  { path: 'reset-password', loadComponent: () => import('./pages/reset-password/reset-password.page').then(m => m.ResetPasswordPage) },
  {
    path: 'inventory',
    loadChildren: () => import('./modules/inventory/inventory.module').then(m => m.InventoryModule),
    canActivate: [AuthGuard, PermissionGuard],
    data: { permissions: ['inventory:read'] },
  },
  {
    path: 'orders',
    loadChildren: () => import('./modules/purchase-orders/purchase-orders.module').then(m => m.PurchaseOrdersModule),
    canActivate: [AuthGuard, PermissionGuard],
    data: { permissions: ['orders:read'] },
  },
  {
    path: 'alerts',
    loadComponent: () => import('./modules/alerts/pages/list/alerts-list.page').then(m => m.AlertsListPage),
    canActivate: [AuthGuard, PermissionGuard],
    data: { permissions: ['alerts:read'] },
  },
  {
    path: 'users',
    loadChildren: () => import('./modules/users/users.module').then(m => m.UsersModule),
    canActivate: [AuthGuard, PermissionGuard],
    data: { permissions: ['users:read'] },
  },
  {
    path: 'roles',
    loadChildren: () => import('./modules/roles/roles.module').then(m => m.RolesModule),
    canActivate: [AuthGuard, PermissionGuard],
    data: { permissions: ['roles:read'] },
  },
  {
    path: 'pos',
    loadChildren: () => import('./modules/pos/pos.module').then(m => m.POSModule),
    canActivate: [AuthGuard, PermissionGuard],
    data: { permissions: ['sales:write'] },
  },
  {
    path: 'sales',
    loadChildren: () => import('./modules/sales/sales.module').then(m => m.SalesModule),
    canActivate: [AuthGuard, PermissionGuard],
    data: { permissions: ['sales:read'] },
  },
  {
    path: 'sales-import',
    loadComponent: () => import('./pages/sales-import/sales-import.page').then(m => m.SalesImportPage),
    canActivate: [AuthGuard, PermissionGuard],
    data: { permissions: ['sales:import'] },
  },
  {
    path: 'reports',
    loadComponent: () => import('./pages/reports/reports.page').then(m => m.ReportsPage),
    canActivate: [AuthGuard, PermissionGuard],
    data: { permissions: ['reports:read'] },
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}

