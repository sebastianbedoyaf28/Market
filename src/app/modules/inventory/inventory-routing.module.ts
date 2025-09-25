import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InventoryPage } from './pages/inventory/inventory.page';
import { ProductDetailPage } from './pages/product-detail/product-detail.page';
import { ProductFormPage } from './pages/product-form/product-form.page';

const routes: Routes = [
  {
    path: '',
    component: InventoryPage,
  },
  {
    path: 'product/new',
    component: ProductFormPage,
  },
  {
    path: 'product/:id',
    component: ProductDetailPage,
  },
  {
    path: 'product/:id/edit',
    component: ProductFormPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InventoryRoutingModule {}
