import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CameraOff, CheckCircle2, Info, ScanLine } from "lucide-react";
import { MEAL_LABELS, type MessScanResult } from "@proj/shared";
import { api, messageOf } from "../api";
import { PageHeader } from "../ui";

/**
 * The mess counter. Staff point this at a resident's rotating pass as they hand
 * over a plate — the scan is what creates the entry, so the record attests that
 * a member of staff was present, which a resident's own phone can't.
 */
export default function MessDesk() {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [last, setLast] = useState<MessScanResult | null>(null);
  const [served, setServed] = useState(0);

  // Guards against the same code firing on every frame while it's held up.
  const busy = useRef(false);
  const lastToken = useRef<string | null>(null);

  const redeem = useCallback(async (token: string) => {
    if (busy.current || token === lastToken.current) return;
    busy.current = true;
    lastToken.current = token;

    try {
      const result = await api.scanMessPass(token);
      setLast(result);
      setScanError(null);
      if (result.recorded) setServed((n) => n + 1);
    } catch (err) {
      setLast(null);
      setScanError(messageOf(err));
    } finally {
      busy.current = false;
      // A pass rotates every 30s, so releasing the guard after 3s lets a
      // genuine re-scan through without re-firing on the frames in between.
      setTimeout(() => {
        if (lastToken.current === token) lastToken.current = null;
      }, 3000);
    }
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let alive = true;

    const tick = () => {
      frame = requestAnimationFrame(tick);

      const v = video.current;
      const c = canvas.current;
      if (!v || !c || v.readyState !== v.HAVE_ENOUGH_DATA) return;

      // Downscale before decoding: a 320px-wide frame is plenty for a QR held
      // at arm's length, and full resolution would drop the frame rate.
      const width = 320;
      const height = Math.round((v.videoHeight / v.videoWidth) * width) || 240;
      c.width = width;
      c.height = height;

      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, width, height);

      const code = jsQR(
        ctx.getImageData(0, 0, width, height).data,
        width,
        height
      );
      if (code?.data) void redeem(code.data);
    };

    navigator.mediaDevices
      // The rear camera is the one pointing at the resident across a counter.
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (!alive) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        frame = requestAnimationFrame(tick);
      })
      .catch(() =>
        setCameraError(
          "No camera access. Allow it in your browser, then reload this page."
        )
      );

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [redeem]);

  return (
    <div className="stack animate-fade-up" style={{ gap: 20 }}>
      <PageHeader
        title="Mess counter"
        description="Scan each resident's pass as you hand over their plate. One plate per person per meal."
      />

      <div className="detail-grid">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {cameraError ? (
            <div className="center-state">
              <div className="state-icon">
                <CameraOff size={28} strokeWidth={1.75} />
              </div>
              <p className="muted">{cameraError}</p>
            </div>
          ) : (
            <video
              ref={video}
              playsInline
              muted
              style={{ width: "100%", display: "block", background: "#000" }}
            />
          )}
          <canvas ref={canvas} style={{ display: "none" }} />
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <p className="caption">Served this session</p>
            <p className="stat-value" style={{ color: "var(--success)" }}>
              {served}
            </p>
          </div>

          <div className="card">
            <h2 className="card-title">Last scan</h2>

            {scanError ? (
              <p className="inline" style={{ color: "var(--danger)" }}>
                <Info size={16} strokeWidth={2} />
                {scanError}
              </p>
            ) : last ? (
              <div className="stack-sm">
                <strong style={{ fontSize: 18 }}>{last.residentName}</strong>
                <p className="small muted">
                  <span className="mono">{last.residentId}</span>
                  {last.roomNumber ? ` · ${last.roomNumber}` : ""}
                </p>
                {last.recorded ? (
                  <p className="badge approved">
                    <CheckCircle2 size={13} strokeWidth={2} />
                    {MEAL_LABELS[last.meal]} recorded
                  </p>
                ) : (
                  // Not an error: staff need to know the plate already went out.
                  <p className="badge warning">
                    <Info size={13} strokeWidth={2} />
                    Already had {MEAL_LABELS[last.meal].toLowerCase()} today
                  </p>
                )}
              </div>
            ) : (
              <p className="inline muted small">
                <ScanLine size={16} strokeWidth={2} />
                Waiting for a pass…
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
