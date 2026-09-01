import {
  CalendarDays,
  CalendarHeart,
  ClipboardList,
  MessageSquareWarning,
  Sparkles,
  Star,
  UserCheck,
  UserPlus,
  Users,
  UtensilsCrossed,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type {
  AdminDashboard,
  AdminRole,
  ServiceRequestKind,
} from "@proj/shared";

/**
 * Every page belongs to one of two groups, and the sidebar says which:
 * things residents raised and are waiting on, versus work this console runs.
 * A module can carry either or both.
 */
export type PageGroup = "requests" | "tasks";

export const GROUP_LABELS: Record<PageGroup, string> = {
  requests: "Requests from residents",
  tasks: "Tasks you run",
};

export interface ModulePage {
  /** Query string appended to the module root, "" for the default page. */
  query: string;
  label: string;
  group: PageGroup;
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

/**
 * Request modules all filter the same feed the same way, so the status pages
 * are written once. The default page is everything still open, because that's
 * the only list anyone opens a request module to see.
 */
function statusPages(
  kind: ServiceRequestKind,
  openLabel = "Open"
): ModulePage[] {
  return [
    {
      query: "",
      label: openLabel,
      group: "requests",
      count: (d) => d.requestsByKind[kind] || null,
    },
    { query: "?status=submitted", label: "New", group: "requests" },
    { query: "?status=in_progress", label: "In progress", group: "requests" },
    { query: "?status=resolved", label: "Resolved", group: "requests" },
    { query: "?status=rejected", label: "Declined", group: "requests" },
  ];
}

/** Which module owns each kind of request, for links and back navigation. */
export const REQUEST_MODULE_PATH: Record<ServiceRequestKind, string> = {
  maintenance: "/maintenance",
  laundry: "/laundry",
  complaint: "/complaints",
  visit: "/visitors",
};

export const MODULES: AppModule[] = [
  {
    key: "requests",
    name: "All requests",
    description: "One queue across every module, for a morning sweep",
    path: "/requests",
    icon: ClipboardList,
    tint: "--warning",
    roles: ALL_ROLES,
    pages: [
      {
        query: "",
        label: "Everything open",
        group: "requests",
        count: (d) => d.openRequests || null,
      },
      { query: "?status=submitted", label: "New", group: "requests" },
      { query: "?status=in_progress", label: "In progress", group: "requests" },
      { query: "?status=resolved", label: "Resolved", group: "requests" },
      { query: "?status=rejected", label: "Declined", group: "requests" },
    ],
    nudge: (d) => (d.openRequests ? `${d.openRequests} open` : null),
  },
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
        group: "requests",
        count: (d) => d.registrations.pending || null,
      },
      { query: "?status=approved", label: "Approved", group: "requests" },
      { query: "?status=rejected", label: "Turned down", group: "requests" },
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
      { query: "", label: "Everyone moving in", group: "tasks" },
      { query: "?filter=kyc", label: "Documents to check", group: "tasks" },
      { query: "?filter=lease", label: "Agreements unsigned", group: "tasks" },
      { query: "?filter=done", label: "Fully moved in", group: "tasks" },
    ],
  },
  {
    key: "maintenance",
    name: "Maintenance",
    description: "Repairs residents have reported",
    path: "/maintenance",
    icon: Wrench,
    tint: "--warning",
    roles: ALL_ROLES,
    pages: statusPages("maintenance"),
    nudge: (d) =>
      d.requestsByKind.maintenance
        ? `${d.requestsByKind.maintenance} open`
        : null,
  },
  {
    key: "laundry",
    name: "Laundry",
    description: "Pickups residents booked, and where each bag is",
    path: "/laundry",
    icon: Sparkles,
    tint: "--info",
    roles: ALL_ROLES,
    pages: [
      ...statusPages("laundry", "Open pickups"),
      { query: "?view=board", label: "Pipeline board", group: "tasks" },
    ],
    nudge: (d) =>
      d.requestsByKind.laundry ? `${d.requestsByKind.laundry} open` : null,
  },
  {
    key: "complaints",
    name: "Complaints",
    description: "What residents are unhappy about",
    path: "/complaints",
    icon: MessageSquareWarning,
    tint: "--danger",
    roles: ALL_ROLES,
    pages: statusPages("complaint"),
    nudge: (d) =>
      d.requestsByKind.complaint ? `${d.requestsByKind.complaint} open` : null,
  },
  {
    key: "visitors",
    name: "Visitors",
    description: "Passes residents have asked for",
    path: "/visitors",
    icon: CalendarHeart,
    tint: "--pop",
    roles: ALL_ROLES,
    pages: statusPages("visit"),
    nudge: (d) =>
      d.requestsByKind.visit ? `${d.requestsByKind.visit} open` : null,
  },
  {
    key: "food",
    name: "Food",
    description: "Mess quality and guest meals",
    path: "/food",
    icon: UtensilsCrossed,
    tint: "--accent",
    roles: ALL_ROLES,
    pages: [
      { query: "?view=guests", label: "Guest meals", group: "requests" },
      { query: "", label: "Mess quality", group: "tasks" },
    ],
    nudge: (d) => (d.averageRating ? `${d.averageRating} average` : null),
  },
  {
    key: "housekeeping",
    name: "Housekeeping",
    description: "Cleans booked, and who is out doing them",
    path: "/housekeeping",
    icon: Sparkles,
    tint: "--success",
    roles: ALL_ROLES,
    pages: [{ query: "", label: "Booked cleans", group: "tasks" }],
  },
  {
    key: "spaces",
    name: "Spaces",
    description: "Study room, gaming zone and BBQ bookings",
    path: "/spaces",
    icon: CalendarDays,
    tint: "--pop",
    roles: ALL_ROLES,
    pages: [{ query: "", label: "Space bookings", group: "tasks" }],
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
        group: "tasks",
        count: (d) => d.residents.total || null,
      },
      {
        query: "?filter=no_room",
        label: "Without a room",
        group: "tasks",
        count: (d) => d.residents.total - d.residents.withRoom || null,
      },
      {
        query: "?filter=open_requests",
        label: "With open requests",
        group: "tasks",
      },
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
        group: "tasks",
        count: (d) => d.finance.overdueInvoices || null,
      },
      { query: "?view=payments", label: "Payments received", group: "tasks" },
      {
        query: "?view=deposits",
        label: "Deposits",
        group: "tasks",
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
    pages: [{ query: "", label: "All feedback", group: "requests" }],
    nudge: (d) => (d.averageRating ? `${d.averageRating} average` : null),
  },
];

/** Role-gating is a filter, not a disabled state — hidden modules don't exist. */
export function modulesFor(role: AdminRole): AppModule[] {
  return MODULES.filter((m) => m.roles.includes(role));
}

export function moduleAt(pathname: string): AppModule | null {
  // Longest path first, so /requests never swallows a module nested under it.
  return (
    [...MODULES]
      .sort((a, b) => b.path.length - a.path.length)
      .find((m) => pathname === m.path || pathname.startsWith(`${m.path}/`)) ??
    null
  );
}

/** The groups a module actually uses, in the order the sidebar shows them. */
export function groupsOf(module: AppModule): PageGroup[] {
  return (["requests", "tasks"] as PageGroup[]).filter((g) =>
    module.pages.some((p) => p.group === g)
  );
}
