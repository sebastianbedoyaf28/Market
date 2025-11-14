import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionGuard } from '../../core/guards/permission.guard';
import { RolesListPage } from './pages/list/roles-list.page';
import { RoleFormPage } from './pages/form/role-form.page';

const routes: Routes = [
  {
    path: '',
    component: RolesListPage,
    canActivate: [PermissionGuard],
    data: { permissions: ['roles:read'] },
  },
  {
    path: 'new',
    component: RoleFormPage,
    canActivate: [PermissionGuard],
    data: { permissions: ['roles:write'] },
  },
  {
    path: ':id',
    component: RoleFormPage,
    canActivate: [PermissionGuard],
    data: { permissions: ['roles:write'] },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RolesRoutingModule {}
