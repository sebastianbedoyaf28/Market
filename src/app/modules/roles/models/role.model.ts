export type RoleCode = 'ADMIN' | 'MANAGER' | 'WAREHOUSE' | 'CASHIER' | string;

export interface Role {
  id: string;
  code: RoleCode;
  name: string;
  description: string;
  permissions: string[];
  createdAt: string;
}

export interface RoleInput {
  code: RoleCode;
  name: string;
  description: string;
  permissions: string[];
}

