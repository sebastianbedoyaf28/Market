export interface PermissionAction {
  id: string;
  label: string;
  description?: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  actions: PermissionAction[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'inventory',
    label: 'Inventario',
    actions: [
      { id: 'inventory:read', label: 'Consultar inventario' },
      { id: 'inventory:write', label: 'Gestionar inventario', description: 'Altas, bajas y ajustes de stock.' },
    ],
  },
  {
    id: 'orders',
    label: 'Pedidos',
    actions: [
      { id: 'orders:read', label: 'Consultar pedidos' },
      { id: 'orders:write', label: 'Crear/recibir pedidos' },
      { id: 'orders:authorize', label: 'Autorizar pedidos' },
    ],
  },
  {
    id: 'reports',
    label: 'Reportes y KPIs',
    actions: [
      { id: 'reports:read', label: 'Consultar reportes' },
      { id: 'reports:write', label: 'Generar/exportar reportes' },
      { id: 'kpis:view', label: 'Visualizar KPIs' },
    ],
  },
  {
    id: 'alerts',
    label: 'Alertas',
    actions: [
      { id: 'alerts:read', label: 'Consultar alertas' },
      { id: 'alerts:write', label: 'Gestionar alertas' },
    ],
  },
  {
    id: 'sales',
    label: 'Ventas',
    actions: [{ id: 'sales:import', label: 'Importar ventas manualmente' }],
  },
  {
    id: 'users',
    label: 'Usuarios',
    actions: [
      { id: 'users:read', label: 'Consultar usuarios' },
      { id: 'users:write', label: 'Gestionar usuarios' },
    ],
  },
  {
    id: 'roles',
    label: 'Roles',
    actions: [
      { id: 'roles:read', label: 'Consultar roles' },
      { id: 'roles:write', label: 'Gestionar roles' },
    ],
  },
];

export const ALL_PERMISSION_IDS = PERMISSION_GROUPS.flatMap(group => group.actions.map(action => action.id));

