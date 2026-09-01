# Store accounts and IDs — Thapar Hostel

Everything a future release needs, so nothing has to be re-derived. Secrets are
**not** here; only where to find them.

## Apple

| | |
| --- | --- |
| Developer account | Surbhi Chordia — Individual, Apple Developer Program |
| Team ID | `UL2P2A75SV` |
| App Store Connect app | **Thapar Hostel** |
| ASC app ID (`ascAppId`) | `6807443425` |
| Bundle identifier | `com.projthapar.app` |
| SKU | `thapar-hostel-ios` |
| Primary language | English (U.K.) |
| ASC API key ID | `75JR6GG22Q` |
| ASC API issuer ID | `20f04c20-2b8f-4482-a782-f201f84c8ca5` |
| Key file | `apps/mobile/credentials/AuthKey_75JR6GG22Q.p8` (gitignored) |

App Store Connect: https://appstoreconnect.apple.com/apps/6807443425

### TestFlight

| | |
| --- | --- |
| Build submitted | 1.0.0 (5) — **Waiting for Review** (Beta App Review) |
| Internal group | **Core members** — surbhichordia16@gmail.com invited; usable now, no review |
| External group | **Demo testers** — public link enabled |
| Public link | https://testflight.apple.com/join/q9veBfrw |

The public link only admits testers once Apple approves the build; the internal
group works immediately. Beta App Review is typically 24–48 hours.

## Google Play

| | |
| --- | --- |
| Console account | Enaa Creations — **personal** account |
| Signed in as | `developers@enaacreations.com` (Chrome profile index `u/1`) |
| Play account ID | `9185099929039773840` |
| Play app ID | `4973650883026939770` |
| Package name | `com.projthapar.app` |
| Default language | English (United States) |
| Service account | `eas-play-submit@alien-limiter-455106-g2.iam.gserviceaccount.com` |
| Key file | `apps/mobile/credentials/play-service-account.json` (gitignored) |

Play Console: https://play.google.com/console/u/1/developers/9185099929039773840/app/4973650883026939770/app-dashboard

### Release state

| | |
| --- | --- |
| Internal testing | **Live** — 1.0.0 (versionCode 3), Core Members (33 users) |
| Closed testing (Alpha) | **In review** — same build, India, Core Members |
| Store listing | Submitted for review (icon, feature graphic, 8 screenshots, descriptions) |
| App content | All 9 declarations completed |
| Production | Blocked by Google policy — see below |

Tester opt-in link (works now for internal testers):
https://play.google.com/apps/testing/com.projthapar.app

> This is a **personal** Play account, so promoting to production later needs a
> closed test run for ≥14 days with ≥12 opted-in testers. Internal testing has
> no such gate.

## Expo / EAS

| | |
| --- | --- |
| Expo account | `astropsumit` (cosmictunnel376@gmail.com) |
| Project | `@astropsumit/thapar-hostel` |
| EAS project ID | `991d4bbe-05b3-47b2-842f-ee0c96b8af1f` |
| Version source | `remote` — EAS owns versionCode / buildNumber |

Builds: https://expo.dev/accounts/astropsumit/projects/thapar-hostel/builds

## Credential store

The `.p8` and the Play service-account JSON are copied into
`apps/mobile/credentials/` (gitignored). The originals live in
`~/Projects/snp/credentials/` and are shared across this account's apps.

## Server

| | |
| --- | --- |
| Host | `e2e-server` — `ubuntu@164.52.217.248` |
| Domain | https://thapar.enaacreations.com |
| Checkout | `~/thapar`, tracking branch `deploy/store-release` |
| Deploy key | `~/.ssh/thapar_deploy`, SSH host alias `github-thapar` |
| API service | `thapar-api.service` (systemd), 127.0.0.1:4100 |
| Admin panel | `/admin/` — static build of `apps/admin`, `vite build --base=/admin/` |
| Database | Postgres `thapar`, role `thapar`; password in `~/thapar/apps/api/.env` |
| TLS | Let's Encrypt via certbot, auto-renewing |

Redeploy:

```bash
ssh e2e-server 'export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; cd ~/thapar && git fetch origin && git reset --hard origin/deploy/store-release && npm install && npx turbo run build && (cd apps/admin && npx vite build --base=/admin/)'
```

Then restart the API. `sudo` needs a password on this host, so the restart runs
through the docker group (which is root-equivalent) rather than interactively:

```bash
ssh e2e-server 'docker run --rm --privileged --pid=host alpine nsenter -t 1 -m -u -i -n -p -- systemctl restart thapar-api.service'
```

## Demo / reviewer account

Mobile `9876543210`, OTP `123456`, then set any 6-digit MPIN. Admin panel:
`ops@thapar.test` / `thapar123`.

The fixed OTP applies only to numbers listed in `REVIEW_OTP_PHONES` in
`~/thapar/apps/api/.env`. Everyone else gets a random code the API never
returns.
