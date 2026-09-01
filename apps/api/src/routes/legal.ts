import { Router } from "express";

/**
 * Public, unauthenticated pages the app stores require at submission time:
 * Google Play validates the privacy-policy URL and wants a data-deletion URL,
 * Apple lists the privacy URL and a support URL. Reviewers open these in a
 * plain browser, so nothing here may need a token or the app.
 */
export const legalRouter: Router = Router();

const ORG_NAME = "Thapar Hostel";
const OPERATOR = "Enaa Creations";
const CONTACT_EMAIL = "support@enaacreations.com";
const UPDATED = "1 September 2026";

/** Shared shell so every page renders the same on a reviewer's phone. */
function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — ${ORG_NAME}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2.5rem 1.25rem 4rem;
    font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1c1917; background: #fdfcfb;
    max-width: 46rem; margin-inline: auto;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #ede9e6; background: #14110f; }
    a { color: #ff9d6e; }
    .card { background: #1e1a17; border-color: #332d28; }
    code { background: #262019; }
  }
  header { border-bottom: 1px solid rgba(128,110,95,.28); padding-bottom: 1.25rem; margin-bottom: 2rem; }
  .brand { font-weight: 700; letter-spacing: -.01em; font-size: 1.05rem; color: #e2673a; }
  h1 { font-size: 1.65rem; line-height: 1.25; letter-spacing: -.02em; margin: .35rem 0 .25rem; }
  h2 { font-size: 1.1rem; margin-top: 2rem; letter-spacing: -.01em; }
  .updated { color: #7a6a5f; font-size: .875rem; margin: 0; }
  a { color: #c2410c; }
  ul { padding-left: 1.15rem; }
  li { margin: .3rem 0; }
  .card {
    background: #fff; border: 1px solid rgba(128,110,95,.24);
    border-radius: 12px; padding: 1rem 1.15rem; margin: 1.25rem 0;
  }
  code { background: #f2ede9; padding: .12rem .35rem; border-radius: 4px; font-size: .9em; }
  footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid rgba(128,110,95,.28); font-size: .875rem; color: #7a6a5f; }
  footer a { margin-right: 1rem; }
</style>
</head>
<body>
<header>
  <div class="brand">${ORG_NAME}</div>
  <h1>${title}</h1>
  <p class="updated">Last updated ${UPDATED}</p>
</header>
${body}
<footer>
  <a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Support</a><a href="/delete-account">Delete account</a>
  <p>${ORG_NAME} is operated by ${OPERATOR}. Contact <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
</footer>
</body>
</html>`;
}

legalRouter.get("/", (_req, res) => {
  res.type("html").send(
    page(
      "Hostel living, handled",
      `<p>${ORG_NAME} is the resident app for hostel students — room and rent,
mess menu and meal opt-ins, laundry, housekeeping, maintenance and complaints,
visitor passes, attendance and amenity bookings, all in one place.</p>

<div class="card">
  <h2 style="margin-top:0">Get the app</h2>
  <p>The app is currently in testing. If you were invited as a tester, use the
  link the hostel office sent you. Otherwise contact
  <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
</div>

<h2>For the hostel office</h2>
<p>The admin panel is at <a href="/admin/">/admin</a>.</p>`
    )
  );
});

legalRouter.get(["/privacy", "/privacy-policy"], (_req, res) => {
  res.type("html").send(
    page(
      "Privacy Policy",
      `<p>This policy explains what ${ORG_NAME} collects, why, and what control you
have over it. It applies to the ${ORG_NAME} mobile app and the hostel office
admin panel.</p>

<h2>Who we are</h2>
<p>${ORG_NAME} is operated by ${OPERATOR} on behalf of the hostel property you
live in. The hostel office is the party that decides what resident data is
needed; we process it for them.</p>

<h2>What we collect</h2>
<ul>
  <li><strong>Identity and contact</strong> — your name, date of birth, gender,
      mobile number, and profile photo if you add one.</li>
  <li><strong>Identity documents (KYC)</strong> — Aadhaar or PAN number and the
      document images you upload, so the hostel office can verify you against an
      ID proof before allocating a room.</li>
  <li><strong>Residency</strong> — your room, floor, wing, building and sharing
      type, your rental agreement and its signature, and your move-in checklist
      and room-condition inventory.</li>
  <li><strong>Service requests</strong> — maintenance, laundry, housekeeping,
      complaints, visitor requests, amenity bookings and any photos or remarks
      you attach to them.</li>
  <li><strong>Food and dining</strong> — meal opt-ins, dietary preferences,
      guest-meal bookings, meal ratings and mess entry records.</li>
  <li><strong>Attendance</strong> — the date, time and approximate location when
      you mark attendance, and whether it was marked by face capture, the phone's
      fingerprint sensor, or a QR scan.</li>
  <li><strong>Payments</strong> — invoices, receipts, deposit and refund records,
      instalment plans and split bills. We do not store card numbers, UPI PINs or
      bank credentials.</li>
  <li><strong>Device basics</strong> — app version and error logs needed to keep
      the app working.</li>
</ul>

<h2>Why we collect it</h2>
<ul>
  <li>To verify who you are and allocate you a room.</li>
  <li>To run the services you ask for — meals, laundry, cleaning, repairs, visits.</li>
  <li>To bill you accurately and give you receipts and statements.</li>
  <li>To record attendance where your hostel requires it.</li>
  <li>To notify you when the status of something you raised changes.</li>
</ul>

<h2>Camera, photos, location and biometrics</h2>
<div class="card">
<ul>
  <li><strong>Camera and photo library</strong> — used only when you attach a
      photo to a request, upload an ID document, or set a profile picture.</li>
  <li><strong>Location</strong> — read only at the moment you mark attendance, to
      confirm you are on the hostel premises. We do not track your location in
      the background.</li>
  <li><strong>Fingerprint / Face unlock</strong> — handled entirely by your phone.
      The app only receives a yes/no result. We never see, receive or store your
      biometric data, and it never leaves your device.</li>
</ul>
</div>

<h2>Who we share it with</h2>
<p>Your data is visible to <strong>the staff of your own hostel office</strong>,
who need it to run the services above. We do not sell your data, and we do not
share it with advertisers or data brokers. We share it outside the hostel office
only where the law requires it.</p>

<h2>Where it is stored</h2>
<p>Data is stored on servers located in India and is encrypted in transit over
HTTPS. Access is limited to hostel office staff and the technical staff who
maintain the service.</p>

<h2>How long we keep it</h2>
<p>We keep your data while you are a resident and for as long afterwards as the
hostel needs it to close out your account — typically settling your deposit and
final bills. Financial and tax records may need to be retained for up to eight
years under Indian law. Everything else is deleted when you ask us to.</p>

<h2>Your choices</h2>
<ul>
  <li><strong>See your data</strong> — most of it is visible in the app; ask us
      for the rest.</li>
  <li><strong>Correct it</strong> — through the app or the hostel office.</li>
  <li><strong>Delete it</strong> — from <em>Profile → Delete my account</em> in the
      app, or by following <a href="/delete-account">these instructions</a>.</li>
  <li><strong>Masked by default</strong> — your date of birth and KYC number are
      masked in the app and only revealed when you explicitly tap to show them.</li>
</ul>

<h2>Age</h2>
<p>${ORG_NAME} is intended for hostel residents aged 18 and over, which is the
target audience declared on Google Play. We do not knowingly collect data from
children. A resident under 18 should be registered by the hostel office with a
parent or guardian's consent; contact us if an account needs to be removed.</p>

<h2>Changes</h2>
<p>If we change this policy materially we will update the date above and notify
residents in the app.</p>

<h2>Contact</h2>
<p>Questions or requests: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`
    )
  );
});

legalRouter.get(["/delete-account", "/data-deletion", "/account-deletion"], (_req, res) => {
  res.type("html").send(
    page(
      "Delete your account and data",
      `<p>You can delete your ${ORG_NAME} account and the personal data attached
to it at any time. There are two ways to do it.</p>

<div class="card">
  <h2 style="margin-top:0">From inside the app (fastest)</h2>
  <ol>
    <li>Open ${ORG_NAME} and sign in.</li>
    <li>Go to the <strong>Profile</strong> tab.</li>
    <li>Scroll to the bottom and tap <strong>Delete my account</strong>.</li>
    <li>Confirm. You are signed out immediately and your account stops working
        straight away.</li>
  </ol>
</div>

<div class="card">
  <h2 style="margin-top:0">By email</h2>
  <p>Write to <a href="mailto:${CONTACT_EMAIL}?subject=Delete%20my%20${encodeURIComponent(
        ORG_NAME
      )}%20account">${CONTACT_EMAIL}</a> from the address you registered with, or
  include your registered mobile number so we can identify your account. We
  action these within 30 days.</p>
</div>

<h2>What gets deleted</h2>
<ul>
  <li>Your profile — name, date of birth, gender, mobile number, profile photo.</li>
  <li>Your KYC record and any uploaded ID document images.</li>
  <li>Your room allocation, rental agreement and signature, move-in checklist and
      room-condition inventory.</li>
  <li>All service requests — maintenance, laundry, housekeeping, complaints,
      visitor requests, amenity and guest-meal bookings — and their photos.</li>
  <li>Food preferences, meal ratings, mess entries and attendance records.</li>
  <li>Your notifications and feedback.</li>
</ul>

<h2>What is retained, and for how long</h2>
<p>Financial records — invoices, receipts, payments, deposit and refund entries —
are retained for up to <strong>eight years</strong> where Indian tax and
accounting law requires it. These are kept in the hostel's accounting records and
are no longer linked to an active app account. Deposit refunds still owed to you
are settled by the hostel office separately from account deletion.</p>

<h2>Timeline</h2>
<p>Access ends <strong>immediately</strong> when you confirm the deletion. The
records above are purged from live systems within <strong>30 days</strong>, and
from encrypted backups within <strong>90 days</strong>.</p>

<p>Questions: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`
    )
  );
});

legalRouter.get("/support", (_req, res) => {
  res.type("html").send(
    page(
      "Support",
      `<div class="card">
  <h2 style="margin-top:0">Get help</h2>
  <p>Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. We reply within
  one working day.</p>
  <p>For anything about your room, rent, meals or a request you have raised, the
  fastest route is usually your own hostel office reception.</p>
</div>

<h2>Common questions</h2>

<h2 style="font-size:1rem">I registered but I can't sign in</h2>
<p>New registrations are approved by the hostel office before sign-in works. If
it has been more than a working day, contact reception or email us.</p>

<h2 style="font-size:1rem">I'm not getting the OTP</h2>
<p>Check the number you entered matches the one you registered with. If it still
doesn't arrive, email us with your registered number.</p>

<h2 style="font-size:1rem">I forgot my MPIN</h2>
<p>Sign in with an OTP instead — you will be asked to set a new MPIN.</p>

<h2 style="font-size:1rem">My room screen is empty</h2>
<p>Your room shows up once the hostel office allocates one to you.</p>

<h2 style="font-size:1rem">How do I delete my account?</h2>
<p>See <a href="/delete-account">Delete your account and data</a>.</p>

<h2>Report a privacy concern</h2>
<p>Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> with "Privacy" in
the subject line.</p>`
    )
  );
});

legalRouter.get("/terms", (_req, res) => {
  res.type("html").send(
    page(
      "Terms of Use",
      `<p>By using ${ORG_NAME} you agree to these terms.</p>

<h2>Who can use it</h2>
<p>${ORG_NAME} is for residents of a hostel property that uses the service, and
for the staff of that hostel's office. Your account is created when the hostel
office approves your registration, and it belongs to you alone — do not share
your MPIN or let anyone else use your account.</p>

<h2>What the app does</h2>
<p>The app is a way to reach services your hostel already provides — meals,
laundry, housekeeping, repairs, visitor passes, attendance and payments. The
hostel, not ${OPERATOR}, delivers those services and sets their prices, timings
and rules.</p>

<h2>Your responsibilities</h2>
<ul>
  <li>Give accurate information, especially for identity verification.</li>
  <li>Raise requests in good faith and don't submit abusive or false content.</li>
  <li>Mark your own attendance only.</li>
  <li>Follow your hostel's own rules — the app doesn't replace them.</li>
</ul>

<h2>Payments</h2>
<p>Rent, deposits, service charges and guest-meal fees are set and collected by
your hostel. Invoices and receipts in the app reflect the hostel's records.
Disputes about an amount are settled with the hostel office.</p>

<h2>Identity documents and signatures</h2>
<p>ID verification in the app is a review by hostel staff, not a government
verification service. The rental agreement signature captured in the app records
your intent with your name, drawing and a timestamp; it is not a certified
electronic signature under the Information Technology Act.</p>

<h2>Availability</h2>
<p>We aim to keep the service running but cannot guarantee it is uninterrupted.
We may change or withdraw features.</p>

<h2>Ending your account</h2>
<p>You can delete your account at any time — see
<a href="/delete-account">Delete your account and data</a>. The hostel office may
close an account when you stop being a resident.</p>

<h2>Liability</h2>
<p>To the extent the law allows, ${OPERATOR} is not liable for indirect or
consequential loss arising from your use of the app. Nothing here limits
liability that cannot lawfully be limited.</p>

<h2>Governing law</h2>
<p>These terms are governed by the laws of India.</p>

<h2>Contact</h2>
<p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>`
    )
  );
});
