import { NgModule } from '@angular/core';
import { RouterModule, Routes, PreloadAllModules } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage) },
  { path: 'home',  canActivate: [AuthGuard], loadComponent: () => import('./home/home.page').then(m => m.HomePage) },
  { path: 'forgot-password', loadComponent: () => import('./pages/forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage) },
  { path: 'reset-password', loadComponent: () => import('./pages/reset-password/reset-password.page').then(m => m.ResetPasswordPage) },
  { path: 'inventory', canActivate: [AuthGuard], loadChildren: () => import('./modules/inventory/inventory.module').then(m => m.InventoryModule) },
  { path: 'orders', canActivate: [AuthGuard], loadChildren: () => import('./modules/purchase-orders/purchase-orders.module').then(m => m.PurchaseOrdersModule) },
  { path: 'alerts', canActivate: [AuthGuard], loadComponent: () => import('./modules/alerts/pages/list/alerts-list.page').then(m => m.AlertsListPage) },
  { path: 'sales-import', canActivate: [AuthGuard], loadComponent: () => import('./pages/sales-import/sales-import.page').then(m => m.SalesImportPage) },
  { path: 'reports', canActivate: [AuthGuard], loadComponent: () => import('./pages/reports/reports.page').then(m => m.ReportsPage) },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
