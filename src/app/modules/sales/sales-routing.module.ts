import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'list',
    loadComponent: () => import('./pages/list/sales-list.page').then(m => m.SalesListPage)
  },
  {
    path: 'detail/:id',
    loadComponent: () => import('./pages/detail/sales-detail.page').then(m => m.SalesDetailPage)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SalesRoutingModule {}

