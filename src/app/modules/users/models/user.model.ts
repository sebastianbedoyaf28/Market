export interface AppUser {
  id: string;
  authUserId?: string | null;
  fullName: string;
  email: string;
  roleId: string;
  roleName?: string;
  permissions?: string[];
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertUserPayload {
  fullName: string;
  email: string;
  roleId: string;
  phone?: string | null;
  isActive?: boolean;
  password?: string | null;
}
