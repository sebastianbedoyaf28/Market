import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, AlertController, LoadingController, ToastController } from '@ionic/angular';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, finalize, switchMap, takeUntil } from 'rxjs/operators';
import { UsersService } from '../../services/users.service';
import { RolesService } from '../../../roles/services/roles.service';
import { Role } from '../../../roles/models/role.model';
import { AppUser, UpsertUserPayload } from '../../models/user.model';
import { UserContextService } from '../../../../core/services/user-context.service';
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
  templateUrl: './user-form.page.html',
  styleUrls: ['./user-form.page.scss'],
})
export class UserFormPage implements OnInit, OnDestroy {
  roles: Role[] = [];
  loading = false;
  saving = false;
  isEdit = false;
  userId?: string;
  currentUserId?: string;
  form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    roleId: ['', Validators.required],
    phone: [''],
    isActive: [true],
    password: [''],
  });
  private readonly destroy$ = new Subject<void>();
  
  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly toastCtrl: ToastController,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly userContext: UserContextService,
  ) {}
  ngOnInit(): void {
    this.loadRoles();
    this.updatePasswordValidators();
    this.userContext.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => (this.currentUserId = user?.id ?? undefined));
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap(params => {
          const id = params.get('id');
          if (!id || id === 'new') {
            this.isEdit = false;
            this.userId = undefined;
            this.updatePasswordValidators();
            return of(null);
          }
          this.isEdit = true;
          this.userId = id;
          this.updatePasswordValidators();
          this.loading = true;
          return this.usersService.getById(id).pipe(
            catchError(err => {
              void this.showToast(err.message ?? 'No se pudo cargar el usuario.', 'danger');
              void this.router.navigate(['../'], { relativeTo: this.route });
              return of(null);
            }),
            finalize(() => (this.loading = false)),
          );
        }),
      )
      .subscribe(user => {
        if (user) {
          this.populateForm(user);
        } else if (!this.isEdit) {
          this.form.reset({
            fullName: '',
            email: '',
            roleId: '',
            phone: '',
            isActive: true,
            password: '',
          });
        }
      });
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isEdit && this.userId === this.currentUserId && !this.form.controls.isActive.value) {
      await this.showToast('No puedes desactivar tu propio usuario.', 'warning');
      this.form.controls.isActive.setValue(true);
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Guardando...' });
    await loading.present();
    this.saving = true;
    const payload: UpsertUserPayload = {
      fullName: this.form.controls.fullName.value.trim(),
      email: this.form.controls.email.value.trim().toLowerCase(),
      roleId: this.form.controls.roleId.value,
      phone: this.form.controls.phone.value?.trim() || null,
      isActive: this.form.controls.isActive.value,
    };
    const passwordValue = this.form.controls.password.value?.trim();
    if (passwordValue) {
      payload.password = passwordValue;
    }
    const request$ = this.isEdit && this.userId
      ? this.usersService.update(this.userId, payload)
      : this.usersService.create(payload);
    request$
      .pipe(
        takeUntil(this.destroy$),
        finalize(async () => {
          this.saving = false;
          await loading.dismiss();
        }),
      )
      .subscribe({
        next: async user => {
          await this.showToast('Usuario guardado correctamente.', 'success');
          await this.router.navigate(['../'], { relativeTo: this.route });
          if (this.isEdit && user.id === this.currentUserId) {
            this.userContext.reload();
          }
        },
        error: async err => {
          await this.showToast(err.message ?? 'No se pudo guardar el usuario.', 'danger');
        },
      });
  }
  async deleteUser() {
    if (!this.isEdit || !this.userId || this.userId === this.currentUserId) {
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Eliminar usuario',
      message: 'Deseas eliminar este usuario? Esta accion no se puede deshacer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => this.performDelete(),
        },
      ],
    });
    await alert.present();
  }
  cancel() {
    void this.router.navigate(['../'], { relativeTo: this.route });
  }
  private loadRoles() {
    this.rolesService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: roles => (this.roles = roles),
        error: () => {
          void this.showToast('No se pudieron cargar los roles.', 'danger');
        },
      });
  }
  private populateForm(user: AppUser) {
    this.form.patchValue({
      fullName: user.fullName,
      email: user.email,
      roleId: user.roleId,
      phone: user.phone ?? '',
      isActive: user.isActive,
      password: '',
    });
  }
  private performDelete() {
    if (!this.userId) {
      return;
    }
    this.usersService
      .delete(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async () => {
          await this.showToast('Usuario eliminado.', 'success');
          await this.router.navigate(['../'], { relativeTo: this.route });
        },
        error: async err => {
          await this.showToast(err.message ?? 'No se pudo eliminar el usuario.', 'danger');
        },
      });
  }
  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
    });
    await toast.present();
  }

  private updatePasswordValidators(): void {
    const control = this.form.controls.password;
    if (!control) {
      return;
    }

    if (this.isEdit) {
      control.setValidators([]);
      control.setValue('', { emitEvent: false });
    } else {
      control.setValidators([Validators.required, Validators.minLength(8)]);
    }
    control.updateValueAndValidity();
  }
}
