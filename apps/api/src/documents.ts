import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { DocumentKind, DocumentTokenResponse } from "@proj/shared";
import { env } from "./env";
import { db } from "./db/client";
import * as t from "./db/schema";

/**
 * Documents are opened in the system browser, which can't attach a bearer
 * token. Instead the app asks for a short-lived HMAC-signed URL that names
 * exactly one document for exactly one resident.
 */

const TTL_SECONDS = 300;

function secret(): string {
  // Falls back to the database URL so dev works without extra config; a real
  // deployment should set DOCUMENT_SECRET.
  return process.env.DOCUMENT_SECRET ?? `${env.databaseUrl}:documents`;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function signDocumentUrl(
  residentId: string,
  kind: DocumentKind,
  id: string
): DocumentTokenResponse {
  const expires = Date.now() + TTL_SECONDS * 1000;
  const payload = `${residentId}.${kind}.${id}.${expires}`;
  const token = `${expires}.${sign(payload)}`;

  return {
    url: `/api/documents/${kind}/${encodeURIComponent(id)}?r=${encodeURIComponent(residentId)}&t=${token}`,
    expiresInSeconds: TTL_SECONDS,
  };
}

export function verifyDocumentToken(
  residentId: string,
  kind: DocumentKind,
  id: string,
  token: string
): boolean {
  const [expiresRaw, signature] = token.split(".");
  if (!expiresRaw || !signature) return false;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  // Must be checked before decoding: Buffer.from(_, "hex") stops silently at
  // the first non-hex character, so "<valid-sig>JUNK" would otherwise decode
  // to the same bytes as the real signature and pass.
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;

  const expected = sign(`${residentId}.${kind}.${id}.${expires}`);
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}

/* ------------------------------------------------------------ rendering */

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;"
  );

/**
 * Print-ready HTML rather than a PDF: no extra dependency, opens anywhere, and
 * every browser can save it as a PDF. Real PDF generation would slot in here.
 */
function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(title)}</title>
<style>
  :root { --ink:#241A15; --muted:#7C6E64; --border:#EFE6DE; --accent:#C24A1C; }
  * { box-sizing: border-box; }
  body { margin:0; padding:32px; font-family:-apple-system,system-ui,"Segoe UI",sans-serif;
         color:var(--ink); line-height:1.5; max-width:760px; margin-inline:auto; }
  header { display:flex; justify-content:space-between; align-items:flex-start;
           border-bottom:2px solid var(--ink); padding-bottom:16px; margin-bottom:24px; }
  h1 { font-size:22px; margin:0 0 4px; letter-spacing:-0.012em; }
  h2 { font-size:15px; margin:24px 0 8px; }
  .muted { color:var(--muted); }
  .small { font-size:13px; }
  table { width:100%; border-collapse:collapse; margin:12px 0; }
  th, td { text-align:left; padding:10px 8px; border-bottom:1px solid var(--border); }
  th { font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--muted); }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  .total { font-weight:700; border-top:2px solid var(--ink); }
  .badge { display:inline-block; padding:3px 10px; border-radius:999px; font-size:12px;
           background:#E7F3EE; color:#157F5B; }
  footer { margin-top:32px; padding-top:16px; border-top:1px solid var(--border);
           font-size:12px; color:var(--muted); }
  @media print { body { padding:0; } .noprint { display:none; } }
</style>
</head><body>
<header>
  <div>
    <h1>${escape(title)}</h1>
    <div class="small muted">Thapar · Bhadson Road, Patiala 147004</div>
  </div>
  <button class="noprint" onclick="window.print()"
    style="padding:8px 14px;border:1px solid var(--border);border-radius:8px;background:#fff;cursor:pointer">
    Print or save as PDF
  </button>
</header>
${body}
<footer>Computer-generated document. No signature required.</footer>
</body></html>`;
}

export async function renderDocument(
  residentId: string,
  kind: DocumentKind,
  id: string
): Promise<string | null> {
  const [resident] = await db
    .select()
    .from(t.residents)
    .where(eq(t.residents.id, residentId))
    .limit(1);
  if (!resident) return null;

  const [room] = await db
    .select()
    .from(t.rooms)
    .where(eq(t.rooms.residentId, residentId))
    .limit(1);

  const who = `<p class="small muted">${escape(resident.fullName)} · ${escape(resident.id)}${
    room ? ` · Room ${escape(room.roomNumber)}` : ""
  }</p>`;

  if (kind === "invoice") {
    const [invoice] = await db
      .select()
      .from(t.invoices)
      .where(and(eq(t.invoices.id, id), eq(t.invoices.residentId, residentId)))
      .limit(1);
    if (!invoice) return null;

    const rows = invoice.lines
      .map(
        (l) =>
          `<tr><td>${escape(l.description)}</td><td class="num">${rupees(l.amount)}</td></tr>`
      )
      .join("");

    return page(
      `Invoice ${invoice.number}`,
      `${who}
      <table>
        <tr><th>Billing period</th><td class="num">${invoice.periodFrom} to ${invoice.periodTo}</td></tr>
        <tr><th>Due on</th><td class="num">${invoice.dueOn}</td></tr>
      </table>
      <h2>Charges</h2>
      <table>
        <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
        <tbody>
          ${rows}
          <tr class="total"><td>Total</td><td class="num">${rupees(invoice.total)}</td></tr>
          <tr><td>Paid</td><td class="num">${rupees(invoice.amountPaid)}</td></tr>
          <tr class="total"><td>Balance</td><td class="num">${rupees(invoice.total - invoice.amountPaid)}</td></tr>
        </tbody>
      </table>`
    );
  }

  if (kind === "receipt") {
    const [order] = await db
      .select()
      .from(t.paymentOrders)
      .where(
        and(
          eq(t.paymentOrders.id, id),
          eq(t.paymentOrders.residentId, residentId),
          eq(t.paymentOrders.status, "succeeded")
        )
      )
      .limit(1);
    if (!order) return null;

    return page(
      "Rent receipt",
      `${who}
      <p class="badge">Payment received</p>
      <table>
        <tr><th>Receipt number</th><td class="num">${escape(order.id)}</td></tr>
        <tr><th>Amount</th><td class="num">${rupees(order.amount)}</td></tr>
        <tr><th>Paid on</th><td class="num">${order.completedAt?.toISOString().slice(0, 10) ?? "—"}</td></tr>
        <tr><th>Method</th><td class="num">${escape(order.method)}</td></tr>
        <tr><th>Reference</th><td class="num">${escape(order.providerRef ?? "—")}</td></tr>
      </table>
      <p class="small muted">Retain this receipt for your records.</p>`
    );
  }

  if (kind === "hra") {
    const invoices = await db
      .select()
      .from(t.invoices)
      .where(eq(t.invoices.residentId, residentId));

    const forYear = invoices.filter(
      (i) => i.periodFrom.startsWith(id) && i.amountPaid > 0
    );
    if (forYear.length === 0) return null;

    const totalPaid = forYear.reduce((sum, i) => sum + i.amountPaid, 0);
    const rows = forYear
      .sort((a, b) => a.periodFrom.localeCompare(b.periodFrom))
      .map(
        (i) =>
          `<tr><td>${i.periodFrom.slice(0, 7)}</td><td class="num">${rupees(i.amountPaid)}</td></tr>`
      )
      .join("");

    return page(
      `HRA statement ${escape(id)}`,
      `${who}
      <p class="small">Rent paid for the period 1 January ${escape(id)} to 31 December ${escape(id)}.</p>
      <table>
        <thead><tr><th>Month</th><th class="num">Rent paid</th></tr></thead>
        <tbody>${rows}
          <tr class="total"><td>Total</td><td class="num">${rupees(totalPaid)}</td></tr>
        </tbody>
      </table>
      <p class="small muted">
        Landlord: Thapar hostel accommodation. A landlord PAN is required by the
        tax authority where annual rent exceeds ₹1,00,000 — request it from the
        hostel office.
      </p>`
    );
  }

  // ledger
  const invoices = await db
    .select()
    .from(t.invoices)
    .where(eq(t.invoices.residentId, residentId));

  const payments = await db
    .select()
    .from(t.paymentEntries)
    .where(eq(t.paymentEntries.residentId, residentId));

  const billed = invoices.reduce((s, i) => s + (i.status === "void" ? 0 : i.total), 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);

  const invoiceRows = invoices
    .sort((a, b) => a.periodFrom.localeCompare(b.periodFrom))
    .map(
      (i) =>
        `<tr><td>${i.periodFrom.slice(0, 7)}</td><td>${escape(i.number)}</td><td class="num">${rupees(i.total)}</td><td class="num">${rupees(i.amountPaid)}</td></tr>`
    )
    .join("");

  return page(
    "Account statement",
    `${who}
    <h2>Invoices</h2>
    <table>
      <thead><tr><th>Period</th><th>Number</th><th class="num">Billed</th><th class="num">Paid</th></tr></thead>
      <tbody>${invoiceRows || '<tr><td colspan="4" class="muted">Nothing billed yet.</td></tr>'}</tbody>
    </table>
    <table>
      <tr class="total"><td>Total billed</td><td class="num">${rupees(billed)}</td></tr>
      <tr class="total"><td>Total paid</td><td class="num">${rupees(paid)}</td></tr>
      <tr class="total"><td>Balance</td><td class="num">${rupees(billed - paid)}</td></tr>
    </table>`
  );
}
