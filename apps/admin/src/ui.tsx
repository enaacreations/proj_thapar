import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  REQUEST_STATUS_LABELS,
  type RequestStatus,
  type ResidentAccountStatus,
  type ServiceRequestKind,
} from "@proj/shared";
import type { AppModule } from "./modules";

/* ----------------------------------------------------------------- badges */

const STATUS: Record<
  ResidentAccountStatus,
  { label: string; cls: string; icon: LucideIcon }
> = {
  pending_approval: { label: "Pending", cls: "pending", icon: Clock },
  approved: { label: "Approved", cls: "approved", icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "rejected", icon: XCircle },
};

/** Status is colour + icon + word together, never colour alone. */
export function StatusBadge({ status }: { status: ResidentAccountStatus }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={`badge ${s.cls}`}>
      <Icon size={13} strokeWidth={2} />
      {s.label}
    </span>
  );
}

const REQUEST_STATUS: Record<
  RequestStatus,
  { cls: string; icon: LucideIcon }
> = {
  submitted: { cls: "pending", icon: Clock },
  in_progress: { cls: "info", icon: Loader2 },
  resolved: { cls: "approved", icon: CheckCircle2 },
  rejected: { cls: "rejected", icon: XCircle },
  cancelled: { cls: "neutral", icon: XCircle },
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const s = REQUEST_STATUS[status];
  const Icon = s.icon;
  return (
    <span className={`badge ${s.cls}`}>
      <Icon size={13} strokeWidth={2} />
      {REQUEST_STATUS_LABELS[status]}
    </span>
  );
}

export const KIND_LABELS: Record<ServiceRequestKind, string> = {
  maintenance: "Maintenance",
  laundry: "Laundry",
  complaint: "Complaint",
  visit: "Visit",
};

/* ------------------------------------------------------------------ toast */

type Tone = "success" | "danger" | "info";

interface ToastValue {
  show: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const TOAST_ICON: Record<Tone, LucideIcon> = {
  success: CheckCircle2,
  danger: XCircle,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(
    null
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: Tone = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const Icon = toast ? TOAST_ICON[toast.tone] : Info;
  const color =
    toast?.tone === "success"
      ? "var(--success)"
      : toast?.tone === "danger"
        ? "var(--danger)"
        : "var(--info)";

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div className="toast" role="status">
          <Icon size={20} strokeWidth={2} color={color} />
          <span>{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>.");
  return ctx;
}

/* ----------------------------------------------------------------- states */

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="center-state">
      <Loader2 size={24} className="spin" strokeWidth={2} color="var(--accent)" />
      <p className="muted">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="center-state">
      <div className="state-icon">
        <Icon size={28} strokeWidth={1.75} />
      </div>
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="center-state">
      <div className="state-icon">
        <AlertTriangle size={28} strokeWidth={1.75} />
      </div>
      <p className="muted">{message}</p>
      {onRetry && (
        <button className="btn secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ page pieces */

/** Every screen opens the same way: title, one plain-language line under it. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="stack-sm">
        <h1>{title}</h1>
        {description && <p className="muted small">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * The launcher tile, shared by Home and the Operations index. `lead` is the
 * big three-across card Home shows, with the module's own sentence under the
 * name; `compact` is the smaller square Operations lists its areas as.
 */
export function ModuleTile({
  module,
  nudge,
  variant = "lead",
}: {
  module: AppModule;
  nudge: string | null;
  variant?: "lead" | "compact";
}) {
  const [from, to, tint, tint2] = module.gradient;

  return (
    <Link
      className={`tile ${variant}`}
      to={module.path}
      // The four colours the tile's CSS paints itself from.
      style={
        {
          "--tile-from": from,
          "--tile-to": to,
          "--tile-tint": tint,
          "--tile-tint-2": tint2,
        } as CSSProperties
      }
    >
      <span className="tile-badge">
        <module.icon size={variant === "lead" ? 30 : 22} strokeWidth={2} />
      </span>
      <span className="tile-name">{module.name}</span>
      {variant === "lead" && (
        <span className="tile-sub">{module.description}</span>
      )}
      {nudge && <span className="nudge">{nudge}</span>}
    </Link>
  );
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link className="back-link hover-elevate active-elevate-2" to={to}>
      <ArrowLeft size={18} strokeWidth={2} />
      {label}
    </Link>
  );
}

export function Stat({
  label,
  value,
  tone = "ink",
  suffix,
}: {
  label: string;
  value: number | string | null | undefined;
  tone?: string;
  suffix?: string;
}) {
  return (
    <div className="card">
      <p className="caption">{label}</p>
      <p className="stat-value" style={{ color: `var(--${tone})` }}>
        {value ?? "—"}
        {suffix && <span className="stat-suffix">{suffix}</span>}
      </p>
    </div>
  );
}

/**
 * Progress ring stroked with the brand gradient — the one place on Home the
 * gradient is allowed to show up at size.
 */
export function ProgressRing({
  percent,
  label,
}: {
  percent: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = 38;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="ring">
      <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden>
        <defs>
          <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF9A3D" />
            <stop offset="50%" stopColor="#F2603C" />
            <stop offset="100%" stopColor="#C2459A" />
          </linearGradient>
        </defs>
        <circle
          cx="46"
          cy="46"
          r={radius}
          fill="none"
          stroke="var(--muted-bg)"
          strokeWidth="8"
        />
        <circle
          cx="46"
          cy="46"
          r={radius}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          style={{ transition: "stroke-dashoffset 350ms ease" }}
        />
      </svg>
      <span className="ring-label">{label ?? `${clamped}%`}</span>
    </div>
  );
}

/** Horizontal progress bar with the number beside it, never colour alone. */
export function Meter({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <span className="inline" style={{ width: "100%", maxWidth: 260 }}>
      <span className="meter">
        <span style={{ width: `${clamped}%` }} />
      </span>
      <span className="caption mono">{clamped}%</span>
    </span>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="stack-sm">
          <h2>{title}</h2>
          {description && <p className="muted small">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- misc */

export function greeting(at: Date = new Date()): string {
  const hour = at.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Live clock for the topbar — ticks on the minute, not every second. */
export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return now;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;

  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
