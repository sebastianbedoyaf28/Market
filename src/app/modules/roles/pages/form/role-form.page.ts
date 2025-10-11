import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, AlertController, LoadingController, ToastController } from '@ionic/angular';
import { FormBuilder, Validators, AbstractControl, ValidationErrors, ReactiveFormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, finalize, switchMap, takeUntil } from 'rxjs/operators';
import { RolesService } from '../../services/roles.service';
import { Role } from '../../models/role.model';
import { PERMISSION_GROUPS } from '../../../../core/permissions';

const PROTECTED_ROLE_CODES = new Set(['ADMIN', 'MANAGER', 'WAREHOUSE', 'CASHIER']);

@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
  templateUrl: './role-form.page.html',
  styleUrls: ['./role-form.page.scss'],
})
export class RoleFormPage implements OnInit, OnDestroy {
  permissionGroups = PERMISSION_GROUPS;
  loading = false;
  saving = false;
  isEdit = false;
  isProtected = false;
  roleId?: string;

  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Z0-9_]+$/)]],
    name: ['', [Validators.required]],
    description: ['', [Validators.required]],
    permissions: this.fb.nonNullable.control<string[]>([], {
      validators: [Validators.required, RoleFormPage.minArrayLength(1)],
    }),
  });

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly rolesService: RolesService,
    private readonly toastCtrl: ToastController,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
  ) {}

  static minArrayLength(length: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      const value: unknown = control.value;
      if (Array.isArray(value) && value.length >= length) {
        return null;
      }
      return { minArrayLength: length };
    };
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap(params => {
          const id = params.get('id');
          if (!id || id === 'new') {
            this.isEdit = false;
            this.roleId = undefined;
            return of(null);
          }
          this.isEdit = true;
          this.roleId = id;
          this.loading = true;
          return this.rolesService.getById(id).pipe(
            catchError(err => {
              void this.showToast(err.message ?? 'No se pudo cargar el rol.', 'danger');
              void this.router.navigate(['../'], { relativeTo: this.route });
              return of(null);
            }),
            finalize(() => (this.loading = false)),
          );
        }),
      )
      .subscribe(role => {
        if (role) {
          this.populateForm(role);
        } else if (!this.isEdit) {
          this.form.reset({
            code: '',
            name: '',
            description: '',
            permissions: [],
          });
          this.form.controls.code.enable({ emitEvent: false });
          this.isProtected = false;
        }
      });

    this.form
      .get('code')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(code => {
        if (code) {
          const normalized = code.toUpperCase().replace(/[^A-Z0-9_]/g, '');
          if (normalized !== code) {
            this.form.get('code')?.setValue(normalized, { emitEvent: false });
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePermission(permission: string, checked: boolean) {
    const control = this.form.controls.permissions;
    const current = new Set(control.value ?? []);
    if (checked) {
      current.add(permission);
    } else {
      current.delete(permission);
    }
    control.setValue(Array.from(current.values()));
    control.markAsDirty();
    control.markAsTouched();
  }

  isPermissionSelected(permission: string): boolean {
    return this.form.controls.permissions.value.includes(permission);
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Guardando...' });
    await loading.present();
    this.saving = true;

    const payload = {
      code: this.form.controls.code.value,
      name: this.form.controls.name.value.trim(),
      description: this.form.controls.description.value.trim(),
      permissions: this.form.controls.permissions.value,
    };

    const request$ = this.isEdit && this.roleId
      ? this.rolesService.update(this.roleId, payload)
      : this.rolesService.create(payload);

    request$
      .pipe(
        takeUntil(this.destroy$),
        finalize(async () => {
          this.saving = false;
          await loading.dismiss();
        }),
      )
      .subscribe({
        next: async role => {
          await this.showToast('Rol guardado correctamente.', 'success');
          await this.router.navigate(['../'], { relativeTo: this.route });
          // In edit mode, keep form updated with sanitized data
          if (this.isEdit) {
            this.populateForm(role);
          } else {
            this.form.reset({ code: '', name: '', description: '', permissions: [] });
          }
        },
        error: async err => {
          await this.showToast(err.message ?? 'No se pudo guardar el rol.', 'danger');
        },
      });
  }

  async deleteRole() {
    if (!this.isEdit || !this.roleId || this.isProtected) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Eliminar rol',
      message: 'ÂDeseas eliminar este rol? Esta acciÃ³n no se puede deshacer.',
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

  private performDelete() {
    if (!this.roleId) {
      return;
    }

    this.rolesService
      .delete(this.roleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async () => {
          await this.showToast('Rol eliminado.', 'success');
          await this.router.navigate(['../'], { relativeTo: this.route });
        },
        error: async err => {
          await this.showToast(err.message ?? 'No se pudo eliminar el rol.', 'danger');
        },
      });
  }

  private populateForm(role: Role) {
    this.form.patchValue({
      code: role.code,
      name: role.name,
      description: role.description,
      permissions: role.permissions ?? [],
    });
    this.isProtected = PROTECTED_ROLE_CODES.has(role.code);
    if (this.isProtected) {
      this.form.controls.code.disable({ emitEvent: false });
    } else {
      this.form.controls.code.enable({ emitEvent: false });
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
    });
    await toast.present();
  }

  cancel() {
    void this.router.navigate(['../'], { relativeTo: this.route });
  }
}



