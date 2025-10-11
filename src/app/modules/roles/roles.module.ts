import { NgModule } from '@angular/core';
import { RolesRoutingModule } from './roles-routing.module';
import { RolesListPage } from './pages/list/roles-list.page';
import { RoleFormPage } from './pages/form/role-form.page';

@NgModule({
  imports: [RolesRoutingModule, RolesListPage, RoleFormPage],
})
export class RolesModule {}
