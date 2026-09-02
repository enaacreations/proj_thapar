import {
  Brush,
  CalendarDays,
  CalendarHeart,
  ClipboardList,
  LayoutGrid,
  MessageSquareWarning,
  ScanLine,
  Settings,
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

/**
 * Launcher tiles are the one place the console goes colourful, so each module
 * owns a fixed identity: `[gradFrom, gradTo, tint, tint2]`. The first pair
 * strokes the icon badge, the second washes the tile face. Literal hex rather
 * than tokens — these are per-module brand colours, not semantic roles, and
 * they read the same in both themes because every use is mixed into `--card`.
 */
export type TileGradient = readonly [
  gradFrom: string,
  gradTo: string,
  tint: string,
  tint2: string,
];

/**
 * Home is three doors, not fourteen. Everything that isn't the cross-module
 * queue or the console's own settings sits behind Operations, grouped by the
 * part of the job it belongs to — which is what `opsGroup` names.
 */
export type OpsGroup = "moving-in" | "services" | "house";

export const OPS_GROUP_LABELS: Record<OpsGroup, string> = {
  "moving-in": "Moving in",
  services: "Services residents ask for",
  house: "The house",
};

/** The order Operations lists its groups in, top to bottom. */
const OPS_GROUP_ORDER: OpsGroup[] = ["moving-in", "services", "house"];

export interface AppModule {
  key: string;
  name: string;
  description: string;
  path: string;
  icon: LucideIcon;
  /** Semantic token behind the sidebar's module chip, at 12% alpha. */
  tint: string;
  /** Launcher tile identity. See {@link TileGradient}. */
  gradient: TileGradient;
  /** Roles that may open this module. Hidden, never disabled, for everyone else. */
  roles: AdminRole[];
  pages: ModulePage[];
  /** Short "there is work waiting" line on the Home tile. */
  nudge?: (d: AdminDashboard) => string | null;
  /** Set on every module that lives behind Operations; absent on the three
   *  the launcher shows directly. */
  opsGroup?: OpsGroup;
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
    gradient: ["#FF9A3D", "#F2603C", "#FF9A3D", "#C2459A"],
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
    gradient: ["#3666CF", "#6FA0F0", "#6FA0F0", "#7C5CFF"],
    roles: ALL_ROLES,
    opsGroup: "moving-in",
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
    gradient: ["#0EA5A5", "#3666CF", "#2CB9B9", "#3666CF"],
    roles: ALL_ROLES,
    opsGroup: "moving-in",
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
    gradient: ["#D97706", "#E8602C", "#E5A13D", "#E8602C"],
    roles: ALL_ROLES,
    opsGroup: "services",
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
    gradient: ["#0891B2", "#0EA5A5", "#22B8CF", "#0EA5A5"],
    roles: ALL_ROLES,
    opsGroup: "services",
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
    gradient: ["#C73B33", "#E85D75", "#E0605A", "#C2459A"],
    roles: ALL_ROLES,
    opsGroup: "services",
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
    gradient: ["#7C5CFF", "#C2459A", "#9B82FF", "#C2459A"],
    roles: ALL_ROLES,
    opsGroup: "services",
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
    gradient: ["#F2603C", "#C2459A", "#F2703A", "#C2459A"],
    roles: ALL_ROLES,
    opsGroup: "services",
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
    icon: Brush,
    tint: "--success",
    gradient: ["#16A34A", "#0EA5A5", "#34C58A", "#0EA5A5"],
    roles: ALL_ROLES,
    opsGroup: "services",
    pages: [{ query: "", label: "Booked cleans", group: "tasks" }],
  },
  {
    key: "spaces",
    name: "Spaces",
    description: "Study room, gaming zone and BBQ bookings",
    path: "/spaces",
    icon: CalendarDays,
    tint: "--pop",
    gradient: ["#C2459A", "#7C5CFF", "#D06AB0", "#9B82FF"],
    roles: ALL_ROLES,
    opsGroup: "services",
    pages: [{ query: "", label: "Space bookings", group: "tasks" }],
  },
  {
    key: "residents",
    name: "Residents",
    description: "Rooms, payments and attendance",
    path: "/residents",
    icon: Users,
    tint: "--success",
    gradient: ["#E85D75", "#C2459A", "#E85D75", "#C2459A"],
    roles: ALL_ROLES,
    opsGroup: "house",
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
    gradient: ["#157F5B", "#3666CF", "#34A57F", "#3666CF"],
    roles: ALL_ROLES,
    opsGroup: "house",
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
    gradient: ["#FF9A3D", "#C2459A", "#FFB25C", "#C2459A"],
    roles: ALL_ROLES,
    opsGroup: "house",
    pages: [{ query: "", label: "All feedback", group: "requests" }],
    nudge: (d) => (d.averageRating ? `${d.averageRating} average` : null),
  },
  {
    key: "messdesk",
    name: "Mess counter",
    description: "Scan resident passes as plates go out",
    path: "/mess-counter",
    icon: ScanLine,
    tint: "--success",
    gradient: ["#157F5B", "#D97706", "#34A57F", "#E5A13D"],
    roles: ALL_ROLES,
    opsGroup: "services",
    pages: [{ query: "", label: "Scan passes", group: "tasks" }],
  },
  {
    key: "settings",
    name: "Settings",
    description: "Attendance geofence and other console settings",
    path: "/settings",
    icon: Settings,
    tint: "--muted",
    gradient: ["#6B7A8F", "#3666CF", "#8FA3B8", "#3666CF"],
    roles: ALL_ROLES,
    pages: [{ query: "", label: "Attendance geofence", group: "tasks" }],
  },
];

/**
 * Operations owns no list of its own — its screen is the index of everything
 * carrying an `opsGroup`. It is still a module, so the launcher tile, the
 * sidebar and back navigation all treat it like any other door.
 */
export const OPERATIONS: AppModule = {
  key: "operations",
  name: "Operations",
  description: "Move-in, services, residents and money",
  path: "/operations",
  icon: LayoutGrid,
  tint: "--info",
  gradient: ["#3666CF", "#6FA0F0", "#6FA0F0", "#7C5CFF"],
  roles: ALL_ROLES,
  pages: [],
  nudge: (d) => {
    if (d.registrations.pending) {
      return `${d.registrations.pending} waiting for review`;
    }
    const without = d.residents.total - d.residents.withRoom;
    return without > 0 ? `${without} without a room` : null;
  },
};

/** Role-gating is a filter, not a disabled state — hidden modules don't exist. */
export function modulesFor(role: AdminRole): AppModule[] {
  return MODULES.filter((m) => m.roles.includes(role));
}

/** The areas behind the Operations tile, in the order they're declared. */
export function operationsModules(role: AdminRole): AppModule[] {
  return MODULES.filter((m) => m.opsGroup && m.roles.includes(role));
}

/** Operations split into its groups, empty groups dropped. */
export function operationsGroups(
  role: AdminRole
): { group: OpsGroup; modules: AppModule[] }[] {
  const areas = operationsModules(role);
  return OPS_GROUP_ORDER.map((group) => ({
    group,
    modules: areas.filter((m) => m.opsGroup === group),
  })).filter((g) => g.modules.length > 0);
}

/**
 * The three tiles Home shows: the queue you sweep, everything else, and the
 * console's own settings. Operations is dropped when a role can open none of
 * the areas behind it, rather than opening onto an empty index.
 */
export function launcherModules(role: AdminRole): AppModule[] {
  const flat = MODULES.filter((m) => !m.opsGroup && m.roles.includes(role));
  const at = (key: string) => flat.find((m) => m.key === key);
  const hasAreas = operationsModules(role).length > 0;

  return [at("requests"), hasAreas ? OPERATIONS : undefined, at("settings")]
    .filter((m): m is AppModule => m !== undefined);
}

export function moduleAt(pathname: string): AppModule | null {
  // Longest path first, so /requests never swallows a module nested under it.
  return (
    [...MODULES, OPERATIONS]
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

/**
 * The count a module's default page carries, reused as the count beside its
 * row in the Operations sidebar — one number per area, already defined once.
 */
export function defaultCountOf(
  module: AppModule,
  data: AdminDashboard
): number | null {
  return module.pages[0]?.count?.(data) ?? null;
}
