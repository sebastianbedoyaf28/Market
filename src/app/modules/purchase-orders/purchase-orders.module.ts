import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { PurchaseOrdersRoutingModule } from './purchase-orders.routing';

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule, PurchaseOrdersRoutingModule],
})
export class PurchaseOrdersModule {}


