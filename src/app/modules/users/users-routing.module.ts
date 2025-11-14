import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionGuard } from '../../core/guards/permission.guard';
import { UsersListPage } from './pages/list/users-list.page';
import { UserFormPage } from './pages/form/user-form.page';

const routes: Routes = [
  {
    path: '',
    component: UsersListPage,
    canActivate: [PermissionGuard],
    data: { permissions: ['users:read'] },
  },
  {
    path: 'new',
    component: UserFormPage,
    canActivate: [PermissionGuard],
    data: { permissions: ['users:write'] },
  },
  {
    path: ':id',
    component: UserFormPage,
    canActivate: [PermissionGuard],
    data: { permissions: ['users:write'] },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UsersRoutingModule {}
