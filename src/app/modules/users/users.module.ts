import { NgModule } from '@angular/core';
import { UsersRoutingModule } from './users-routing.module';
import { UsersListPage } from './pages/list/users-list.page';
import { UserFormPage } from './pages/form/user-form.page';

@NgModule({
  imports: [UsersRoutingModule, UsersListPage, UserFormPage],
})
export class UsersModule {}
