import {
  Bed,
  ClipboardCheck,
  CalendarHeart,
  ClipboardList,
  CreditCard,
  MessageSquareWarning,
  QrCode,
  ScanFace,
  Shirt,
  Star,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";

export type ModuleGroup = "daily" | "services" | "account";

export const MODULE_GROUPS: { key: ModuleGroup; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "services", label: "Services" },
  { key: "account", label: "Account" },
];

export interface ModuleTile {
  key: string;
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  group: ModuleGroup;
  /** Palette key used to tint the tile's icon chip. */
  tint: "accent" | "info" | "success" | "warning" | "pop" | "danger";
  /** Words the Home search matches against, beyond name and description. */
  keywords: string[];
}

/**
 * The Home launcher grid. Order within each group matters — highest-traffic
 * modules first.
 */
export const MODULES: ModuleTile[] = [
  {
    key: "food",
    name: "Food orders",
    description: "Menu, opt in or out, pause",
    href: "/(tabs)/food",
    icon: UtensilsCrossed,
    group: "daily",
    tint: "accent",
    keywords: ["mess", "meal", "breakfast", "lunch", "dinner", "snacks"],
  },
  {
    key: "attendance",
    name: "Attendance",
    description: "Mark today in 20 seconds",
    href: "/attendance",
    icon: ScanFace,
    group: "daily",
    tint: "success",
    keywords: ["present", "face", "biometric", "geo", "location"],
  },
  {
    key: "mess-entry",
    name: "Mess entry",
    description: "Scan to enter the dining hall",
    href: "/mess-entry",
    icon: QrCode,
    group: "daily",
    tint: "pop",
    keywords: ["qr", "scan", "turnstile", "gate", "fingerprint"],
  },
  {
    key: "laundry",
    name: "Laundry",
    description: "Book a pickup, track it",
    href: "/laundry",
    icon: Shirt,
    group: "services",
    tint: "info",
    keywords: ["wash", "clothes", "press", "ironing", "pickup"],
  },
  {
    key: "maintenance",
    name: "Room maintenance",
    description: "Report anything broken",
    href: "/maintenance",
    icon: Wrench,
    group: "services",
    tint: "warning",
    keywords: ["repair", "ac", "fan", "light", "plumbing", "key", "fix"],
  },
  {
    key: "complaints",
    name: "Complaints",
    description: "Raise and track an issue",
    href: "/complaints",
    icon: MessageSquareWarning,
    group: "services",
    tint: "danger",
    keywords: ["issue", "problem", "grievance"],
  },
  {
    key: "visits",
    name: "Visitors",
    description: "Book a parent or friend visit",
    href: "/visits",
    icon: CalendarHeart,
    group: "services",
    tint: "pop",
    keywords: ["parent", "guardian", "relative", "friend", "guest"],
  },
  {
    key: "room",
    name: "My room",
    description: "Block, floor and room type",
    href: "/room",
    icon: Bed,
    group: "account",
    tint: "info",
    keywords: ["hostel", "block", "wing", "floor", "sharing"],
  },
  {
    key: "payments",
    name: "Payments",
    description: "Plan, receipts and dues",
    href: "/payments",
    icon: CreditCard,
    group: "account",
    tint: "success",
    keywords: ["fees", "rent", "ledger", "receipt", "due"],
  },
  {
    key: "onboarding",
    name: "Move in",
    description: "ID, agreement, room check",
    href: "/onboarding",
    icon: ClipboardCheck,
    group: "account",
    tint: "pop",
    keywords: [
      "onboarding", "kyc", "aadhaar", "lease", "agreement", "sign",
      "roommate", "checklist", "inventory", "tour", "layout", "move",
    ],
  },
  {
    key: "feedback",
    name: "Feedback",
    description: "Rate mess, room and more",
    href: "/feedback",
    icon: Star,
    group: "account",
    tint: "warning",
    keywords: ["rating", "review", "stars"],
  },
  {
    key: "requests",
    name: "All requests",
    description: "Everything you've raised",
    href: "/(tabs)/requests",
    icon: ClipboardList,
    group: "account",
    tint: "accent",
    keywords: ["tracking", "status", "history"],
  },
];

export function filterModules(query: string): ModuleTile[] {
  const q = query.trim().toLowerCase();
  if (!q) return MODULES;

  return MODULES.filter((m) =>
    [m.name, m.description, ...m.keywords]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}

/** Modules for one group, already filtered by search if applicable. */
export function modulesInGroup(
  group: ModuleGroup,
  query: string
): ModuleTile[] {
  return filterModules(query).filter((m) => m.group === group);
}
