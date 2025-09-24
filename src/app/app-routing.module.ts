import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage) },
  { path: 'home',  canActivate: [AuthGuard], loadComponent: () => import('./home/home.page').then(m => m.HomePage) },
  { path: '', redirectTo: 'login', pathMatch: 'full' }, // <— aquí el cambio
  // { path: '**', redirectTo: 'login' }, // opcional
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
