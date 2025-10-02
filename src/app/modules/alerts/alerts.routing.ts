import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/list/alerts-list.page').then(m => m.AlertsListPage) },
];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class AlertsRoutingModule {}


