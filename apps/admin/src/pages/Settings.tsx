import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MapPin } from "lucide-react";
import {
  GEOFENCE_LIMITS,
  type AttendanceGeofence,
  type UpdateGeofenceBody,
} from "@proj/shared";
import { api, messageOf } from "../api";
import { SCOPE } from "../modules";
import {
  ErrorState,
  Loading,
  PageHeader,
  formatDateTime,
  useToast,
} from "../ui";

/** Form state is strings, so a half-typed "-" or "30." doesn't snap to 0. */
type Draft = Record<keyof UpdateGeofenceBody, string>;

function toDraft(g: AttendanceGeofence): Draft {
  return {
    latitude: String(g.latitude),
    longitude: String(g.longitude),
    radiusMetres: String(g.radiusMetres),
    locationLabel: g.locationLabel,
  };
}

export default function Settings() {
  const toast = useToast();

  const [saved, setSaved] = useState<AttendanceGeofence | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const g = await api.geofence();
      setSaved(g);
      setDraft(toDraft(g));
    } catch (err) {
      setError(messageOf(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (field: keyof Draft) => (value: string) =>
    setDraft((d) => (d ? { ...d, [field]: value } : d));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;

    const latitude = Number(draft.latitude);
    const longitude = Number(draft.longitude);
    const radiusMetres = Number(draft.radiusMetres);

    // Checked here as well as on the server so a typo doesn't cost a round trip.
    if (!draft.locationLabel.trim()) {
      setFormError("Give the location a name residents will read.");
      return;
    }
    if (![latitude, longitude, radiusMetres].every(Number.isFinite)) {
      setFormError("Latitude, longitude and radius all need to be numbers.");
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const next = await api.saveGeofence({
        latitude,
        longitude,
        radiusMetres,
        locationLabel: draft.locationLabel.trim(),
      });
      setSaved(next);
      setDraft(toDraft(next));
      toast.show("Attendance geofence updated", "success");
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!draft || !saved) return <Loading />;

  const dirty =
    draft.latitude !== String(saved.latitude) ||
    draft.longitude !== String(saved.longitude) ||
    draft.radiusMetres !== String(saved.radiusMetres) ||
    draft.locationLabel !== saved.locationLabel;

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader
        title="Attendance geofence"
        description="The circle attendance is measured against. Marking in from outside it is flagged for review, never blocked."
      />

      <form className="card stack" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="latitude">Latitude</label>
            <input
              id="latitude"
              inputMode="decimal"
              value={draft.latitude}
              onChange={(e) => set("latitude")(e.target.value)}
            />
            <p className="caption">
              {GEOFENCE_LIMITS.latitude.min} to {GEOFENCE_LIMITS.latitude.max}
            </p>
          </div>

          <div className="field">
            <label htmlFor="longitude">Longitude</label>
            <input
              id="longitude"
              inputMode="decimal"
              value={draft.longitude}
              onChange={(e) => set("longitude")(e.target.value)}
            />
            <p className="caption">
              {GEOFENCE_LIMITS.longitude.min} to {GEOFENCE_LIMITS.longitude.max}
            </p>
          </div>

          <div className="field">
            <label htmlFor="radius">Radius in metres</label>
            <input
              id="radius"
              inputMode="numeric"
              value={draft.radiusMetres}
              onChange={(e) => set("radiusMetres")(e.target.value)}
            />
            <p className="caption">
              {GEOFENCE_LIMITS.radiusMetres.min} to{" "}
              {GEOFENCE_LIMITS.radiusMetres.max}
            </p>
          </div>

          <div className="field">
            <label htmlFor="label">Location name</label>
            <input
              id="label"
              value={draft.locationLabel}
              onChange={(e) => set("locationLabel")(e.target.value)}
              placeholder="Thapar, Block B"
            />
            <p className="caption">
              What a resident sees on their own attendance record.
            </p>
          </div>
        </div>

        {formError && (
          <p className="error-text" role="alert">
            {formError}
          </p>
        )}

        <div className="btn-row">
          <button className="btn" type="submit" disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          {dirty && (
            <button
              className="btn secondary"
              type="button"
              onClick={() => setDraft(toDraft(saved))}
              disabled={busy}
            >
              Discard
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <h2 className="card-title">Where this applies</h2>
        <p className="inline muted small">
          <MapPin size={14} strokeWidth={2} />
          {SCOPE}
        </p>
        <p className="caption" style={{ marginTop: 8 }}>
          {saved.updatedAt
            ? `Last changed ${formatDateTime(saved.updatedAt)}${
                saved.updatedBy ? ` by ${saved.updatedBy}` : ""
              }.`
            : "Still on the shipped default — nobody has changed this yet."}
        </p>
      </div>
    </div>
  );
}
