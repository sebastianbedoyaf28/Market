import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/list/purchase-order-list.page').then(m => m.PurchaseOrderListPage) },
  { path: 'new', loadComponent: () => import('./pages/form/purchase-order-form.page').then(m => m.PurchaseOrderFormPage) },
  { path: ':id', loadComponent: () => import('./pages/detail/purchase-order-detail.page').then(m => m.PurchaseOrderDetailPage) },
];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class PurchaseOrdersRoutingModule {}


