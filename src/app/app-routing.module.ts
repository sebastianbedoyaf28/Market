import { NgModule } from '@angular/core';
import { RouterModule, Routes, PreloadAllModules } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage) },
  { path: 'home',  canActivate: [AuthGuard], loadComponent: () => import('./home/home.page').then(m => m.HomePage) },
  { path: 'inventory', canActivate: [AuthGuard], loadChildren: () => import('./modules/inventory/inventory.module').then(m => m.InventoryModule) },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
