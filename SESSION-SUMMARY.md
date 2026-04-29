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
- `/batalhas/[battleId]/participar` — Battle entry flow for free battles (auth check, capacity check, batch write to create entry + increment participants, success confirmation)
- Battle status auto-transitions — Cloud Function already in place

**Not done:**
- Admin battle CRUD (create/edit forms, battle table) — skipped per your request to defer admin work
- Paid battle entry (redirects to payment flow — Phase 4)

---

## What's Left

### Phase 3 remaining (deferred)
- Admin panel: battle create/edit form, battle management table, sidebar layout

### Phase 4: Payments (Pix)
- Payment creation API route (already at `apps/web/src/app/api/payments/create/route.ts`)
- `PixPayment` component — QR code display, copia-e-cola, countdown, real-time status
- `/batalhas/[battleId]/pagamento` page for paid battle entry
- Payment status polling route (already at `apps/web/src/app/api/payments/[paymentId]/status/route.ts`)

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
