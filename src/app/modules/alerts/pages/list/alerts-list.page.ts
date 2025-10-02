import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AlertsService, AlertItem } from '../../services/alerts.service';

@Component({
  standalone: true,
  selector: 'app-alerts-list',
  templateUrl: './alerts-list.page.html',
  styleUrls: ['./alerts-list.page.scss'],
  imports: [CommonModule, IonicModule],
})
export class AlertsListPage implements OnInit {
  loading = false;
  alerts: AlertItem[] = [];

  constructor(private svc: AlertsService) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading = true;
    try {
      this.alerts = await this.svc.list();
    } finally {
      this.loading = false;
    }
  }
}


