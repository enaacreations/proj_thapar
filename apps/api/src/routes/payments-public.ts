import { Router } from "express";
import type { DocumentKind } from "@proj/shared";
import { HttpError } from "../http-error";
import * as fin from "../data/finance";
import { MOCK_WEBHOOK_SECRET, provider } from "../payments/provider";
import { renderDocument, verifyDocumentToken } from "../documents";

/**
 * Routes that can't carry a resident bearer token: the gateway webhook (called
 * server-to-server) and document pages (opened in the system browser).
 */
export const paymentsPublicRouter: Router = Router();

/**
 * The gateway's callback. This is the real handler — the mock simulator below
 * posts here rather than shortcutting, so the code path that settles a payment
 * in production is the one exercised in development.
 */
paymentsPublicRouter.post("/webhook", async (req, res) => {
  const signature = req.get("x-webhook-signature");

  if (!provider.verifyWebhook(signature, JSON.stringify(req.body))) {
    throw new HttpError(401, "bad_signature", "Invalid webhook signature.");
  }

  const { orderId, outcome, reason } = req.body as {
    orderId?: string;
    outcome?: string;
    reason?: string;
  };

  if (typeof orderId !== "string") {
    throw HttpError.badRequest("Missing orderId.");
  }
  if (outcome !== "succeeded" && outcome !== "failed") {
    throw HttpError.badRequest("outcome must be succeeded or failed.");
  }

  const settled = await fin.settleOrder(
    orderId,
    outcome,
    typeof reason === "string" ? reason : null
  );

  // A gateway that retries a delivered webhook must not double-credit; an
  // already-final order simply acknowledges.
  res.json({ received: true, applied: settled !== null });
});

/* ------------------------------------------------------------ simulator */

const simulatorPage = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<style>
 body{margin:0;padding:32px;font-family:-apple-system,system-ui,sans-serif;color:#241A15;
      max-width:420px;margin-inline:auto;background:#FCF9F6}
 .card{background:#fff;border:1px solid #EFE6DE;border-radius:14px;padding:20px;margin-top:16px}
 h1{font-size:20px;margin:0 0 4px}
 .muted{color:#7C6E64;font-size:13px}
 button{width:100%;min-height:48px;border-radius:10px;border:0;font-size:15px;font-weight:600;
        cursor:pointer;margin-top:10px}
 .pay{background:#E8602C;color:#fff}
 .fail{background:#fff;color:#C73B33;border:1px solid #EFE6DE}
 .warn{background:#F7EEDD;color:#9A6206;padding:10px 12px;border-radius:8px;font-size:13px}
</style></head><body>
<h1>${title}</h1>
<p class="muted">Test gateway — no money moves.</p>
<div class="card">${body}</div>
</body></html>`;

/** Stands in for the gateway's hosted checkout page. */
paymentsPublicRouter.get("/simulator/:orderId", (req, res) => {
  const orderId = String(req.params.orderId);

  res.type("html").send(
    simulatorPage(
      "Authorise payment",
      `<p class="warn">This is a mock gateway. Nothing is charged to any real account.</p>
       <p class="muted">Order <strong>${orderId}</strong></p>
       <button class="pay" onclick="send('succeeded')">Approve payment</button>
       <button class="fail" onclick="send('failed')">Simulate failure</button>
       <p id="out" class="muted"></p>
       <script>
         async function send(outcome) {
           const res = await fetch('/api/payments/webhook', {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'x-webhook-signature': ${JSON.stringify(MOCK_WEBHOOK_SECRET)}
             },
             body: JSON.stringify({
               orderId: ${JSON.stringify(orderId)},
               outcome,
               reason: outcome === 'failed' ? 'Declined by test bank' : undefined
             })
           });
           const body = await res.json();
           document.getElementById('out').textContent =
             body.applied ? 'Done — go back to the app.' : 'Already handled.';
         }
       </script>`
    )
  );
});

/** Stands in for the bank's mandate-approval page. */
paymentsPublicRouter.get("/simulator/mandate/:mandateId", async (req, res) => {
  const mandateId = String(req.params.mandateId);

  if (req.query.approve === "1") {
    await fin.approveMandateById(mandateId);
    res.type("html").send(
      simulatorPage("Auto-debit approved", `<p>Go back to the app.</p>`)
    );
    return;
  }

  res.type("html").send(
    simulatorPage(
      "Approve auto-debit",
      `<p class="warn">Mock bank approval. No real mandate is registered.</p>
       <p class="muted">Mandate <strong>${mandateId}</strong></p>
       <form><button class="pay" name="approve" value="1">Approve</button></form>`
    )
  );
});

/* ------------------------------------------------------------ documents */

export const documentsRouter: Router = Router();

documentsRouter.get("/:kind/:id", async (req, res) => {
  const kind = String(req.params.kind) as DocumentKind;
  const id = String(req.params.id);
  const residentId = typeof req.query.r === "string" ? req.query.r : "";
  const token = typeof req.query.t === "string" ? req.query.t : "";

  if (!["invoice", "receipt", "hra", "ledger"].includes(kind)) {
    throw HttpError.notFound("Unknown document type.");
  }
  if (!verifyDocumentToken(residentId, kind, id, token)) {
    throw new HttpError(
      403,
      "link_expired",
      "This link has expired. Open the document from the app again."
    );
  }

  const html = await renderDocument(residentId, kind, id);
  if (!html) throw HttpError.notFound("We couldn't find that document.");

  res.type("html").send(html);
});
