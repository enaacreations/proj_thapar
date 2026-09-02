# Store listing copy — UniLiv

The text below is what goes into Play Console and App Store Connect. Keep this
file as the source of truth; edit here first, then paste, so the two stores
don't drift apart.

## Identity

| | |
| --- | --- |
| App name | UniLiv |
| Package / bundle id | `com.projthapar.app` |
| Category | House & Home (Play) / Lifestyle (App Store) |
| Content rating target | Everyone (IARC) / target audience 18+ |
| Countries | India |
| Price | Free, no in-app purchases, no ads |

## Short description (Play, 80 characters max)

```
Rent, mess, laundry and repairs for your hostel room — all in one app.
```

*69 characters.*

## Full description (Play, 4000 characters max)

```
UniLiv is the resident app for your hostel. Everything you would
otherwise queue at the office for — your room, your rent, your meals, a leaking
tap — happens on your phone, and you can see exactly what is happening with each
request.

YOUR ROOM AND YOUR RENT
See your room, floor, wing and building, and your sharing type. Check what you
have paid, what is due next, and pull up any receipt. Split a bill with your
roommates and track each share. Deposit and refund status is visible from the
start, including any deductions and why they were made.

THE MESS, YOUR WAY
A seven-day menu with the serving window for every meal. Opt in or out per meal,
and pause your meals while you are away. Set a dietary filter — vegetarian,
vegan, Jain, gluten-free, high-protein, low-carb — and the menu marks which
dishes fit rather than hiding the rest, so you always know what is being served.
Rate a meal after you have eaten it, and book guest meals a day ahead.

LAUNDRY, CLEANING AND REPAIRS
Book a laundry pickup with a per-item count and a hand-over photo, or take a
weekly subscription. Book routine or deep cleaning in a fixed slot. Report a
maintenance problem by category with photos and a note.

Every request gets an ID and a live status timeline, so "when is someone coming"
has an answer you can read yourself.

VISITORS AND ATTENDANCE
Raise a visitor request with the date, duration and the meals your guest will
eat. Mark hostel attendance with your face or your phone's fingerprint sensor,
and see your streak and history.

BOOK A SPACE
Reserve the coworking pod, study room, gaming zone or rooftop BBQ. Slots and
capacity are shown up front, so you know before you walk over.

MOVING IN
Upload your ID documents for the office to verify, read and sign your rental
agreement, answer a short roommate questionnaire that explains why it matched
you with someone, and record the condition of your room before you unpack.

EVERYTHING IN ONE PLACE
"All requests" collects every maintenance job, laundry order, complaint and
visit in one filterable list, so nothing gets lost between modules.

UniLiv works only with hostels that use the service. Your registration is
approved by your hostel office before you can sign in.

Questions: support@enaacreations.com
Privacy policy: https://thapar.enaacreations.com/privacy
Delete your account: https://thapar.enaacreations.com/delete-account
```

## App Store subtitle (30 characters max)

```
Your hostel, in your pocket
```

*26 characters.*

## App Store promotional text (170 characters max)

```
Rent, mess menu, laundry, repairs, visitors and attendance — with a live status
on every request you raise. Built for hostel residents.
```

## App Store description

Use the Play full description above verbatim; it is within Apple's 4000
character limit and reads the same on both stores.

## Keywords (App Store, 100 characters max, comma separated)

```
hostel,pg,student,mess,laundry,rent,housekeeping,roommate,attendance,hostel life
```

*79 characters.*

## URLs

| Field | Value |
| --- | --- |
| Privacy policy | https://thapar.enaacreations.com/privacy |
| Terms of use | https://thapar.enaacreations.com/terms |
| Support / marketing | https://thapar.enaacreations.com/support |
| Account deletion (Play Data safety) | https://thapar.enaacreations.com/delete-account |
| Support email | support@enaacreations.com |

## Reviewer / demo account

Both stores need to be able to sign in. There is no SMS gateway, so the API
keeps a fixed OTP for allow-listed numbers only (`REVIEW_OTP_PHONES` in
`apps/api/.env` on the server).

| | |
| --- | --- |
| Mobile number | `9876543210` |
| OTP | `123456` |
| MPIN | set any 6 digits when prompted, e.g. `123456` |

**Review notes to paste into both consoles:**

```
Sign in with mobile number 9876543210 and OTP 123456. The app then asks you to
set a 6-digit MPIN — enter any 6 digits (for example 123456) and continue. You
will land on the home screen of a fully populated demo resident account.

There is no SMS gateway in this build. The fixed OTP above works only for this
allow-listed demo number; every other number receives a random code that is
never disclosed by the API.

Account deletion is in the app at Profile (bottom tab) -> scroll to the bottom
-> "Delete my account". It is also documented at
https://thapar.enaacreations.com/delete-account

Attendance uses location only at the moment the resident taps "Mark today's
attendance", to confirm they are on the hostel premises. Face and fingerprint
are the phone's own biometrics; no biometric data leaves the device.

The app is for residents of hostels that use this service. Accounts are approved
by the hostel office, which is why registration does not immediately grant
sign-in.
```

## Assets

| Asset | Path | Size |
| --- | --- | --- |
| Play app icon | `store/assets/play-icon-512.png` | 512×512 |
| Play feature graphic | `store/assets/play-feature-graphic.png` | 1024×500 |
| Phone screenshots (both stores) | `store/assets/screenshots/phone/*.png` | 1290×2796 |

The screenshots are regenerated by running the Expo web build and capturing at
a 430×932 viewport with `deviceScaleFactor: 3`.

## Data safety / App Privacy — what the app collects

Both stores ask essentially the same questions. Answers, with why:

| Data | Collected | Linked to user | Used for | Notes |
| --- | --- | --- | --- | --- |
| Name | Yes | Yes | App functionality | Identity for the hostel office |
| Email address | No | — | — | Not collected |
| Phone number | Yes | Yes | App functionality, Account management | Sign-in identifier |
| Date of birth | Yes | Yes | App functionality | Masked in the UI by default |
| Government ID (Aadhaar/PAN) | Yes | Yes | App functionality | KYC review by hostel staff |
| Photos | Yes | Yes | App functionality | Request evidence, ID documents, profile photo |
| Approximate location | Yes | Yes | App functionality | Only while marking attendance; never in background |
| Payment info | No | — | — | No card or bank details stored; no gateway is live |
| Purchase history | Yes | Yes | App functionality | Invoices and receipts |
| App interactions | Yes | Yes | App functionality | Requests and bookings the resident makes |
| Crash logs / diagnostics | No | — | — | No crash-reporting or analytics SDK is integrated |

- Data is **encrypted in transit** (HTTPS).
- Users **can request deletion** — in-app and via the web page.
- Data is **not shared** with third parties.
- Data is **not used** for advertising, marketing, analytics or tracking. There is
  no analytics or crash-reporting SDK in the app at all.
- Biometrics are **not collected**: `expo-local-authentication` returns only a
  pass/fail from the device.
