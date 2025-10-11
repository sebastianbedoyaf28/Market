import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap, takeUntil } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { UsersService } from '../modules/users/services/users.service';
import { AppUser } from '../modules/users/models/user.model';

@Injectable({ providedIn: 'root' })
export class UserContextService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly user$ = new BehaviorSubject<AppUser | null>(null);

  readonly currentUser$: Observable<AppUser | null> = this.user$.asObservable();
  readonly permissions$: Observable<string[]> = this.currentUser$.pipe(
    map(user => user?.permissions ?? []),
  );

  constructor(private auth: AuthService, private users: UsersService) {
    this.auth.session$
      .pipe(
        map(session => session?.user?.email ?? null),
        distinctUntilChanged(),
        switchMap(email => (email ? this.users.getByEmail(email) : of(null))),
        catchError(() => of(null)),
        takeUntil(this.destroy$),
      )
      .subscribe(user => this.user$.next(user));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  reload(): void {
    const email = this.auth.user?.email;
    if (!email) {
      this.user$.next(null);
      return;
    }

    this.users
      .getByEmail(email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: user => this.user$.next(user),
        error: () => this.user$.next(null),
      });
  }

  hasPermission(permission: string | string[]): boolean {
    const required = Array.isArray(permission) ? permission : [permission];
    const current = this.user$.value;

    if (!current || !current.permissions?.length) {
      return false;
    }

    return required.every(item => current.permissions!.includes(item));
  }

  hasAnyPermission(permissions: string[]): boolean {
    const current = this.user$.value;
    if (!current || !current.permissions?.length) {
      return false;
    }

    return permissions.some(permission => current.permissions!.includes(permission));
  }
}
