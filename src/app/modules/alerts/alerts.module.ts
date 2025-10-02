import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { AlertsRoutingModule } from './alerts.routing';

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule, AlertsRoutingModule],
})
export class AlertsModule {}


