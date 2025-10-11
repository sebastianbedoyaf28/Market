import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { RolesService } from '../../services/roles.service';
import { Role } from '../../models/role.model';

const PROTECTED_ROLE_CODES = new Set(['ADMIN', 'MANAGER', 'WAREHOUSE', 'CASHIER']);

@Component({
  selector: 'app-roles-list',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './roles-list.page.html',
  styleUrls: ['./roles-list.page.scss'],
})
export class RolesListPage implements OnDestroy {
  roles: Role[] = [];
  loading = false;
  error?: string;
  canManage = true;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly rolesService: RolesService,
    private readonly router: Router,
    private readonly alertCtrl: AlertController,
    private readonly toastCtrl: ToastController,
  ) {}

  ionViewWillEnter() {
    this.loadRoles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByRoleId(_index: number, role: Role): string {
    return role.id;
  }

  refresh(event?: CustomEvent) {
    this.rolesService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: data => {
          this.roles = data;
          this.error = undefined;
          event?.detail.complete();
        },
        error: err => {
          this.error = err.message ?? 'No se pudieron cargar los roles.';
          event?.detail.complete();
        },
      });
  }

  async confirmDelete(role: Role) {
    if (!this.canManage || PROTECTED_ROLE_CODES.has(role.code)) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Eliminar rol',
      message: `Deseas eliminar el rol <strong>${role.name}</strong>?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => this.deleteRole(role),
        },
      ],
    });

    await alert.present();
  }

  newRole() {
    void this.router.navigate(['roles', 'new']);
  }

  editRole(role: Role) {
    void this.router.navigate(['roles', role.id]);
  }

  loadRoles() {
    this.loading = true;
    this.rolesService
      .list()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: data => {
          this.roles = data;
          this.error = undefined;
        },
        error: err => {
          this.error = err.message ?? 'No se pudieron cargar los roles.';
        },
      });
  }

  private deleteRole(role: Role) {
    this.rolesService
      .delete(role.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async () => {
          this.roles = this.roles.filter(item => item.id !== role.id);
          const toast = await this.toastCtrl.create({
            message: 'Rol eliminado correctamente.',
            duration: 2000,
            color: 'success',
          });
          await toast.present();
        },
        error: async err => {
          const toast = await this.toastCtrl.create({
            message: err.message ?? 'No se pudo eliminar el rol.',
            duration: 2500,
            color: 'danger',
          });
          await toast.present();
        },
      });
  }

  isProtected(role: Role): boolean {
    return PROTECTED_ROLE_CODES.has(role.code);
  }
}




