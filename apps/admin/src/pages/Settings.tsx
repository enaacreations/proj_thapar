import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MapPin } from "lucide-react";
import {
  GEOFENCE_LIMITS,
  type AdminTourMedia,
  type AttendanceGeofence,
  type TourMediaKind,
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

      <TourMedia />
    </div>
  );
}

/**
 * Photos and 360° panoramas for the property tour.
 *
 * Without this there was no way to get a picture into the app at all: every
 * space shipped with `panoramaUri: null`, and residents deciding whether to
 * move in saw a grey gradient captioned "no photo uploaded yet".
 */
function TourMedia() {
  const toast = useToast();

  const [data, setData] = useState<AdminTourMedia | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [spaceId, setSpaceId] = useState("");
  const [kind, setKind] = useState<TourMediaKind>("photo");
  const [caption, setCaption] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await api.tourMedia();
      setData(next);
      setSpaceId((current) => current || (next.spaces[0]?.id ?? ""));
    } catch (err) {
      setError(messageOf(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!spaceId || busy) return;

    setBusy(true);
    try {
      // Either an uploaded file or a link to one hosted elsewhere. The file
      // wins when both are filled in, since picking one is the deliberate act.
      const imageBase64 = file ? await readAsDataUrl(file) : undefined;

      await api.addTourMedia({
        spaceId,
        kind,
        caption: caption.trim(),
        ...(imageBase64 ? { imageBase64 } : { url: url.trim() }),
      });

      setCaption("");
      setUrl("");
      setFile(null);
      await load();
      toast.show(kind === "panorama" ? "Panorama added" : "Photo added", "success");
    } catch (err) {
      toast.show(messageOf(err), "danger");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.removeTourMedia(id);
      await load();
    } catch (err) {
      toast.show(messageOf(err), "danger");
    }
  };

  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader
        title="Tour photos"
        description="What residents see under “Look around”. A space with nothing here shows a placeholder."
      />

      <form className="card stack" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="space">Space</label>
            <select
              id="space"
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
            >
              {data.spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="kind">Type</label>
            <select
              id="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as TourMediaKind)}
            >
              <option value="photo">Photo</option>
              <option value="panorama">360° panorama</option>
            </select>
            <p className="caption">
              A panorama has to be equirectangular — a normal photo won't pan
              correctly.
            </p>
          </div>

          <div className="field">
            <label htmlFor="file">Image file</label>
            <input
              id="file"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="field">
            <label htmlFor="url">…or a link to one</label>
            <input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              disabled={file !== null}
            />
          </div>

          <div className="field">
            <label htmlFor="caption">Caption</label>
            <input
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Study desk and window"
            />
          </div>
        </div>

        <div className="btn-row">
          <button
            className="btn"
            type="submit"
            disabled={busy || !spaceId || (!file && url.trim() === "")}
          >
            {busy ? "Uploading…" : "Add to the tour"}
          </button>
        </div>
      </form>

      {data.spaces.map((s) => {
        const mine = data.media.filter((m) => m.spaceId === s.id);

        return (
          <div className="card" key={s.id}>
            <h2 className="card-title">{s.name}</h2>

            {mine.length === 0 ? (
              <p className="muted small">
                Nothing uploaded — this space shows a placeholder in the app.
              </p>
            ) : (
              <div className="stack-sm">
                {mine.map((m) => (
                  <div className="kv" key={m.id}>
                    <dt>
                      {m.kind === "panorama" ? "360°" : "Photo"}
                      {m.caption ? ` · ${m.caption}` : ""}
                    </dt>
                    <dd>
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() => void remove(m.id)}
                      >
                        Remove
                      </button>
                    </dd>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Files come off the input as blobs; the API takes base64. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}
