# Assobiador — Session Summary

## What's Been Built (Phases 1-3 partial)

### Phase 1: Foundation — COMPLETE

**Monorepo structure** fully set up with pnpm workspaces + Turborepo:
- Root config: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`, `.prettierrc`, `.gitignore`
- All builds pass across all packages and apps

**4 shared packages:**

| Package | Key Files | What it does |
|---|---|---|
| `packages/types` | `user.ts`, `battle.ts`, `submission.ts`, `payment.ts`, `vote.ts`, `common.ts` | Zod schemas + TS types for every Firestore collection |
| `packages/firebase` | `client.ts`, `admin.ts`, `auth.ts`, `firestore.ts` | SDK init, `useAuth()` hook (Google/Apple/Email), `useDocument()` and `useCollection()` real-time hooks |
| `packages/utils` | `points.ts`, `validation.ts`, `formatting.ts` | Rank system (7 tiers), video URL detection (YT/TikTok/IG), pt-BR formatting (currency, dates, numbers) |
| `packages/ui` | `button.tsx`, `input.tsx`, `textarea.tsx`, `card.tsx`, `badge.tsx`, `avatar.tsx`, `skeleton.tsx`, `empty-state.tsx`, `stat-card.tsx`, `progress-bar.tsx` | Dark glassmorphism design system with CVA variants, 44px min touch targets |

**2 Next.js 14 apps:**
- `apps/web` (port 3000) — Public app with Firebase App Hosting config (`apphosting.yaml`)
- `apps/admin` (port 3001) — Admin panel (stub pages)

**Firebase backend** (`firebase/`):
- `firestore.rules` — Full security rules (users can't modify own role/points/xp, payments never client-writable)
- `firestore.indexes.json` — 8 composite indexes
- 6 Cloud Functions:
  - `onUserCreate` (v1 auth trigger) — creates user doc with defaults
  - `onPaymentWebhook` (v2 onRequest) — Mercado Pago webhook handler with idempotency
  - `expirePayments` (v2 scheduler, every 30min)
  - `onVoteCreate` (v2 onDocumentCreated) — increments vote count, prevents duplicates
  - `finalizeBattle` (v2 onCall, admin-only) — tallies votes, awards points, updates ranks
  - `scheduledBattleStatusUpdater` (v2 scheduler, every 15min) — auto-transitions battle phases

---

### Phase 2: Auth + Profiles — COMPLETE

**Auth pages:**
- `/entrar` — Login with Google + Apple + Email/Password
- `/cadastro` — Register with Google + Apple + Email/Password

**Profile pages:**
- `/perfil/[userId]` — Public profile with LoL-style rank banner, XP progress bar, stats, badges
- `/meu-perfil` — Edit own profile (name, bio, photo)

**Layout components:**
- `header.tsx` — Sticky glass header, auth-aware (avatar dropdown vs login/register), mobile hamburger
- `mobile-nav.tsx` — Slide-in panel with user section, nav links
- `footer.tsx` — 4-column footer

**Other pages:**
- `/` — Content-first homepage showing live battles, top 5 leaderboard, platform stats, recent winners (no auth required)
- `/ranking` — Full leaderboard with gold/silver/bronze top-3
- `/loading.tsx`, `/not-found.tsx`, `/error.tsx` — Loading, 404, error boundary

---

### Phase 3: Battles Core — PARTIAL

**Done:**
- `/batalhas` — Battle listing with **status/category/type filters** (chip-based UI, client-side filtering, clear button, result count)
- `/batalhas/[battleId]` — Battle detail with gradient header, timeline, rules, contextual CTAs (register/vote based on status)
- `/batalhas/[battleId]/participar` — Battle entry flow for free battles using trusted API route instead of direct client Firestore writes
- `/api/battle-entries/free` — Server-owned free battle entry creation with Firebase ID token verification, transaction-based duplicate/capacity checks, confirmed entry creation, and participant increment
- Battle status auto-transitions — Cloud Function already in place

**Not done:**
- Admin battle CRUD (create/edit forms, battle table) — skipped per your request to defer admin work
- Paid battle entry (redirects to payment flow — Phase 4)

---

### Phase 4: Payments (Pix) — PARTIAL

**Done:**
- Payment creation API route (`apps/web/src/app/api/payments/create/route.ts`) — creates Mercado Pago Pix payment, pending `payments` doc, and pending `battleEntries` doc
- Payment status API route (`apps/web/src/app/api/payments/[paymentId]/status/route.ts`) — verifies owner and returns status, entry ID, and expiration
- `PixPayment` component (`apps/web/src/components/payments/pix-payment.tsx`) — QR code display, copia-e-cola copy button, countdown, manual status check, and 5s polling
- `/batalhas/[battleId]/pagamento` — paid battle payment page with auth checks, battle validation, Pix creation, retry, and success/expired states

---

## What's Left

### Phase 3 remaining (deferred)
- Admin panel: battle create/edit form, battle management table, sidebar layout

### Phase 4: Payments (Pix)
- Payment creation API route — done
- `PixPayment` component — done
- `/batalhas/[battleId]/pagamento` page for paid battle entry — done
- Payment status polling route — done
- Remaining: test against real Mercado Pago sandbox credentials and deployed webhook

### Phase 5: Submissions + Voting
- `/batalhas/[battleId]/enviar` — Video URL submission form with embed preview
- Admin moderation page — approve/reject submissions
- `/batalhas/[battleId]/votar` — Voting interface with embedded videos
- `/batalhas/[battleId]/resultado` — Results page with ranked submissions

### Phase 6: Leaderboard + Rankings
- `finalizeBattle` Cloud Function is already built
- Admin UI to trigger battle finalization
- Connect finalization to the existing leaderboard/ranking pages

### Phase 7: Polish
- Mobile responsiveness pass
- Performance optimization (<2.5s load)
- Error handling + loading states review
- pt-BR copy review

### Phase 8: Testing + Deploy
- Firestore rules tests
- Payment integration tests
- Component tests
- CI/CD (GitHub Actions)
- Production deploy to Firebase App Hosting

---

## Quality/Security Checkpoint

Current status:
- Initial automated tests now exist for shared battle entry eligibility and the free-entry transaction service.
- `web` type-check and production build pass after the Phase 4 Pix payment/free-entry hardening work.
- Added repo-level instructions in `AGENTS.md`: every feature must include automated tests, client-side checks are not trusted for protected workflows, and `SESSION-SUMMARY.md` must be updated after meaningful changes.
- Payment creation/status routes verify Firebase ID tokens server-side and only expose payment status to the payment owner.
- Firestore rules prevent direct client writes to `payments` and admin-only `battles`, but several client-writable collections need stricter schema/state validation before the app grows.

Latest hardening/refactor:
- Added Vitest workspace dependency and wired `test` scripts for `apps/web` and `packages/utils`.
- Added shared battle entry eligibility logic in `packages/utils/src/battle-entry.ts`.
- Added unit tests for entry eligibility and web free-entry transaction service.
- Moved free battle entry from client Firestore batch writes to trusted server API route `apps/web/src/app/api/battle-entries/free/route.ts`.
- Added server helpers for API errors/auth and a `createFreeBattleEntry` transaction service.
- Reused shared entry eligibility checks in paid payment creation route to reduce duplicated hard-coded rules.
- Added API route tests for free battle entry, payment status, and payment creation authorization/validation paths.
- Added malformed JSON/body handling helper and tests so bad API requests return 400 instead of generic 500s.
- Added Mercado Pago payment creation failure coverage.
- Extracted payment webhook processing into `firebase/functions/src/payments/webhook-handler.ts` with tests for ignored events, approved payments, rejected/cancelled payments, duplicate webhooks, and ignored statuses.
- Added Firestore emulator rules tests in `firebase/firestore.rules.test.ts` and wired them into `pnpm test`.
- Hardened Firestore rules so battle entries, submissions, votes, payments, battle writes, and protected profile fields are not client-writable.
- Added Firebase emulator config on local ports: Firestore `127.0.0.1:8085`, websocket `9155`, UI `127.0.0.1:4000`.
- Added shared Firestore timestamp conversion helper in `packages/utils/src/dates.ts` and replaced duplicated page-local helpers.
- Extracted Cloud Functions ranking/points/prize helpers into `firebase/functions/src/domain/ranking.ts` with unit tests.
- Updated API routes to avoid logging expected `ApiError` authorization/validation failures as server errors.

Security/test work to do before expanding features:
- Add integration coverage for real Mercado Pago sandbox payload shapes once credentials/webhook URL are available.
- Harden vote/submission rules before their UIs are built: validate allowed fields, ownership, battle phase, entry status, vote weight, and duplicate behavior.
- Add scheduled payment expiration handler tests.

Code quality audit:
- Overall code level: mid-level prototype/MVP code. It has good monorepo/package structure, typed schemas, reusable UI primitives, and reasonable Firebase separation, but it lacks automated tests, service-layer boundaries, stronger server-side workflows, and consistent domain reuse.
- Not senior/specialist yet because core business rules are duplicated or embedded in pages/functions, client code owns protected state transitions in some places, Firestore rules are under-specified for client-writable collections, and there is no test harness.
- Concrete quality issues found:
  - Free battle entry direct client writes have been removed; remaining work is API route tests and Firestore rules emulator coverage.
  - Rank/points logic has been extracted inside Cloud Functions, but the web/utils and functions packages still need a safer shared build/runtime strategy before using one source across both runtimes.
  - Firestore timestamp conversion helpers have been centralized in `@batalha/utils`.
  - Large page components mix UI, data fetching, filtering, validation, and workflow logic.
  - Payment route is directionally correct, but needs idempotency, duplicate pending-payment handling, environment validation, and Mercado Pago failure-path tests.

Feature test matrix to add before further feature expansion:
- Auth/profile: auth redirects, profile read, allowed profile updates, forbidden role/points/rank/stat edits.
- Battles listing/detail: query rendering, filters, empty/loading states, status-specific CTAs, paid/free labels.
- Free battle entry: auth required, registration-only, capacity, duplicate prevention, confirmed entry creation, participant count update via trusted backend only.
- Paid battle entry/Pix: auth required, paid battle only, registration-only, capacity, duplicate prevention, Pix creation, QR/copia-e-cola rendering, countdown, status polling, owner-only status reads, approved/rejected/expired states.
- Payments backend/webhook: unauthorized requests, invalid battle, free battle rejection, full battle rejection, existing confirmed entry rejection, approved webhook confirms entry/increments count, rejected/expired webhook leaves entry unconfirmed or removes it.
- Cloud Functions battles: status transitions by time, finalize admin-only, voting-only precondition, points/rank/winner/prize updates, no double-finalization.
- Votes/submissions before UI build: create validation, battle phase constraints, ownership, entry eligibility, duplicate vote rejection, vote weight bounds, moderation-only approval.

---

## Firebase Console Setup (Your Side)

You've already enabled:
- [x] Firestore Database
- [x] Auth (Email/Password)
- [x] Cloud Functions

Still needed:
- [ ] Enable Google sign-in provider in Firebase Auth
- [ ] Enable Apple sign-in provider in Firebase Auth (requires Apple Developer account)
- [ ] Deploy Firestore security rules: `firebase deploy --only firestore:rules`
- [ ] Deploy Firestore indexes: `firebase deploy --only firestore:indexes`
- [ ] Deploy Cloud Functions: `firebase deploy --only functions`
- [ ] Set up Firebase App Hosting for `apps/web`

---

## Key Files Reference

| Purpose | Path |
|---|---|
| MVP spec | `/Users/fehbrito/Downloads/batalha-assobio-mvp-spec-v3-full.txt` |
| Implementation plan | `/Users/fehbrito/.claude/plans/proud-plotting-fairy.md` |
| Firebase config | `firebase/firebase.json` |
| Security rules | `firebase/firestore.rules` |
| Cloud Functions | `firebase/functions/src/` |
| Shared types | `packages/types/src/` |
| Design system | `packages/ui/src/components/` |
| Auth hook | `packages/firebase/src/auth.ts` |
| Firestore hooks | `packages/firebase/src/firestore.ts` |
| Homepage | `apps/web/src/app/page.tsx` |
| Battle entry | `apps/web/src/app/batalhas/[battleId]/participar/page.tsx` |
| Paid battle payment | `apps/web/src/app/batalhas/[battleId]/pagamento/page.tsx` |
| Pix payment component | `apps/web/src/components/payments/pix-payment.tsx` |
