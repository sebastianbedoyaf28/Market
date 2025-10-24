import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { UsersService } from '../../services/users.service';
import { AppUser } from '../../models/user.model';
import { UserContextService } from '../../../../core/services/user-context.service';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './users-list.page.html',
  styleUrls: ['./users-list.page.scss'],
})
export class UsersListPage implements OnDestroy {
  users: AppUser[] = [];
  loading = false;
  error?: string;
  canManage = true;
  currentUserId?: string;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly usersService: UsersService,
    private readonly router: Router,
    private readonly alertCtrl: AlertController,
    private readonly toastCtrl: ToastController,
    private readonly userContext: UserContextService,
  ) {
    this.userContext.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => (this.currentUserId = user?.id));
  }

  ionViewWillEnter() {
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByUserId(_index: number, user: AppUser): string {
    return user.id;
  }

  refresh(event?: CustomEvent) {
    this.usersService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: data => {
          this.users = data;
          this.error = undefined;
          event?.detail.complete();
        },
        error: err => {
          this.error = err.message ?? 'No se pudieron cargar los usuarios.';
          event?.detail.complete();
        },
      });
  }

  newUser() {
    void this.router.navigate(['users', 'new']);
  }

  editUser(user: AppUser) {
    void this.router.navigate(['users', user.id]);
  }

  async confirmDelete(user: AppUser) {
    if (!this.canManage || user.id === this.currentUserId) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Eliminar usuario',
      message: `Deseas eliminar a <strong>${user.fullName}</strong>?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => this.deleteUser(user),
        },
      ],
    });

    await alert.present();
  }

  async toggleActive(user: AppUser, event: CustomEvent) {
    const isActive = Boolean(event.detail.checked);
    this.usersService
      .update(user.id, {
        fullName: user.fullName,
        email: user.email,
        roleId: user.roleId,
        phone: user.phone,
        isActive,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: updated => {
          this.users = this.users.map(item => (item.id === updated.id ? updated : item));
        },
        error: async err => {
          const toggle = event.target as HTMLIonToggleElement | null;
          if (toggle) {
            toggle.checked = user.isActive;
          }
          const toast = await this.toastCtrl.create({
            message: err.message ?? 'No se pudo actualizar el estado.',
            duration: 2500,
            color: 'danger',
          });
          await toast.present();
        },
      });
  }

  loadUsers() {
    this.loading = true;
    this.usersService
      .list()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: data => {
          this.users = data;
          this.error = undefined;
        },
        error: err => {
          this.error = err.message ?? 'No se pudieron cargar los usuarios.';
        },
      });
  }

  private deleteUser(user: AppUser) {
    this.usersService
      .delete(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async () => {
          this.users = this.users.filter(item => item.id !== user.id);
          const toast = await this.toastCtrl.create({
            message: 'Usuario eliminado correctamente.',
            duration: 2000,
            color: 'success',
          });
          await toast.present();
        },
        error: async err => {
          const toast = await this.toastCtrl.create({
            message: err.message ?? 'No se pudo eliminar el usuario.',
            duration: 2500,
            color: 'danger',
          });
          await toast.present();
        },
      });
  }
}



