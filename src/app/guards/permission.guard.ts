import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Observable, of } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { PermissionService } from '../services/permission.service';

@Injectable({ providedIn: 'root' })
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly permission: PermissionService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController,
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    const requiredPermissions: string[] | undefined = route.data?.['permissions'];

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return of(true);
    }

    return this.permission.has$(requiredPermissions).pipe(
      take(1),
      map(hasPermission => {
        if (hasPermission) {
          return true;
        }

        this.notifyAccessDenied();
        return this.router.createUrlTree(['/home'], {
          queryParams: { denied: state.url },
        });
      }),
    );
  }

  private async notifyAccessDenied() {
    const toast = await this.toastCtrl.create({
      message: 'No tienes permisos para acceder a esta sección.',
      duration: 2500,
      color: 'warning',
    });
    await toast.present();
  }
}

