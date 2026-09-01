# Thapar — hostel resident app

Turborepo monorepo: an Expo / React Native app for hostel residents, backed by an
Express API, sharing one typed contract.

```
apps/
  mobile/          Expo SDK 57, React Native 0.86, expo-router — resident app
  admin/           Vite + React — hostel office web panel
  api/             Express 5 + TypeScript, Postgres via Drizzle
packages/
  shared/          @proj/shared — types & route constants used by all three
```

Built to the spec in `UNILIV_MOBILE_DESIGN_SYSTEM.md` (Sunset theme, DM Sans /
Hanken Grotesk / JetBrains Mono, flat cards with hairline borders, light + dark).

## Getting started

```bash
npm install
```

Create the database (once), then apply migrations and seed the demo resident:

```bash
createdb thapar && npm run db:migrate && npm run db:seed
```

Copy `apps/api/.env.example` to `apps/api/.env` first if `DATABASE_URL` needs
changing — it defaults to the local Unix socket with peer auth.

Then run the API and the app in **two separate terminals**:

```bash
npm run dev:api
```

```bash
npm run dev:mobile
```

> `npm run dev` starts everything at once, but Expo runs under Turbo there, so
> you won't get the QR code or the interactive keys (`a`, `i`, `r`). Use the two
> commands above for anything hands-on.

Android, iOS and web all build. Web is the quickest way to look at a change on a
Linux machine with no emulator — press `w`, or:

```bash
npm run web --workspace @proj/mobile
```

Web caveats: `expo-local-authentication` has no web implementation, so the
fingerprint and face paths won't work in a browser (the app falls back with a
message). Safe-area insets are always `0` on web, so anything inset-related has
to be checked on a real device.

And the admin panel:

```bash
npm run dev:admin
```

**Demo sign-in (resident app):** mobile `9876543210`, OTP `123456` (fixed in
dev — there's no SMS gateway wired up). Then set any 6-digit MPIN.

**Demo sign-in (admin panel):** `ops@thapar.test` / `thapar123` on
http://localhost:5173. A second reviewer exists as `warden@thapar.test`.

## Admin panel

The hostel office's side of the app. Home is a launcher of module tiles with
live nudges ("4 waiting", "2 open"), matching the design system's web pattern.

**Registrations** — a resident who registers in the app is `pending_approval`
and **cannot sign in** until someone approves them.

- Queue with pending / approved / rejected tabs and live counts.
- Detail view shows everything needed to check against an ID proof. The KYC
  number is masked by default with an explicit "Show" toggle — the full value
  is only fetched for that screen.
- Approve lets the resident sign in immediately. Reject requires a reason,
  because the resident is shown it when they next try to sign in.

**Requests** — one queue across all four modules (maintenance, laundry,
complaints, visits), filterable by type and status.

- Detail renders any kind from one screen: the API flattens kind-specific
  fields into label/value pairs.
- Move a request to *in progress*, *resolved* or *declined*. The note is
  appended to the resident's tracking timeline and pushed as a notification.
  Declining requires a reason.

**Residents** — searchable directory showing room, account status and open
request count.

- Allocate or change a room. Until this happens the resident's "My room"
  screen is empty, which the panel says explicitly.
- Set a payment plan and record payments against it; each one becomes a
  receipt in the resident's ledger.
- Attendance summary and recent requests, cross-linked to the request detail.

**Move-in** — onboarding progress per resident: review ID documents, issue the
rental agreement, see the signed signature, the roommate profile with suggested
pairings, the checklist, and the locked room-condition inventory.

**Feedback** — every rating with its average, linked back to the resident.

Things worth knowing about how it's wired:

- Status changes and registration decisions only match rows that are still
  open/pending. A stale tab gets a 409 telling it to refresh instead of
  silently reopening a closed request.
- Every admin write that a resident would care about — approval, room, payment,
  status change — also inserts a notification for them.

- Admin auth is separate from resident auth. Passwords are hashed with scrypt
  (node's own crypto, no extra dependency) and sessions are opaque random
  tokens in `admin_sessions` with a 12-hour expiry — not the `tok_<id>` scheme
  the resident app still uses.
- `tracking_events` has no foreign key, because it points at four different
  request tables. Deleting a resident cascades their requests away but leaves
  the events behind, so the seed purges orphans before inserting. Anything else
  that deletes requests needs to do the same.

## Onboarding and move-in

Four flows, reachable from the "Move in" tile on Home.

**ID documents (KYC)** — the resident uploads Aadhaar front/back and a photo
(PAN optional), sends them for review, and the office verifies or rejects with
a reason. Re-uploading after a rejection puts it back in the queue.

**Rental agreement** — the office issues terms (rent, deposit, notice period,
dates); the room details are **snapshotted into the agreement at issue time**,
so it stays truthful even if the room changes later. The resident reads the
terms and house rules, ticks a confirmation, types their name, and signs on a
draw-to-sign pad. The signature is stored as SVG path data and rendered back on
both sides with a timestamp.

**Roommate matching** — a short questionnaire (sleep schedule, tidiness, noise,
social level, study location, guests, smoking, food). Compatibility is a
**weighted similarity score, not a black box**: each dimension contributes a
0–1 agreement weighted by how much friction it actually causes, and every match
lists the specific reasons for and against. The office sees the same rankings
when allocating a room.

**Move-in checklist** — eight steps, three of which are owned by another flow
and tick themselves when that flow completes (documents on verification, the
agreement on signing, inventory on submission) rather than being manually
tickable. The room-condition inventory requires a photo for anything damaged or
missing, and **locks permanently once submitted** — it's the reference both
sides rely on at move-out.

**Look around** — a drag-to-look panorama viewer with hotspots between spaces,
and a to-scale top-down room planner where furniture can be dragged around to
see what fits.

### What needs a vendor

Two things here are built up to a boundary I can't cross in code:

- **KYC is manual review, not government verification.** Documents are checked
  by a person at the office. Real Aadhaar verification needs a licensed
  UIDAI AUA/KUA or DigiLocker OAuth. `kyc_records.provider` is `"manual"` and
  the code is structured so a real provider slots in behind it.
- **The signature is an in-app record, not a certified eSign.** It captures
  intent with a name, drawing and timestamp. Legally-binding e-signing needs
  Aadhaar eSign (NSDL/eMudhra) or equivalent. The app says this to the resident
  rather than implying otherwise.

And two are approximations rather than the full ask:

- **The tour is a 2D panorama pan, not a 3D walkthrough.** It reads correctly
  for a single room and needs no native module. Real 3D capture is a Matterport
  -class vendor job. Panorama photos have to be supplied by the property —
  `panoramaUri` is null until then and the viewer shows a placeholder.
- **The room planner is top-down, not AR.** True plane-detection AR needs
  ARKit/ARCore through a development build. The planner answers the same
  question — will my things fit — and works on every phone today.

## Money: invoices, payments, deposits and splits

**Invoices** — `Run billing` in the admin Money module creates one rent invoice
per signed agreement for a month. It is **idempotent**: the unique index on
`(resident, period)` means running it twice skips rather than double-charging.
"Overdue" is derived from the due date at read time, so no nightly job is
needed.

**Paying** — UPI, card, net banking or auto-debit. Every payment goes through a
`PaymentProvider` interface with one mock implementation. Orders start
`pending` and are settled by a **webhook**, exactly as a real gateway behaves,
so the async path is the one exercised in development.

- **Idempotency keys** — retrying the same tap returns the original order
  rather than charging twice.
- **`settleOrder` is the single place an order becomes final**, and its status
  filter makes it safe to replay: a webhook delivered twice returns
  `applied: false` and the ledger is not credited again.
- A successful payment credits the invoice **and** writes into the existing
  `payment_entries` ledger, so the ledger stays the one record of what's been
  paid however it was paid.

**Auto-debit** — mandate lifecycle (pending → active → paused → revoked) with a
per-debit ceiling the API enforces before it even reaches the gateway. Capped
at day 28 so every month has the date.

**Instalments** — split an invoice into 2, 3, 4 or 6 with a flat convenience
fee. The last instalment absorbs the rounding so the parts sum to the total
exactly.

**Deposit** — amount held, itemised deductions with reasons, and a three-stage
refund (held → in progress → refunded). Deductions **lock once the refund
starts**, and the policy is shown to the resident up front.

**Split bills** — split with roommates (listed first), each share tracked and
payable in-app. The creator's own share is settled from the start, the
remainder rounds to them so shares sum exactly, and the bill closes itself when
the last share settles.

**Documents** — invoices, rent receipts, an annual HRA statement and an account
statement, rendered as print-ready HTML. They open in the system browser, which
can't send a bearer token, so the app requests a **short-lived HMAC-signed URL**
scoped to one document for one resident.

### What needs a vendor

- **No money moves.** The provider is a mock: it creates references and drives
  the real webhook, but there is no PSP behind it. Going live means writing one
  more `PaymentProvider` implementation (Razorpay/Stripe) and pointing
  `provider` at it — routes, order lifecycle, webhook and reconciliation are
  unchanged, because none of them know which provider is live.
- **Auto-debit registers no real mandate.** UPI AutoPay or eNACH needs the same
  PSP relationship.
- **"Pay later" is a schedule, not credit.** The instalment plan tracks what's
  owed and when; actually financing it needs a lending partner.
- **Documents are HTML, not PDF.** Every browser can save them as PDF; native
  PDF generation would slot in behind the same routes.

## Daily living and hotel-style services

**Mess menu** — now in the database, not code. Each meal has a serving window
and dishes carrying dietary tags (veg, vegan, Jain, gluten-free, high-protein,
low-carb). A resident sets their own filter and the menu **annotates rather
than hides**: dishes that fit are marked, and each meal shows "3 of 5 fit your
diet", so nobody is left guessing what else was served. Matching is strict AND
— a Jain + gluten-free filter only matches dishes carrying both tags.

The first time a day is requested it seeds from the old code rotation, so the
menu is never empty. After that the admin editor is the only thing that
changes it.

**Meal ratings and vendor SLA** — residents rate a served meal 1–5, one rating
per meal per day (re-rating updates rather than stacking, so the score can't be
swung by one person). Admin sees a rolling 30-day average against a 3.5 target,
a breach flag, a per-meal breakdown, and — the actionable part — **which dishes
were on the plate when people rated badly**.

**Guest meals** — book 1–6 guests a day ahead, priced per meal and charged to
the next invoice.

**Laundry** — weekly subscription tiers alongside one-off orders, four service
types including dry-cleaning, and a real stage pipeline: scheduled → picked up
→ washing → ready → out for delivery → delivered. Stages only move **forward**,
and each one writes to the shared tracking timeline and notifies the resident,
so "All requests" never disagrees with the tracker.

**Housekeeping** — routine cleans (included) plus paid add-ons: deep cleaning,
bathroom sanitisation, upholstery, pest control. Fixed slots so the team can be
routed; a resident can't double-book a slot.

**Amenities** — coworking pod, study room, gaming zone and rooftop BBQ, each
with its own capacity, slot length and opening hours. Slots are generated from
those hours; capacity is enforced in code (it varies per amenity) and a unique
index stops the same person holding a slot twice. Taking the last place returns
a 409 telling the next person to pick another.

## Database

PostgreSQL via **Drizzle ORM**. Schema is in
[`apps/api/src/db/schema.ts`](apps/api/src/db/schema.ts); generated SQL
migrations live in `apps/api/drizzle/`.

| Command | What it does |
| --- | --- |
| `npm run db:generate` | Diff the schema and write a new migration |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Reset and re-seed the demo resident (idempotent) |
| `npm run db:studio` | Drizzle Studio, a browser GUI for the data |

15 tables. Notes on the design:

- Status and enum columns are `text` typed with Drizzle's `$type<>()`, so the
  unions stay defined once in `@proj/shared` rather than duplicated as PG enums
  that need a migration every time a value is added.
- Laundry line items and visit food selections are `jsonb` — they're only ever
  read as a whole with their parent row, so a join table would buy nothing.
- `tracking_events` is one table for every request kind: same shape, same query.
- `attendance_records` has a unique index on `(resident_id, date)`, so
  one-mark-per-day is enforced by the database, not just the route.
- Request ids (`MNT-1042`) come off a shared Postgres sequence, so concurrent
  inserts can't collide and a number is never reused across modules.
- Everything cascades from `residents`, which is what makes the seed idempotent.

All database access goes through [`apps/api/src/data/db.ts`](apps/api/src/data/db.ts).
Routes never import Drizzle directly.

## What's built

**Onboarding** — registration wizard (name → DOB and gender → PAN/Aadhaar →
mobile), which submits for hostel-office approval. Then OTP sign-in, 6-digit
MPIN setup, and optional device biometrics. Returning devices land straight on
the MPIN pad.

**Home** is the launcher: greeting, room scope, a daily progress ring, search
that filters tiles, and a grid of the eleven modules with live nudges
("Due today", "2 open").

| Module | What it does |
| --- | --- |
| Profile | Masked DOB and KYC with per-field unmask, theme toggle, sign out |
| My room | Room, floor, wing, building, property, sharing type |
| Payments | Plan, amount paid, next due, receipt history |
| Food | 7-day menu, per-meal opt in/out, pause and resume by date range |
| Room maintenance | Category → sub-category → remarks → photos, request ID, timeline |
| Laundry | Per-type counts, pressing flags, pickup slot, mandatory hand-over photo |
| Complaints | Category → sub-category → remarks, optionally linked to a request |
| Visitors | Visitor, relation, date, duration, and meals picked from that day's menu |
| Attendance | Geo-located marking by face or fingerprint, streak, history |
| Feedback | Category, 1–5 stars, remarks, photos |
| Mess entry | Face, fingerprint or QR at the dining hall |
| All requests | Every request across modules, filterable by kind |

Every request gets an ID and a status timeline. Status is always shown as colour
+ icon + word together.

## API

Base URL `http://localhost:4000`. Routes are declared once in
`packages/shared/src/types.ts` (`API_ROUTES`) and consumed by both sides.

`/api/health` and `/api/auth/*` are open; everything else needs
`Authorization: Bearer <token>`. Every query is scoped to the resident on the
token, so one resident can't read another's data. Errors come back as
`{ error, message }` with a plain-language message meant to be shown to the
resident as-is.

Reference data that isn't per-resident (categories, menu rotation, pickup slots)
stays in code at `apps/api/src/data/catalog.ts` — move it to the database when
the office needs to edit it without a deploy.

## How the app finds the API

`apps/mobile/src/api/client.ts` resolves the base URL in this order:

1. `EXPO_PUBLIC_API_URL`, or `extra.apiUrl` in `app.json` — set one for staging
   and production.
2. The LAN IP Metro is already serving from, so a physical device on the same
   Wi-Fi works with no configuration.
3. `localhost`, using `10.0.2.2` on Android emulators.

The API binds `0.0.0.0` so case 2 actually reaches it.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Metro + API + shared package in watch mode |
| `npm run dev:api` / `dev:mobile` | One at a time |
| `npm run build` | Compiles `shared` then `api` to `dist/` |
| `npm run typecheck` | `tsc --noEmit` across every workspace |

## Monorepo notes

- `apps/mobile/metro.config.js` sets `watchFolders` to the repo root and
  `nodeModulesPaths` to both the app's and the root's `node_modules`. Metro does
  not walk parent directories on its own — without this, `@proj/shared` won't
  resolve.
- `@proj/shared` is consumed as compiled output; Turbo's `dependsOn: ["^build"]`
  guarantees it's built before the app or API starts.
- Fonts are imported per weight (`@expo-google-fonts/dm-sans/400Regular`), not
  from the package root — the root re-exports ~40 weights and italics and drags
  every one into the bundle.
- npm workspaces, not pnpm — the hoisted layout is what React Native's resolver
  expects with the least fighting.

## A note on the existing `uniliv` database

There is a separate `uniliv` database on this machine with 141 tables and real
data — the Uniliv **admin** app's database, including its own `residents`,
`rooms`, `payments`, `attendance`, `complaints` and `laundry_batches`. This
project deliberately uses its own `thapar` database and does not touch
it. The `adish` role has no read grant on those tables anyway.

If this app should instead read from the admin database as the system of record,
that's a different piece of work: credentials, a schema mapping from these 15
tables onto those, and a decision about which side owns writes.

## Not done yet

- **Auth is a demo.** The token is `tok_<residentId>`, not a signed JWT; the OTP
  is hard-coded `123456`; the MPIN is stored in plain text. All of this needs
  replacing before any real use.
- **Single resident.** Only the seeded demo resident exists. Registration
  creates rows but nothing can approve them yet.
- **Photos are local URIs.** They're sent as `file://` strings and never
  uploaded — object storage is still to be wired up.
- **Face recognition is a camera capture**, not identity matching. Fingerprint
  uses the phone's own sensor via `expo-local-authentication`, which proves the
  phone's owner is present, not which resident they are.
- **No AR or 3D tours, and no certified eSign or Aadhaar API** — see the
  vendor boundaries under Onboarding above.
- **The mess vendor SLA is measured, not enforced.** The score and breach flag
  are there; escalating a breach is still a conversation, not a workflow.
- **Laundry subscriptions don't auto-create pickups.** The plan and next pickup
  date are tracked, but a scheduled job to raise the weekly order doesn't exist.
- **No payment gateway.** See the vendor note under Money — the flow is
  complete but nothing is charged.
- **No mess/menu admin.** The weekly menu, categories and laundry slots are
  still hardcoded in `apps/api/src/data/catalog.ts`. Editing them without a
  deploy means moving that reference data into the database first.
- **No role gating.** Both seeded admins see everything. `AdminRole` exists on
  the user but nothing branches on it yet; the design system's rule is that
  role-gating hides rather than disables.
- **No bulk actions or pagination.** Every list loads in full, which is fine at
  hostel scale but not at thousands of rows.
- **Attendance is read-only** for admins, and parents/guardians still have no
  way in at all.
- **No parent/guardian access**, though the notes call for parents to see
  attendance.
- Web is not configured (`react-native-web` isn't installed); iOS and Android
  both bundle.
