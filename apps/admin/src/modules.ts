import {
  ClipboardList,
  Wallet,
  Star,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AdminDashboard, AdminRole } from "@proj/shared";

export interface ModulePage {
  /** Query string appended to the module root, "" for the default page. */
  query: string;
  label: string;
  /** Live count shown on the right of the sidebar row, when there is one. */
  count?: (d: AdminDashboard) => number | null;
}

export interface AppModule {
  key: string;
  name: string;
  description: string;
  path: string;
  icon: LucideIcon;
  /** Token name used for the tile tint and module icon. */
  tint: string;
  /** Roles that may open this module. Hidden, never disabled, for everyone else. */
  roles: AdminRole[];
  pages: ModulePage[];
  /** Short "there is work waiting" line on the Home tile. */
  nudge?: (d: AdminDashboard) => string | null;
}

/** The property this console is scoped to — never show global lists. */
export const SCOPE = "Thapar, Patiala";

const ALL_ROLES: AdminRole[] = ["ops_excellence", "warden"];

export const MODULES: AppModule[] = [
  {
    key: "registrations",
    name: "Registrations",
    description: "Check IDs and approve new residents",
    path: "/registrations",
    icon: UserCheck,
    tint: "--accent",
    roles: ALL_ROLES,
    pages: [
      {
        query: "",
        label: "Waiting for review",
        count: (d) => d.registrations.pending || null,
      },
      { query: "?status=approved", label: "Approved" },
      { query: "?status=rejected", label: "Turned down" },
    ],
    nudge: (d) =>
      d.registrations.pending ? `${d.registrations.pending} waiting` : null,
  },
  {
    key: "onboarding",
    name: "Move-in",
    description: "Documents, agreements and settling in",
    path: "/onboarding",
    icon: UserPlus,
    tint: "--info",
    roles: ALL_ROLES,
    pages: [
      { query: "", label: "Everyone moving in" },
      { query: "?filter=kyc", label: "Documents to check" },
      { query: "?filter=lease", label: "Agreements unsigned" },
      { query: "?filter=done", label: "Fully moved in" },
    ],
  },
  {
    key: "requests",
    name: "Requests",
    description: "Repairs, laundry, complaints and visits",
    path: "/requests",
    icon: ClipboardList,
    tint: "--warning",
    roles: ALL_ROLES,
    pages: [
      { query: "", label: "All requests", count: (d) => d.openRequests || null },
      {
        query: "?kind=maintenance",
        label: "Maintenance",
        count: (d) => d.requestsByKind.maintenance || null,
      },
      {
        query: "?kind=laundry",
        label: "Laundry",
        count: (d) => d.requestsByKind.laundry || null,
      },
      {
        query: "?kind=complaint",
        label: "Complaints",
        count: (d) => d.requestsByKind.complaint || null,
      },
      {
        query: "?kind=visit",
        label: "Visits",
        count: (d) => d.requestsByKind.visit || null,
      },
    ],
    nudge: (d) => (d.openRequests ? `${d.openRequests} open` : null),
  },
  {
    key: "residents",
    name: "Residents",
    description: "Rooms, payments and attendance",
    path: "/residents",
    icon: Users,
    tint: "--success",
    roles: ALL_ROLES,
    pages: [
      {
        query: "",
        label: "Everyone",
        count: (d) => d.residents.total || null,
      },
      {
        query: "?filter=no_room",
        label: "Without a room",
        count: (d) => d.residents.total - d.residents.withRoom || null,
      },
      { query: "?filter=open_requests", label: "With open requests" },
    ],
    nudge: (d) => {
      const without = d.residents.total - d.residents.withRoom;
      return without > 0 ? `${without} without a room` : null;
    },
  },
  {
    key: "finance",
    name: "Money",
    description: "Invoices, payments and deposits",
    path: "/finance",
    icon: Wallet,
    tint: "--success",
    roles: ALL_ROLES,
    pages: [
      {
        query: "",
        label: "Invoices and dues",
        count: (d) => d.finance.overdueInvoices || null,
      },
      { query: "?view=payments", label: "Payments received" },
      {
        query: "?view=deposits",
        label: "Deposits",
        count: (d) => d.finance.refundsPending || null,
      },
    ],
    nudge: (d) =>
      d.finance.outstanding
        ? `₹${d.finance.outstanding.toLocaleString("en-IN")} outstanding`
        : null,
  },
  {
    key: "feedback",
    name: "Feedback",
    description: "What residents are rating",
    path: "/feedback",
    icon: Star,
    tint: "--pop",
    roles: ALL_ROLES,
    pages: [{ query: "", label: "All feedback" }],
    nudge: (d) => (d.averageRating ? `${d.averageRating} average` : null),
  },
];

/** Role-gating is a filter, not a disabled state — hidden modules don't exist. */
export function modulesFor(role: AdminRole): AppModule[] {
  return MODULES.filter((m) => m.roles.includes(role));
}

export function moduleAt(pathname: string): AppModule | null {
  return MODULES.find((m) => pathname.startsWith(m.path)) ?? null;
}
