# Assobiador — Session Summary

## What's Been Built

### Phase 1: Foundation — COMPLETE

**Monorepo structure** fully set up with pnpm workspaces + Turborepo:

- Root config: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`, `.prettierrc`, `.gitignore`
- All builds pass across all packages and apps

**4 shared packages:**

| Package             | Key Files                                                                                                                                                | What it does                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `packages/types`    | `user.ts`, `battle.ts`, `submission.ts`, `payment.ts`, `vote.ts`, `common.ts`                                                                            | Zod schemas + TS types for every Firestore collection                                                  |
| `packages/firebase` | `client.ts`, `admin.ts`, `auth.ts`, `firestore.ts`                                                                                                       | SDK init, `useAuth()` hook (Google/Apple/Email), `useDocument()` and `useCollection()` real-time hooks |
| `packages/utils`    | `points.ts`, `validation.ts`, `formatting.ts`                                                                                                            | Rank system (7 tiers), video URL detection (YT/TikTok/IG), pt-BR formatting (currency, dates, numbers) |
| `packages/ui`       | `button.tsx`, `input.tsx`, `textarea.tsx`, `card.tsx`, `badge.tsx`, `avatar.tsx`, `skeleton.tsx`, `empty-state.tsx`, `stat-card.tsx`, `progress-bar.tsx` | Dark glassmorphism design system with CVA variants, 44px min touch targets                             |

**2 Next.js 14 apps:**

- `apps/web` (port 3000) — Public app with Firebase App Hosting config (`apphosting.yaml`)
- `apps/admin` (port 3001) — Admin panel for battles, championships, moderation, payments, and users

**Firebase backend** (`firebase/`):

- `firestore.rules` — Hardened security rules (protected user/account/ranking/photo metadata not client-writable; payments, battleEntries, submissions, votes, battleInvites not client-writable)
- `storage.rules` — Public avatar reads with all client writes blocked; profile photo uploads go through the server API
- `firestore.indexes.json` — 8 composite indexes
- Cloud Functions:
  - `onUserCreate` (v1 auth trigger) — creates user doc with defaults
  - `onPaymentWebhook` (v2 onRequest) — Mercado Pago webhook handler with idempotency
  - `expirePayments` (v2 scheduler, every 30min)
  - `finalizeBattle` (v2 onCall, admin-only) — tallies votes, awards points, updates ranks
  - `scheduledBattleStatusUpdater` (v2 scheduler, every 15min) — auto-transitions battle phases
  - `finalizeMatch` (v2 onCall, admin-only) — finalizes championship matches
  - `finalizeChampionship` (v2 onCall, admin-only) — finalizes championship results

---

### Phase 2: Auth + Profiles — COMPLETE

**Auth pages:**

- `/entrar` — Login with Google + Apple + Email/Password
- `/cadastro` — Register with Google + Apple + Email/Password

**Profile pages:**

- `/perfil/[userId]` — Public profile with LoL-style rank banner, XP progress bar, stats, badges
- `/meu-perfil` — Edit own profile (username, name, bio, avatar upload, official profile data)

**Layout components:**

- `header.tsx` — Sticky glass header, auth-aware (avatar dropdown vs login/register), mobile hamburger
- `mobile-nav.tsx` — Slide-in panel with user section, nav links
- `footer.tsx` — 4-column footer

**Other pages:**

- `/` — Content-first homepage with `Destaques Diários` video highlights, live battles, right-column ranking, platform stats, and recent winners (no auth required)
- `/ranking` — Full leaderboard with gold/silver/bronze top-3
- `/loading.tsx`, `/not-found.tsx`, `/error.tsx` — Loading, 404, error boundary

---

### Phase 3: Battles Core — COMPLETE

**Done:**

- `/batalhas` — Battle listing with **status/category/type filters** (chip-based UI, client-side filtering, clear button, result count)
- `/batalhas/[battleId]` — Battle detail with gradient header, timeline, rules, contextual CTAs (register/vote/submit based on status); InvitePanel shown to battle creator during registration
- `/batalhas/[battleId]/participar` — Battle entry flow for free battles using trusted API route instead of direct client Firestore writes
- `/api/battle-entries/free` — Server-owned free battle entry creation with Firebase ID token verification, transaction-based duplicate/capacity checks, confirmed entry creation, and participant increment
- Battle status auto-transitions — Cloud Function already in place
- **Community battle creation:**
  - `packages/types/src/battle.ts` — `battleFormatSchema` ('duel'|'group'), `createCommunityBattleSchema`, `battleInviteSchema`, `FREE_TIER_GROUP_CAP = 50`
  - `apps/web/src/server/battle-service.ts` — `createCommunityBattle()`: validates format/dates, enforces free-tier group cap (403 for non-pro users exceeding 50), writes battle with `type:'community'`, `status:'registration'`, `entryFee:0`
  - `apps/web/src/server/battle-service.test.ts` — 10 tests: group/duel creation, duel forced to 2 participants, free-tier cap enforcement (403), pro user bypass, field validation, date ordering
  - `apps/web/src/app/api/battles/create` — POST route with auth token, user plan fetch, delegates to service
  - `/criar-batalha` — Full form page: format selector (group/duel), title/description, category chips, participant slider (2-50), 4 datetime fields, rules editor (add/remove, max 10); auth guard; on success redirects to battle detail
  - Header — "Criar batalha" button added for logged-in users (desktop)
- **Invite flow (duel battles):**
  - `apps/web/src/server/invite-service.ts` — `sendBattleInvite()`: creator-only, registration-phase-only, username lookup via `usernameLower`, prevents self-invite and duplicates, stores denormalized `battleTitle`+`fromDisplayName`; `respondToInvite()`: invitee-only, pending-only, accept/decline
  - `apps/web/src/server/invite-service.test.ts` — 12 tests (all send/respond edge cases)
  - `apps/web/src/app/api/battles/[battleId]/invite` — POST route
  - `apps/web/src/app/api/invites/[inviteId]/respond` — POST route
  - `/meu-perfil` — `PendingInvites` section: live Firestore query for pending invites, shows battle name + sender, inline accept/decline buttons with optimistic feedback
  - `firebase/firestore.rules` — `battleInvites` rule: authenticated sender and recipient can read; no client writes
  - `firebase/firestore.rules.test.ts` — 4 new battleInvites rule tests (recipient/sender read, third-party denial, client write prevention)
- **Admin battle management:**
  - `apps/admin/src/app/batalhas/page.tsx` — battle table, create form, edit form, and existing finalize action
  - `apps/admin/src/app/batalhas/admin-battle-form.ts` — centralized admin battle form options, date conversion, rule parsing, and validation
  - `apps/admin/src/app/batalhas/admin-battle-form.test.ts` — tests for valid payloads, duel participant enforcement, phase ordering, and edit value mapping
- **Admin shell/navigation polish:**
  - `apps/admin/src/components/admin-shell.tsx` — shared admin shell, responsive top navigation, login redirect, admin-role gate, sign-out action
  - `apps/admin/src/components/admin-nav.ts` — centralized nav items and active-route helper
  - `apps/admin/src/components/admin-nav.test.ts` — active-route tests for dashboard and nested sections
  - `apps/admin/tailwind.config.ts` — aligned admin palette with shared UI/web `brand`, `accent`, and `surface` colors
  - Admin dashboard/moderation/payments/users/login pages normalized to the dark admin shell

---

### Phase 4: Payments (Pix) — COMPLETE LOCALLY

**Done:**

- Payment creation API route (`apps/web/src/app/api/payments/create/route.ts`) — creates Mercado Pago Pix payment, pending `payments` doc, and pending `battleEntries` doc
- Payment status API route (`apps/web/src/app/api/payments/[paymentId]/status/route.ts`) — verifies owner and returns status, entry ID, and expiration
- Payment status route can poll Mercado Pago Orders API for pending Orders API payments and confirm the pending entry when Mercado Pago reports approval
- `PixPayment` component (`apps/web/src/components/payments/pix-payment.tsx`) — QR code display, copia-e-cola copy button, countdown, manual status check, and 5s polling
- `/batalhas/[battleId]/pagamento` — paid battle payment page with auth checks, battle validation, Pix creation, retry, and success/expired states
- Pix idempotency — reuses non-expired pending Pix; expires stale pending Pix before creating a new one
- Pix creation now uses Mercado Pago Orders API (`/v1/orders`) with a seller test user `APP_USR-...` token for sandbox validation
- Webhook/expiration handlers are extracted and unit-tested
- Webhook origin validation — `onPaymentWebhook` validates Mercado Pago `x-signature` + `x-request-id` before processing
- Payment route hardening — missing `MP_ACCESS_TOKEN` and malformed Pix responses fail as controlled errors
- `docs/MERCADO-PAGO-ACCOUNT-SETUP.md` — owner-facing steps for creating the Mercado Pago application, using the receiver account, and collecting sandbox/production credentials safely
- `docs/MERCADO-PAGO-SANDBOX.md` — repeatable sandbox/deployed webhook validation checklist

**External validation still needed:**

- Mercado Pago seller test token is configured locally and authenticates successfully against `users/me`
- Direct Orders API Pix creation succeeds and returns QR/copia-e-cola/ticket URL
- Remaining: browser paid-battle QA against the local route using Orders API
- Remaining: `MP_WEBHOOK_SECRET`, Orders API webhook/notification configuration, and reachable deployed webhook URL test

---

## What's Left

### Product Direction Clarifications

- Assobiadores.com should become the official ranking and competition platform for whistle battles in Brazil.
- Admin panel can create both official and community battles.
- Public users on assobiadores.com must also be able to create community battles.
- User-created battles can be `1v1` or group battles.
- User-created group battles are limited to 50 entries unless the creator has a subscription/plan.
- Users should be able to invite competitors by searching and adding exact usernames in an "add to battle" flow.
- Official battles count toward XP and official rankings.
- Community/user-created battles should not affect official XP/rankings unless explicitly changed later.
- Official rankings should support a sports-style leaderboard:
  - National League.
  - Regional League by Brazilian state.
- Season-based rankings should be first-class so users have a fresh, motivating path to stay near the top each season.
- Homepage ranking summaries should present the active season (for example, `Temporada 2026`) rather than generic all-time copy.
- Official ranking is category-scoped. The global competition categories are only `freestyle`, `melodia`, and `passaros` (`Pássaros` in UI copy).
- Community users should have a pathway into official competitions through qualifiers.
- Qualifiers should bridge community participation into official competition slots while preserving official ranking integrity.
- Official competition participation should require a valid subscription; initial pricing direction is around USD $2, with exact payment/subscription rules still to be designed.
- Competitions need category support for exactly Freestyle, Melodia, and Pássaros.
- Official battles/championships require richer event/bracket modeling:
  - event dates and times surfaced in headers and details;
  - competitors surfaced in headers and details;
  - group stage support;
  - knockout phases such as round of 32, round of 16, round of 8, quarter-finals, semi-finals, finals.
- Important architecture implication: do not overfit the current `battle` model to simple one-off battles; upcoming phases need room for community battle creation, invitations, subscriptions/limits, leagues, states, championships, stages, rounds, matches, and official-only ranking calculations.

### Phase 3 remaining

- Complete

### Phase 4: Payments (Pix)

- Payment creation API route — done
- `PixPayment` component — done
- `/batalhas/[battleId]/pagamento` page for paid battle entry — done
- Payment status polling route — done
- Webhook signature validation — done
- Remaining external validation: test against real Mercado Pago sandbox credentials, `MP_WEBHOOK_SECRET`, and deployed webhook

### Phase 5: Submissions + Voting

- `/batalhas/[battleId]/enviar` — done: video URL submission form with embed preview
- `/api/submissions/create` — done: trusted server route for submission creation
- Submission service tests — done: active battle, confirmed entry, duplicate submission, URL/title validation
- `/api/submissions/[submissionId]/moderate` — backend route done for admin approve/reject
- Admin moderation UI — done: pending submissions queue, approve/reject actions, recently reviewed list
- `/batalhas/[battleId]/votar` — done: voting interface with embedded videos
- `/api/votes/create` — done: trusted server route for voting; writes vote and increments `voteCount` transactionally
- Vote service tests — done: voting phase, approved submission, duplicate vote, self-vote prevention
- `/batalhas/[battleId]/resultado` — done: ranked approved submissions by vote count
- Route-level tests — done for submission create, submission moderation, and vote create API wrappers
- Emulator manual QA fixtures/checklist — done: seed data now covers active submission, pending moderation, approved/rejected reviewed submissions, voting, and results flows
- Remaining: human browser pass through `docs/MANUAL-QA.md`

### Architecture Decision: Battle vs Championship Split

**Decision (2026-04-29):** Keep `Battle` as the model for standalone one-off contests (both community and simple official). Introduce a separate `Championship` layer on top for structured official competitions.

**Why:** The current `Battle` schema works end-to-end for the MVP. Trying to extend it with group stages, knockout brackets, season scoping, and league hierarchies would create a bloated model full of nullable fields and an unmanageable status machine.

**The two layers:**

`Battle` (existing, unchanged) — standalone contest

- Created by any user (community) or admin (official one-offs)
- Single phase: registration → active → voting → finished
- Optional entry fee, prize pool
- Affects community stats only (unless `type === 'official'` for simple official battles)

`Championship` (new, Phase 6) — structured competition

- Admin-created only
- Multi-stage lifecycle managed by a parent doc
- Sub-collections: `stages`, `matches`
- Qualifier battles (community `Battle` docs) can feed registration slots
- All results feed official XP, National/Regional league rankings

**Proposed Firestore schema:**

```
championships/{id}
  title, description, season (e.g. "2026")
  category: 'freestyle' | 'melodia' | 'passaros'
  scope: 'national' | 'regional'
  region?: string  // Brazilian state code, e.g. 'SP'
  status: 'upcoming' | 'registration' | 'active' | 'finished'
  schedule: { registrationStart, registrationEnd, start, end }
  maxParticipants, currentParticipants
  qualifierBattleIds: string[]
  prizePool, prizeDistribution
  createdBy, createdAt, updatedAt

championships/{id}/stages/{stageId}
  name: 'Fase de Grupos' | 'Oitavas' | 'Quartas' | 'Semi' | 'Final' | string
  type: 'group' | 'knockout'
  order: number
  status: 'pending' | 'active' | 'finished'
  participantIds: string[]

championships/{id}/stages/{stageId}/matches/{matchId}
  participantIds: string[]  // exactly 2 for knockout, 2+ for group
  battleId?: string  // optional link to a Battle doc for submission/voting reuse
  scheduledAt
  status: 'scheduled' | 'active' | 'voting' | 'finished'
  winnerId?: string
  scores: { [userId]: number }

seasons/{id}
  name: string  // e.g. "Temporada 2026"
  scope: 'national' | 'regional'
  region?: string
  start, end
  status: 'active' | 'archived'
  championshipIds: string[]
```

**What stays the same:** All existing battle, submission, vote, payment, and ranking code is unaffected. The championship layer is purely additive.

### Phase 6: Leaderboard + Rankings — PARTIAL

**Done:**

- `finalizeBattle` Cloud Function (standalone battles — awards points, updates rank, sets winners)
- `firebase/functions/src/battles/finalize-handler.ts` + `.test.ts` — pure handler for standalone battle finalization; official battles award XP/ranking points, community battles finalize winners without official scoring
- `packages/types/src/championship.ts` — `Season`, `Championship`, `Stage`, `Match` Zod schemas + TypeScript types
- `/ranking` page upgraded — National/Regional tabs, state selector (all 27 Brazilian states), regional ranking queries by `state` field, state badge on each user row
- Admin `/batalhas` page — real-time battle table with status, participants, entry fee; "Aguardando finalizacao" section surfaces voting-phase battles prominently with a one-click Finalize button that calls the `finalizeBattle` Cloud Function

**Done (continued):**

- `firebase/functions/src/championships/finalize-match-handler.ts` + `.test.ts` — pure handler for match finalization; tests cover: match not found, wrong status, winner from top vote, null winner when no submissions, stage auto-finish when last match, no stage finish when others still active (5 cases)
- `firebase/functions/src/championships/finalize-championship-handler.ts` + `.test.ts` — pure handler for championship finalization; tests cover: not found, already finished, active stages blocking, champion from Final stage, 2× points for all places, 2× participation points for knocked-out players, championship marked finished in batch (7 cases)
- `finalizeMatch` / `finalizeChampionship` onCall CFs delegate to handlers for testability; auth + admin checks remain in the CF wrapper
- `/ranking/temporadas` — Season archive page: lists upcoming/active/archived seasons with scope badges, date ranges, championship count; links back to ranking
- `/ranking` — "Ver temporadas anteriores" link added
- `/ranking` — Geral/Temporada switch; active season leaderboard orders by year-based `seasonCategoryPoints.{year}.{category}.points`
- `User.seasonPoints` and `User.seasonCategoryPoints` typed/defaulted/protected in Firestore rules; championship finalization writes per-year and per-category season points when `seasonId` is present
- Emulator seed now creates active season `2026` and sample `seasonPoints`
- Admin `/campeonatos` — Championship management page: lists all championships with status, qualifier count; per-championship `QualifierManager` for linking finished battles as qualifiers (toggle link/unlink via `arrayUnion`/`arrayRemove`)
- Admin championship stage/match management UI — create stages, list stages, schedule matches, list matches, optional linked `battleId`
- Admin championship bracket overview — horizontal stage columns with match cards, status labels, winner display, and completion progress
- Admin championship finalization actions — finalize voting matches via `finalizeMatch`; finalize championship when all stages are finished via `finalizeChampionship`
- `apps/admin/src/app/campeonatos/championship-management.ts` + `.test.ts` — tested helpers for stage payloads, match payloads, participant parsing, date validation, progress summaries, and finalization eligibility
- Admin dashboard — "Campeonatos" card added

**Still to do:**

- Real-data bracket QA after seeded championship fixtures exist

### Homepage Product Gaps / Priorities

**Assessment (2026-05-03):** The homepage UX direction is strong, but several visible modules imply product rules that need explicit data/model support before production.

**Priority A — close before broad public launch:**

- `Destaques Diários` now has a separate `dailyHighlights` collection and no longer reuses battle submissions as the data source.
- Daily highlight submissions award 10 casual points via trusted API route; casual points are intentionally separate from official season ranking points.
- `/destaques` lists daily entries and uses a confirmation modal with embedded video before liking an entry.
- Homepage `Submit yours` opens a modal that saves to `dailyHighlights` instead of routing through battle submission pages.
- Ranking cards on the homepage now use active-season ranking fields when an active season exists, and the copy shows the active season label.
- Regional ranking should eventually query official regional ranking data directly, not filter a broad user query client-side. The current client-side filter is an acceptable local/MVP workaround to avoid index issues and stuck loading states.

**Priority B — Phase 6 / competition layer:**

- The homepage now surfaces a `Campeonatos` module before standalone battles, but public championship detail pages still need to be built.
- Production season bootstrap is still needed: each new official season should create National and Regional championship shells in a controlled admin/server process, not from client code.
- The current `Batalhas` section mixes official and community standalone battles through badges, but the product distinction is not fully explained. Add compact labels/tooltips or section grouping so users understand: community battle, official battle, qualifier, championship match.
- Battle ticker currently shows standalone battles only. Once championships are public, decide whether the ticker should include championship matches/events or have a separate official events strip.
- Qualifier pathway needs a clear public explanation: official participation requires an active subscription, and community users can enter official competitions through qualifiers.
- Competition categories are not modeled yet; upcoming design needs category tracks across qualifiers, battles, championship stages, scoring, and rankings.

**Priority C — polish / clarity:**

- Add lightweight contextual explanation without turning the homepage into a landing page: what counts for official ranking, what daily highlights are, and why regional ranking defaults to Sao Paulo.
- Replace mixed-language CTA copy if we keep the UI fully pt-BR; currently `Submit yours` is intentionally present from the latest UX request but should be revisited during copy review.
- Platform stats should eventually come from stable aggregate counters rather than sampled client queries.

### Phase 7: Polish

- Mobile responsiveness pass
- Performance optimization (<2.5s load)
- Error handling + loading states review
- pt-BR copy review

### Phase 8: Testing + Deploy

- Component tests
- CI/CD test workflow
- CI/CD (GitHub Actions)
- Production deploy to Firebase App Hosting

---

## Quality/Security Checkpoint

Current status:

- Automated tests exist across `apps/web`, `apps/admin`, `firebase/functions`, `packages/utils`, and Firestore rules emulator tests.
- Last verification (2026-05-02): `pnpm test` and `pnpm type-check` pass.
- Payment-focused verification (2026-05-02): `pnpm --filter web test -- src/app/api/payments/create/route.test.ts` and `pnpm --filter web type-check` pass.
- Repo-level instructions in `AGENTS.md` require tests, server-side enforcement for protected workflows, and `SESSION-SUMMARY.md` updates after meaningful changes.
- Payment creation/status routes verify Firebase ID tokens server-side and only expose payment status to the payment owner.
- Firestore rules block direct client writes to server-owned collections: `payments`, `battleEntries`, `submissions`, `votes`, and `battleInvites`.

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
- Added Mercado Pago webhook signature verification in `firebase/functions/src/payments/webhook-signature.ts` with tests, and wired it into `onPaymentWebhook` before Firestore mutations.
- Added Firestore emulator rules tests in `firebase/firestore.rules.test.ts` and wired them into `pnpm test`.
- Hardened Firestore rules so battle entries, submissions, votes, payments, battle writes, and protected profile fields are not client-writable.
- Added Firebase emulator config on local ports: Auth `127.0.0.1:9099`, Firestore `127.0.0.1:8085`, websocket `9155`, UI `127.0.0.1:4000`.
- Added opt-in browser emulator support via `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`.
- Fixed Firebase Admin local emulator initialization so trusted API routes use demo-project Auth/Firestore emulators without requiring service-account credentials; verified `/api/battles/create` returns `201 Created` locally.
- Fixed browser Firebase emulator initialization to use the same `demo-batalha` project namespace as server-side Admin writes, so locally created battles are visible in client Firestore queries.
- Fixed `/batalhas` local QA visibility for newly created community battles by simplifying the battle list query to order by `createdAt` only and surfacing Firestore query errors in the UI instead of showing an empty list.
- Started UX iteration from sports-reference feedback:
  - added a horizontal live battle strip under the main header with direct CTAs (`Participar`, `Enviar`, `Votar`);
  - moved homepage ranking into a right-side column on desktop.
- Continued UX iteration:
  - added `Ver todas` before the header battle strip events;
  - adjusted header battle cards to reduce overflow and move CTA onto its own row;
  - added homepage daily highlight area;
  - changed ranking defaults/labels to `Ranking Oficial` and `Ranking Regional`, defaulting regional to Sao Paulo.
- Replaced the old homepage hero copy with `Destaques Diários` as the first visible section and removed public streak language from that area; streaks are reserved for later profile gamification.
- Converted `Destaques Diários` from user/ranking cards to a media-forward YouTube submission layout: one featured approved video, two secondary approved videos, loading states, and empty states.
- Refined `Destaques Diários` rules: highlight cards always target three approved submissions when available, sort by vote count with recency as the no-vote fallback, display only user name + vote count, and use one `Ver mais` path into the voting flow.
- Added `userDisplayName` denormalization to new submissions and updated emulator seed data with three approved voting submissions for local homepage QA.
- Hid the homepage `Quer participar?` signup card for authenticated users.
- Removed sticky behavior from the homepage ranking rail so it scrolls together with the main homepage content row.
- Split the homepage ranking rail into `Ranking Nacional` and `Ranking Regional`, each capped at 20 users; regional defaults to Sao Paulo and includes a styled state dropdown under the description.
- Moved homepage `Plataforma` and `Ultimos vencedores` into the right column below the ranking cards.
- Changed homepage regional ranking to filter locally from a broader points-ordered user query so missing regional data shows an empty state instead of a stuck shimmer.
- Removed duplicated `Batalhas` and `Ranking` links from the header navigation and mobile drawer because the homepage now provides stronger access points for those flows.
- Added a `Submit yours` CTA before `Ver mais` in the `Destaques Diários` section.
- Reduced battle ticker CTA visual weight from primary green to a neutral secondary action with subtle brand hover.
- Added separate daily highlights domain:
  - `packages/types/src/daily-highlight.ts` with `DailyHighlight`, likes, and 10-point submission constant;
  - trusted daily highlight submit/like services and API routes;
  - `SubmitDailyHighlightModal` and like-confirmation modal;
  - `/destaques` daily entry list with modal-confirmed likes;
  - Firestore rules block client writes to `dailyHighlights` and `dailyHighlightLikes`;
  - user `casualPoints` server-owned field added.
- Updated homepage `Destaques Diários` to read `dailyHighlights` instead of battle submissions.
- Updated homepage ranking copy/data to use active-season points when an active season exists and show the season label in the right rail.
- Added homepage `Campeonatos` section before standalone `Batalhas`, with seeded local National/SP championship fixtures.
- Fixed client-side redirects in login/register/profile pages by moving router updates out of render and into effects.
- Changed Firestore rules tests to use `demo-batalha-rules-test` instead of the manual QA emulator project, preventing rules-test cleanup from wiping seeded local app data.
- Hid `Submit yours` daily highlight CTA for logged-out users on the homepage and `/destaques`.
- Added a focused visibility test for the daily highlight `Submit yours` CTA so logged-out users do not see it and logged-in users do.
- Normalized official categories to Freestyle, Melodia, and Pássaros across battle schemas/forms/filters and championship data.
- Added `category` to championships and category-scoped `seasonCategoryPoints` to users; championship finalization now writes season category ranking points.
- Updated emulator championship seed to create the full official season shell: 3 national championships plus 27 regional states x 3 categories (84 championship docs total), with `Temporada 2026` as the season name.
- Updated homepage and ranking page season rankings to use the selected category instead of a single blended season leaderboard.
- Refined `/ranking` filter UX into a single aligned control panel with stable Liga/Periodo segmented controls and Categoria/Regiao selectors.
- Capped homepage `Campeonatos` preview at 20 items and changed CTA to `Ver todos`.
- Updated homepage `Campeonatos` selection to prioritize active national competitions plus regional competitions from SP, MG, RJ, BA, and RS, sorted by largest participant count and capped at 20.
- Added public `/campeonatos` listing with league/category/state filters and individual `/campeonatos/{id}` detail pages showing championship participants.
- Added championship `participantIds` support in the shared type and local seed data so detail pages can render competitor lists.
- Expanded the user profile model:
  - public `users/{uid}` now supports username, first name, surname, server-owned avatar metadata, and birth state (`Naturalidade`);
  - private `userPrivate/{uid}` stores CPF, phone, and address so sensitive data is not exposed by public profile/ranking reads;
  - `usernames/{username}` reservations support trusted username availability checks.
- Added `/api/profile/username` and `/api/profile/update` so profile saves validate username uniqueness and CPF server-side before writing.
- Added `/api/profile/photo` with Firebase Storage-backed avatar uploads, server-owned photo metadata, 14-day replacement cooldown, immutable cache headers, and `photoVersion` cache busting.
- Updated `/meu-perfil` with compressed camera/avatar upload, username verification, first name, surname, CPF/address/phone warning, naturalidade dropdown, address, and phone fields.
- Added shared profile validation for CPF, Brazilian phone with DDD, CEP, and basic address text fields. The UI now shows inline errors and the profile update API enforces the same validations server-side.
- Simplified manual address entry by removing Bairro, Complemento, and Estado do endereço from `/meu-perfil`; those fields remain schema-compatible but should be derived by a future address validation provider.
- Refined `/meu-perfil` official-data layout so CPF/phone and CEP/city/rua/numero fields use stable, balanced grid widths with shorter helper text.
- Adjusted profile phone copy to request DDD + digits only, and reordered address fields to Cidade/CEP then Rua/Numero for consistent row alignment.
- Matched CEP and Numero compact field widths in `/meu-perfil` for address layout consistency.
- Removed extra helper text from compact CEP field and moved CEP/Numero examples into placeholders to keep field heights consistent.
- Added profile edit locks: CPF and Naturalidade are immutable after first set; username and address changes start a 14-day cooldown enforced server-side and reflected in `/meu-perfil`.
- Fixed profile address persistence: profile update now uses Firestore transaction `update()` for dotted private address paths so `userPrivate/{uid}.address` is updated as a nested object instead of creating literal `"address.street"` fields.
- Fixed `/meu-perfil` username row alignment by making the input and `Verificar` button share the same fixed-height row, with helper/error text below both controls.
- Hardened local emulator auth after emulator restarts: cached browser users now force-refresh their token and sign out if the emulator session was reset, preventing `/entrar` from immediately redirecting with a stale user.
- Fixed header/mobile avatar rendering to use the Firestore profile avatar plus `photoVersion` cache busting instead of the stale Firebase Auth `photoURL`.
- Removed avatars from the full `/ranking` list and championship participant lists. Product rule: photos can appear in homepage highlights/profile surfaces, but not in voting/comparison/full ranking contexts where they add bias and unnecessary Storage traffic.
- Stabilized `/ranking` data loading by replacing dynamic nested Firestore `orderBy(seasonCategoryPoints.{year}.{category}.points)` queries with one broad `points` query plus in-memory season/category/regional sorting. This avoids intermittent empty/loading states when users lack a selected nested ranking field.
- Applied the same stable ranking query strategy to homepage `Ranking Nacional` and `Ranking Regional`; both now use one broad `users` query and in-memory season/category/state sorting.
- Fixed `/meu-perfil` username verification state bug where a successful availability check wrote `available` into the username value instead of updating `usernameStatus`, which could corrupt the profile update payload.
- Hardened `onUserCreate` so it does not overwrite an existing user document, preventing emulator seed profile points from being reset by an auth-trigger race.
- Added manual QA guide in `docs/MANUAL-QA.md`, including Phase 5 submission, moderation, voting, results, and negative browser checks.
- Added emulator seed script: `pnpm seed:emulator` creates local Auth users plus free/paid, active submission, and voting battle fixtures.
- Verified the Phase 5 emulator seed with `firebase emulators:exec --only auth,firestore "pnpm seed:emulator"`.
- Added Pix payment idempotency: existing non-expired pending Pix is reused; expired pending Pix is marked rejected and its pending entry is cleaned up before creating a fresh Pix.
- Added controlled failures/tests for missing `MP_ACCESS_TOKEN` and malformed Mercado Pago Pix responses.
- Added `docs/MERCADO-PAGO-ACCOUNT-SETUP.md` with the Mercado Pago account/application steps the payment receiver should take.
- Added `docs/MERCADO-PAGO-SANDBOX.md` with the required external sandbox validation steps and secrets.
- Configured the Mercado Pago seller test access token locally, verified token auth with `users/me`, created Mercado Pago seller/buyer test users, validated direct Orders API Pix creation, migrated app Pix creation to Mercado Pago Orders API with idempotency/expiration fields, and added owner-only Orders API status polling for pending payments.
- Extracted scheduled payment expiration logic into `firebase/functions/src/payments/expire-handler.ts` with tests for empty runs, pending entry deletion, and confirmed-entry preservation.
- Expanded the user entity with `schemaVersion`, `username`, `usernameLower`, `accountType`, `plan`, `state`, `city`, `country`, and `officialProfile`.
- Updated auth user creation defaults and emulator seed data for the expanded user entity.
- Hardened Firestore rules/tests so users cannot client-write server-owned account/ranking/official metadata.
- Added tests for username normalization and default user metadata creation.
- Started Phase 5 submissions/voting:
  - added trusted submission creation service/API route;
  - added trusted moderation backend route;
  - added trusted vote service/API route;
  - added submission form, voting page, results page, and reusable video preview;
  - added admin moderation queue UI;
  - added route-level tests for submission/vote API wrappers;
  - removed `onVoteCreate` export to avoid double-counting now that server vote route increments `voteCount` transactionally.
- Added shared Firestore timestamp conversion helper in `packages/utils/src/dates.ts` and replaced duplicated page-local helpers.
- Extracted Cloud Functions ranking/points/prize helpers into `firebase/functions/src/domain/ranking.ts` with unit tests.
- Updated API routes to avoid logging expected `ApiError` authorization/validation failures as server errors.
- Completed Phase 3 admin battle management:
  - added create/edit battle UI in `apps/admin/src/app/batalhas/page.tsx`;
  - extracted admin battle form validation/date/rule mapping into `apps/admin/src/app/batalhas/admin-battle-form.ts`;
  - added `apps/admin/src/app/batalhas/admin-battle-form.test.ts` and `apps/admin` test script.
- Completed Phase 3 admin shell/navigation polish:
  - added auth-aware admin shell and responsive navigation;
  - centralized admin nav route matching;
  - added admin nav helper tests;
  - aligned admin Tailwind colors with the shared UI/web palette;
  - normalized remaining admin page styling for the shared shell.
- Enforced official/community ranking separation for standalone battles:
  - extracted `finalizeBattle` into a pure tested handler;
  - official battles still award points, XP, rank, and official stats;
  - community battles now finalize winners without official points/rank writes.
- Added season-scoped ranking:
  - added `seasonPoints` to the user model and auth defaults;
  - protected `seasonPoints` in Firestore rules;
  - updated championship finalization to write per-season points/rank fields;
  - added `/ranking` season mode and emulator seed data for an active season.
- Added admin championship stage/match management:
  - create/list stages under each championship;
  - create/list matches under each stage;
  - optional match-to-battle linkage;
  - bracket overview with stage progress and match cards;
  - finalize match/championship admin actions;
  - tested payload/date/participant/progress/finalization helpers.

Security/test work to do before expanding features:

- Add integration coverage for real Mercado Pago sandbox payload shapes once credentials/webhook URL are available.
- Optional: consolidate web/functions rank constants into one built shared domain package once package build/runtime strategy is upgraded.
- Official/community ranking separation is enforced for standalone battle finalization: `finalizeBattle` applies XP/rank updates only to `type === 'official'` battles. Community battles can be finalized without official scoring.
- Season-scoped ranking is implemented for championship results with `seasonPoints`; current season regional filtering is client-side over the top 200 active-season users to avoid dynamic per-season composite indexes.

Code quality audit:

- Overall code level: improving from MVP prototype toward solid mid-level production code. It now has service-layer boundaries for risky workflows, route tests, function handler tests, Firestore rules tests, and stricter server-owned data flows.
- Not senior/specialist yet because some large page components mix UI/data/workflow logic and shared domain packaging between web/functions is still unresolved.
- Concrete quality issues found:
  - Free battle entry direct client writes have been removed; API route tests and Firestore rules emulator coverage exist.
  - Rank/points logic has been extracted inside Cloud Functions, but the web/utils and functions packages still need a safer shared build/runtime strategy before using one source across both runtimes.
  - Firestore timestamp conversion helpers have been centralized in `@batalha/utils`.
  - Large page components mix UI, data fetching, filtering, validation, and workflow logic.
  - Payment route has idempotency, duplicate pending-payment handling, Mercado Pago failure-path tests, and webhook signature validation; real sandbox validation remains.

Feature test matrix to add before further feature expansion:

- Auth/profile: auth redirects, profile read, allowed profile updates, forbidden role/points/rank/stat edits.
- Battles listing/detail: query rendering, filters, empty/loading states, status-specific CTAs, paid/free labels.
- Component/UI tests for submission form, voting page, moderation queue, public battle creation form, and admin battle management page.
- Cloud Functions battles: status transitions by time, finalize admin-only, voting-only precondition, points/rank/winner/prize updates, no double-finalization.
- Ranking scope tests: broader UI/component coverage for ranking mode switching and larger championship season scenarios.

---

## Firebase Console Setup (Your Side)

You've already enabled:

- [x] Firestore Database
- [x] Auth (Email/Password)
- [x] Cloud Functions

Still needed:

- [ ] Enable Google sign-in provider in Firebase Auth
- [ ] Enable Apple sign-in provider in Firebase Auth (Apple Developer account is available; provider configuration still needed)
- [ ] Deploy Firestore security rules: `firebase deploy --only firestore:rules`
- [ ] Deploy Firestore indexes: `firebase deploy --only firestore:indexes`
- [ ] Deploy Cloud Functions: `firebase deploy --only functions`
- [ ] Set up Firebase App Hosting for `apps/web`

---

## Key Files Reference

| Purpose               | Path                                                             |
| --------------------- | ---------------------------------------------------------------- |
| MVP spec              | `/Users/fehbrito/Downloads/batalha-assobio-mvp-spec-v3-full.txt` |
| Implementation plan   | `/Users/fehbrito/.claude/plans/proud-plotting-fairy.md`          |
| Firebase config       | `firebase/firebase.json`                                         |
| Security rules        | `firebase/firestore.rules`                                       |
| Cloud Functions       | `firebase/functions/src/`                                        |
| Shared types          | `packages/types/src/`                                            |
| Design system         | `packages/ui/src/components/`                                    |
| Auth hook             | `packages/firebase/src/auth.ts`                                  |
| Firestore hooks       | `packages/firebase/src/firestore.ts`                             |
| Homepage              | `apps/web/src/app/page.tsx`                                      |
| Battle entry          | `apps/web/src/app/batalhas/[battleId]/participar/page.tsx`       |
| Paid battle payment   | `apps/web/src/app/batalhas/[battleId]/pagamento/page.tsx`        |
| Pix payment component | `apps/web/src/components/payments/pix-payment.tsx`               |
