import type { UserRole } from "@/types";

export type PermissionAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "manageUsers"
  | "approve"
  | "readPurchasePrice"
  | "readMargins"
  | "readStockMovements"
  | "recordPayment"
  | "cancelPayment"
  | "manageCheque"
  | "createReminder"
  | "manageCredit"
  | "manageCompany"
  | "importDemo";

export type PermissionResource =
  | "dashboard"
  | "clients"
  | "catalogue"
  | "documents"
  | "contracts"
  | "elevators"
  | "interventions"
  | "counters"
  | "stock"
  | "collections"
  | "payments"
  | "reminders"
  | "users"
  | "company";

type Permission = `${PermissionAction}:${PermissionResource | "*"}`;

const allResources: readonly PermissionResource[] = [
  "dashboard",
  "clients",
  "catalogue",
  "documents",
  "contracts",
  "elevators",
  "interventions",
  "counters",
  "stock",
  "collections",
  "payments",
  "reminders",
  "users",
  "company",
];

const ownerPermissions: readonly Permission[] = [
  "read:*",
  "create:*",
  "update:*",
  "delete:*",
  "manageUsers:users",
  "approve:*",
  "readPurchasePrice:catalogue",
  "readMargins:catalogue",
  "readPurchasePrice:stock",
  "readStockMovements:stock",
  "recordPayment:payments",
  "cancelPayment:payments",
  "manageCheque:payments",
  "createReminder:reminders",
  "manageCredit:clients",
  "manageCompany:company",
  "importDemo:company",
];

const dgPermissions: readonly Permission[] = [
  "read:*",
  "create:*",
  "update:*",
  "approve:*",
  "readPurchasePrice:catalogue",
  "readMargins:catalogue",
  "readPurchasePrice:stock",
  "readStockMovements:stock",
  "recordPayment:payments",
  "manageCheque:payments",
  "createReminder:reminders",
];

const commercialPermissions: readonly Permission[] = [
  "read:dashboard",
  "read:clients",
  "create:clients",
  "update:clients",
  "read:catalogue",
  "read:stock",
  "read:company",
  "read:documents",
  "create:documents",
  "update:documents",
  "read:contracts",
  "read:elevators",
  "read:counters",
  "read:interventions",
  "read:payments",
  "read:reminders",
  "createReminder:reminders",
  "recordPayment:payments",
];

const rolePermissions: Record<UserRole, readonly Permission[]> = {
  owner: ownerPermissions,
  dg: dgPermissions,
  commercial: commercialPermissions,
};

export function can(
  role: UserRole | null | undefined,
  action: PermissionAction,
  resource: PermissionResource,
): boolean {
  if (!role || !allResources.includes(resource)) return false;
  const permissions = rolePermissions[role];
  return (
    permissions.includes(`${action}:${resource}` as Permission) ||
    permissions.includes(`${action}:*`)
  );
}

export function roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    owner: "Propriétaire",
    dg: "Directeur Général",
    commercial: "Commercial",
  };
  return labels[role];
}