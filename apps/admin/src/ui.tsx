import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ResidentAccountStatus } from "@proj/shared";

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
