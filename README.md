# Uniliv — Thapar hostel resident app

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
createdb uniliv_thapar && npm run db:migrate && npm run db:seed
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

**Demo sign-in (admin panel):** `ops@uniliv.test` / `uniliv123` on
http://localhost:5173. A second reviewer exists as `warden@uniliv.test`.

## Admin panel

The hostel office reviews registrations here. A resident who registers in the
app is `pending_approval` and **cannot sign in** until someone approves them.

- **Queue** with pending / approved / rejected tabs and live counts.
- **Detail view** shows everything needed to check against an ID proof. The
  KYC number is masked by default with an explicit "Show" toggle — the full
  value is only fetched for that screen.
- **Approve** lets the resident sign in immediately. **Reject** requires a
  reason, because the resident is shown it when they next try to sign in.
- Every decision records who made it, when, and the note.

Two things worth knowing about how it's wired:

- Admin auth is separate from resident auth. Passwords are hashed with scrypt
  (node's own crypto, no extra dependency) and sessions are opaque random
  tokens in `admin_sessions` with a 12-hour expiry — not the `tok_<id>` scheme
  the resident app still uses.
- Approve/reject only matches rows that are still `pending_approval`. If two
  reviewers open the same registration, the second one gets a 409 telling them
  to refresh rather than silently overwriting the first decision.

Approving does **not** allocate a room or payment plan — those screens show a
"nothing allocated yet" state for a freshly approved resident. Room allocation
is a separate module that doesn't exist yet.

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
project deliberately uses its own `uniliv_thapar` database and does not touch
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
- **The admin panel only covers registrations.** Moving maintenance, laundry,
  complaint and visit requests through their statuses still has no UI — those
  can only be changed in the database.
- **No room allocation.** Approving a registration doesn't give the resident a
  room or a payment plan.
- **No parent/guardian access**, though the notes call for parents to see
  attendance.
- Web is not configured (`react-native-web` isn't installed); iOS and Android
  both bundle.
