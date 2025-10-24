import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserContextService } from './user-context.service';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  constructor(private readonly userContext: UserContextService) {}

  has$(permission: string | string[]): Observable<boolean> {
    const required = Array.isArray(permission) ? permission : [permission];
    return this.userContext.permissions$.pipe(
      map(permissions => required.every(item => permissions.includes(item))),
    );
  }

  has(permission: string | string[]): boolean {
    return this.userContext.hasPermission(permission);
  }

  hasAny$(permissions: string[]): Observable<boolean> {
    return this.userContext.permissions$.pipe(
      map(current => permissions.some(permission => current.includes(permission))),
    );
  }

  hasAny(permissions: string[]): boolean {
    return this.userContext.hasAnyPermission(permissions);
  }
}

