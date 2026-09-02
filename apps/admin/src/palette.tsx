import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, Search } from "lucide-react";
import type { AdminRole } from "@proj/shared";
import { GROUP_LABELS, OPERATIONS, modulesFor } from "./modules";

interface Entry {
  to: string;
  label: string;
  module: string;
  /** Lets "requests" or "tasks" find every page of that kind. */
  group: string;
}

/** Only pages this role can open are searchable — the gate is the same one the
 *  sidebar uses, so the palette can never route someone somewhere hidden. */
function entriesFor(role: AdminRole): Entry[] {
  // The palette still indexes every page, so a two-level shell never costs a
  // keyboard user the step it saves everyone else.
  const list: Entry[] = [
    { to: "/", label: "Home", module: "Launcher", group: "" },
    {
      to: OPERATIONS.path,
      label: OPERATIONS.name,
      module: "Launcher",
      group: OPERATIONS.description,
    },
  ];

  for (const mod of modulesFor(role)) {
    for (const page of mod.pages) {
      list.push({
        to: `${mod.path}${page.query}`,
        label: page.label,
        module: mod.name,
        group: GROUP_LABELS[page.group],
      });
    }
  }

  return list;
}

export function CommandPalette({
  role,
  open,
  onClose,
}: {
  role: AdminRole;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const all = entriesFor(role);
    const term = query.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (e) =>
        e.label.toLowerCase().includes(term) ||
        e.module.toLowerCase().includes(term) ||
        e.group.toLowerCase().includes(term)
    );
  }, [role, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      inputRef.current?.focus();
    }
  }, [open]);

  // Keep the highlight inside the list as it shrinks while typing.
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    navigate(entry.to);
    onClose();
  };

  return (
    <div
      className="palette-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="palette animate-fade-up"
        role="dialog"
        aria-modal="true"
        aria-label="Search pages"
      >
        <div className="palette-input">
          <Search size={18} color="var(--muted)" strokeWidth={2} />
          <input
            ref={inputRef}
            value={query}
            placeholder="Search pages…"
            aria-label="Search pages"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onClose();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => (c + 1) % Math.max(1, results.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor(
                  (c) =>
                    (c - 1 + Math.max(1, results.length)) %
                    Math.max(1, results.length)
                );
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(results[cursor]);
              }
            }}
          />
        </div>

        {results.length === 0 ? (
          <p className="palette-empty">
            Nothing matches “{query.trim()}”. Try a page or module name.
          </p>
        ) : (
          <ul className="palette-list">
            {results.map((entry, i) => (
              <li key={entry.to}>
                <button
                  className="palette-item hover-elevate active-elevate-2"
                  aria-selected={i === cursor}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(entry)}
                >
                  {entry.to === "/" && (
                    <Home size={16} strokeWidth={2} color="var(--muted)" />
                  )}
                  {entry.label}
                  <span className="palette-module">{entry.module}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
