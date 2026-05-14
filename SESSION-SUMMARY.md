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
- `firestore.indexes.json` — 13 composite indexes
- Cloud Functions:
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
- User profile bootstrap now runs through trusted web API route `/api/auth/bootstrap` after verified sign-in/sign-up. It creates/backfills `users/{uid}`, `usernames/{username}`, and `userPrivate/{uid}` without relying on the legacy `v1` Auth trigger.
- Shared web API auth now maps revoked, expired, or malformed Firebase ID tokens to a controlled `401` (`Sessao expirada. Entre novamente.`) instead of leaking as generic route-level `500`s. This specifically protects local QA after emulator reseeds/restarts, where the browser can keep a stale Auth token.

**Profile pages:**

- `/perfil/[userId]` — Public profile with LoL-style rank banner, XP progress bar, stats, badges
- `/meu-perfil` — Edit own profile (username, name, bio, avatar upload, official profile data)

**Layout components:**

- `header.tsx` — Sticky glass header, auth-aware (avatar dropdown vs login/register), mobile hamburger
- `mobile-nav.tsx` — Slide-in panel with user section, nav links
- `footer.tsx` — 4-column footer

**Other pages:**

- `/` — Content-first homepage with `Destaques Diários` audio/media highlights, live battles, right-column ranking, platform stats, and recent winners (no auth required)
- `/ranking` — Full leaderboard with gold/silver/bronze top-3
- `/loading.tsx`, `/not-found.tsx`, `/error.tsx` — Loading, 404, error boundary

---

### Phase 3: Battles Core — COMPLETE

**Done:**

- `/batalhas` — Battle listing with **status/category/type filters** (chip-based UI, client-side filtering, clear button, result count)
- `/batalhas/[battleId]` — Battle detail with gradient header, timeline, rules, participant list, submitted audio playback, inline participation/payment, inline voting, and InvitePanel for the creator during registration
- `/batalhas/[battleId]/participar` — Battle entry flow for free battles using trusted API route instead of direct client Firestore writes
- `/api/battle-entries/free` — Server-owned free battle entry creation with Firebase ID token verification, transaction-based duplicate/capacity checks, confirmed entry creation, and participant increment
- Battle status auto-transitions — Cloud Function already in place
- **Community battle creation:**
  - `packages/types/src/battle.ts` — `battleFormatSchema` ('duel'|'group'), `battleVisibilitySchema` ('public'|'invite_only'), voting scopes (`public`|'participants'|'judges' plus legacy aliases), `createCommunityBattleSchema`, `battleInviteSchema`, `FREE_TIER_GROUP_CAP = 50`
  - `apps/web/src/server/battle-service.ts` — `createCommunityBattle()`: validates format/dates, enforces free-tier group cap (403 for non-pro users exceeding 50), requires group battles to allow at least 5 participants for scoring integrity, forces duels to 2 participants/public voting, writes battle with `type:'community'`, `status:'registration'`, `entryFee:0`
  - `apps/web/src/server/battle-service.test.ts` — 11 tests: group/duel creation, duel forced to 2 participants/public voting, creator as judge seed, group minimum participant enforcement, free-tier cap enforcement (403), pro user bypass, field validation, date ordering
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
- Webhook Orders API compatibility — Mercado Pago payment webhooks now match the stored `externalPaymentId` from the Orders API payment transaction, with legacy `externalId` fallback
- Payment route hardening — missing `MP_ACCESS_TOKEN` and malformed Pix responses fail as controlled errors
- `docs/MERCADO-PAGO-ACCOUNT-SETUP.md` — owner-facing steps for creating the Mercado Pago application, using the receiver account, and collecting sandbox/production credentials safely
- `docs/MERCADO-PAGO-SANDBOX.md` — repeatable sandbox/deployed webhook validation checklist

**External validation still needed:**

- Mercado Pago seller test token is configured locally and authenticates successfully against `users/me`
- Direct Orders API Pix creation succeeds and returns QR/copia-e-cola/ticket URL
- `pnpm validate:mp` and `pnpm validate:mp:order` now provide repeatable secret-safe Mercado Pago validation; current local token validates against `users/me` and can create Orders API Pix successfully.
- Remaining: browser paid-battle QA against the local route using Orders API
- `MP_WEBHOOK_SECRET` and `MP_ACCESS_TOKEN` are set in Firebase Secret Manager for `assobiadores-3f0f6`.
- `onPaymentWebhook` is deployed at `https://southamerica-east1-assobiadores-3f0f6.cloudfunctions.net/onPaymentWebhook`; latest redeploy includes the Orders API `externalPaymentId` webhook fix, and GET returns 405 while unsigned POST returns 401, confirming reachability and signature gating.
- Cloud Functions package runtime has been upgraded to Node.js 22. Production `v2` functions currently listed on `nodejs22`: `expirePayments`, `finalizeBattle`, `finalizeChampionship`, `finalizeMatch`, `onPaymentWebhook`, and `scheduledBattleStatusUpdater`.
- Runtime validation passed locally under Node 22 with `pnpm --filter functions test`, `pnpm --filter functions type-check`, and `pnpm --filter functions build`.
- Resolved deploy caveat: the legacy `onUserCreate` `v1` Auth trigger was removed from the Cloud Functions export because it cannot be deployed under the Node.js 22 functions package. User document bootstrap is now owned by the web app's trusted `/api/auth/bootstrap` route instead.
- Artifact Registry cleanup policy is configured for `southamerica-east1` with 7-day retention.
- Local paid-route QA is passing: the seeded `battle-paid-open` fixture creates an Orders API Pix, writes a pending payment, writes a pending battle entry, and the owner-only status route returns the pending payment.
- Remaining: browser payment UI pass with a sandbox-approved Pix payment and Mercado Pago dashboard webhook event confirmation.

---

## What's Left

### Product Direction Clarifications

- Assobiadores.com should become the official ranking and competition platform for whistle battles in Brazil.
- Admin panel can create both official and community battles.
- Public users on assobiadores.com must also be able to create community battles.
- User-created battles can be `1v1` or group battles.
- User-created group battles are limited to 50 entries unless the creator has a subscription/plan.
- Users should be able to invite competitors by searching and adding exact usernames in an "add to battle" flow.
- Rankings now use a unified season points model backed by append-only `pointActivities`: daily highlights, standalone battles, qualifiers, Regionals, and Nationals can all award points when finalized by trusted server code. Category remains source context/breakdown data, but the official public ranking total is no longer split by category.
- Casual/community actions award small points so regular users can appear in the season table; official competition progression awards much larger proportional boosts so Regional/National winners still lead meaningfully.
- Season rankings should support a sports-style leaderboard:
  - National League.
  - Regional League by Brazilian state.
- Season-based rankings should be first-class so users have a fresh, motivating path to stay near the top each season.
- Homepage ranking summaries should present the active season (for example, `Temporada 2026`) rather than generic all-time copy.
- Official public ranking is unified across categories. Category remains a scoring/breakdown dimension only; the visible leaderboard uses one total per user for the active season. The global competition categories are only `freestyle`, `melodia`, and `passaros` (`Pássaros` in UI copy).
- Community users should have a pathway into official competitions through qualifiers.
- Qualifiers bridge community participation into official competition slots and grant larger season point boosts for entry, phase advancement, and qualification.
- Official competition participation should require the entry payment/subscription rules defined for that event. Open Qualifiers now have a concrete `R$ 4,00` entry-fee direction; broader subscription rules are still to be designed.
- Competitions need category support for exactly Freestyle, Melodia, and Pássaros.
- 2026 official competition direction is documented in `docs/COMPETITION-MODEL.md`: Open Qualifiers feed Regionals, Regional top performers feed Nationals, async match submissions close at 14:59 BRT, voting runs 15:00-21:59 BRT, Qualifiers are 100% public vote, and Regional/National voting is 70% judges plus 30% public.
- Regional competitions use flexible brackets per state/category: minimum 16, preferred/full 64, accepted sizes 16/32/64. National qualification is top 10 for 64-player Regionals, top 6 for 32-player Regionals, and top 4 for 16-player Regionals.
- Qualifier entry pricing direction: `R$ 4,00` per contestant/category; platform keeps 20%; 80% funds the Regional category prize pool. Regional prize distribution is 50% to 1st place, 30% to 2nd place, and 20% to 3rd place.
- Open Qualifier UX now has a persistent notice for logged-in users without an active registration and a `/classificatorias` page with rules/payment terms. Notice hides when `qualifierRegistrations` has `pending_payment` or `confirmed` for the user/season.
- Homepage `Campeonatos` cards and `/campeonatos` listing now display product status copy from official dates instead of raw status labels (`registration`, `inscricoes`, `envios`). Regionals show only the date range `20/07/2026 - 27/09/2026`; Nationals show `Status: Classificados do Regional` and `Início em 05/10/2026`.
- Championship cards reserve consistent title/description/footer space and align participant counts/dates in a stable two-column footer so desktop cards do not wrap dates unevenly.
- Competition detail pages now include a `Ver Regras` button and rules section. Visible participant counts use real `participantIds` as the source of truth, and empty participant states explain the qualification path: Nationals wait for Regional top 10, Regionals wait for up to 64 Classifieds from Classificatórias.
- Emulator championship seed now starts all 84 official championship shells with `currentParticipants: 0` and empty `participantIds`, matching the pre-qualifier product state. The running Firestore emulator was also patched to clear existing seeded championship participants for QA.
- Championship cards/details hide the `0/64 competidores` block while there are no real participants; date information takes that visual space until classified participants exist.
- Unified 2026 season scoring direction is documented in `docs/COMPETITION-MODEL.md`: daily submission 1, daily top 3 = 15/10/5, 1v1 battle win 10, group battle win 20, qualifier entry 50, qualifier phase advance 200, qualify for Regional 500, Regional phase advance 1,000, Regional podium 10,000/6,000/4,000, qualify for National 3,000, National phase advance 5,000, and National podium 40,000/25,000/15,000.
- Unified scoring tests are now in place for the shared point table, daily highlight submission ledger writes, community/official battle win ledger writes, and Regional/National championship podium writes.
- Remaining implementation gap: qualifier entry payment scoring, Regional/National phase-advance scoring, and daily top-3 placement scoring still need concrete server flows/jobs before they can be integration-tested beyond the pure scoring contract. Qualifier phase-advance and qualifier-to-Regional points now have trusted server flows.
- Official battles/championships require richer event/bracket modeling:
  - event dates and times surfaced in headers and details;
  - competitors surfaced in headers and details;
  - group stage support;
  - knockout phases such as round of 32, round of 16, round of 8, quarter-finals, semi-finals, finals.
- Important architecture implication: do not overfit the current `battle` model to simple one-off battles; upcoming phases need room for community battle creation, invitations, subscriptions/limits, leagues, states, championships, stages, rounds, matches, and unified season/category scoring.

### Phase 3 remaining

- Complete
- Latest hardening: community battle scoring now has anti-farming eligibility checks in `finalizeBattle`. A battle can finish without ranking points, but season/category points are awarded only when it has a category, enough confirmed participants, enough approved submissions from confirmed participants, and at least one public vote. Group battle creation now requires at least 5 participants; duels remain 2. Voting already rejects self-votes server-side, and the voting UI no longer shows the vote button on the user's own entry.

### Phase 4: Payments (Pix)

- Payment creation API route — done
- `PixPayment` component — done
- `/batalhas/[battleId]/pagamento` page for paid battle entry — done
- Payment status polling route — done
- Webhook signature validation — done
- Orders API payment-ID webhook matching — done
- Qualifier registration fee payment UX/API — done: `/classificatorias` now lets logged-in users choose category only, derives the Regional from immutable `users/{uid}.birthState` (`Naturalidade`) server-side, opens the R$ 4,00 Pix in a modal, blocks duplicate Pix generation after the category registration is confirmed, and confirms `qualifierRegistrations` through the shared payment status/webhook path
- `/classificatorias` now also shows a post-registration `Suas Classificatórias` status section for confirmed registrations, with registered category/state, qualifier battle window (`01/06/2026 - 12/07/2026`), submission deadline (`14:59 BRT`), and voting window (`15:00 - 21:59 BRT`).
- Qualifier UX/data layer — in progress: `qualifierTracks` is modeled as public read/server-owned discovery data with shareable slugs like `sp-freestyle-2026`, open registration counts, and the number of Regional qualification slots; `qualifierRegistrations` carry bracket journey fields; `qualifierMatches` is modeled as public read/server-owned official fixture data; `/classificatorias/{state-category-year}` shows the public qualifier track; and `/classificatorias/{registrationId}` shows the participant's private category/state journey, deadlines, current status, generated matches, and submission action.
- Homepage now has a left-column `Classificatórias` discovery section before Campeonatos so the Rankings rail remains visible: logged-in users see all three category tracks for their `Naturalidade`, logged-out users see SP/RJ defaults, cards avoid registration counts/slot counts, and every card links to the public shareable track while `Ver todas` opens `/classificatorias`.
- Public qualifier track pages no longer show price, no longer treat `64` as a counter/stat card, and no longer show a `Ver todas` CTA in `Como funciona`. The Regional qualification count now appears as explanatory rules copy, and confirmed participants render after `Como funciona` from the server-owned public `qualifierParticipants` projection ordered by confirmation date, first to last, without `#1/#2` list markers but still showing each user's category rank and points.
- Qualifier payment confirmation now writes `qualifierParticipants/{registrationId}` alongside `qualifierRegistrations`/`qualifierTracks`, avoiding public reads of private payment registration docs while still enabling participant lists on public track pages.
- Firestore client collection hook now supports disabled collection reads, and `/classificatorias` skips the private `qualifierRegistrations` listener until auth is available. This avoids unauthenticated private-listener churn and stabilizes the page's realtime query setup.
- Homepage loading stability fix: `useCollection` now keys realtime subscriptions by the semantic query constraints instead of the identity of freshly-created `orderBy`/`where`/`limit` objects. This prevents repeated unsubscribe/resubscribe loops on render and reduces intermittent blank homepage sections / Firestore internal assertion failures.
- Daily highlight list consistency fix: homepage and `/destaques` now use the shared `getVisibleDailyHighlights` selector. It is strictly daily: only today's active entries are eligible, vote count sorts first, and zero-vote ties show the earliest submissions first.
- `/destaques` entries now render as stable ranked playable media rows: fixed-width rank column for large numbers, compact `#1234` rank label, compact audio/media card as the main content, and a plain `Votar` action aligned with the row. Vote confirmation modal no longer repeats the media; it uses title `Votar`, explains the vote cannot be undone, and only offers `Cancelar` / `Confirmar voto`.
- Mercado Pago local credential validation — done with `pnpm validate:mp`
- Mercado Pago direct Orders API Pix validation — done with `pnpm validate:mp:order`
- Firebase secrets/deployed webhook — done for `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, and `onPaymentWebhook`
- Production deploy workflow now deploys `functions:onPaymentWebhook` before App Hosting, so Mercado Pago secret rotations and webhook confirmation logic are applied by the GitHub Actions production job instead of depending on a separate manual function deploy.
- Cloud Functions Node.js 22 runtime — done: all deployed functions are `v2` functions on Node.js 22. The obsolete `onUserCreate` `v1` Auth trigger was removed and replaced with the trusted web bootstrap route.
- Local paid-route QA — done against `battle-paid-open`
- Mercado Pago production validation is complete for MVP payment flows: a real Pix payment confirmed a Classificatórias registration through the production webhook, and a real Pix payment confirmed a paid battle entry through the same production webhook. Firestore side effects were verified for the paid battle: `payments.status = approved`, `battleEntries.status = confirmed`, participant count incremented, 20% platform fee recorded, and 80% prize pool/prize distribution updated.
- Production QA data was sanitized after validation: synthetic `qa-mp-webhook-*` fixtures were deleted, the two QA paid battle smoke documents and their entries were removed from user-facing collections, and the two real approved smoke payment documents were retained only as archived QA payment records for reconciliation/audit.
- Follow-up QA cleanup removed leftover `QA Webhook Qualifier` ranking/point remnants from production (`pointActivities` and `seasonRankings/2026/users`); verification found no remaining `qa-mp-webhook` user, qualifier, payment, point, or ranking records.
- Production battle data cleanup: removed the user-created `Top 10 Assobiadores` battle and converted `Os Fundadores do Assobio` to a paid battle with `entryFee = 400`, zeroed prize pool/platform fee totals, and initialized prize distribution.
- Platform stats API cache fix: `/api/platform/stats` now forces dynamic/no-store responses so production homepage counters reflect current Firestore counts after QA cleanup instead of stale cached `Assobiadores`/`Batalhas` totals.
- Auth/onboarding polish: Google and Apple auth now fall back from popup to redirect for browser popup failures, and login/register pages bootstrap the user profile from auth state before routing so social redirect completions still create/backfill Firestore profile docs. The first registration screen no longer asks for Chave Pix; lightweight onboarding can save Naturalidade without Pix, while official/payout profile fields still require Pix on `/conta`.
- Ranking consistency fix: `/ranking` now opens on `Nacional` + `Geral`, keeps `Geral` before `Temporada`, and uses the trusted `seasonRankings/{seasonId}/users` read model instead of mixing in legacy `users.points`. Visible rank labels are derived from points at render time to avoid stale labels, and Regional rankings filter by `state ?? birthState` so Naturalidade-backed users appear with the same unified points total. Homepage ranking previews now reuse the same helpers so the homepage and full ranking page do not diverge.
- Local emulator seed fix: `seed:qa:v1` and `seed:emulator` now clear and repopulate `seasonRankings/2026/users` alongside `users`, so homepage platform counters and `/ranking` read-model rows stay aligned in QA. The current V1 emulator seed was refreshed and verified at `503` public users and `503` season ranking rows.
- Header ticker adjustment: the global header strip is now a unified upcoming-event ticker. It merges active Battles, Classificatórias, and scheduled Campeonatos, then sorts them by the nearest next relevant date/time so the closest thing happening next appears first. Battle registration cards now use the submission deadline as the next date because users can submit immediately after joining/paying/invite confirmation.
- Remaining ranking architecture note: if Assobiador later needs a true all-time leaderboard across seasons, add a separate trusted server-owned all-time ranking read model. Do not reintroduce legacy `users.points` as a public ranking source.

### Phase 5: Submissions + Voting

- `/batalhas/[battleId]/enviar` — done: on-platform audio recording/submission up to 2 minutes, stored with audio media metadata
- `/api/submissions/create` — done: trusted server route for submission creation
- Submission service tests — done: active battle, confirmed entry, duplicate submission, URL/title validation
- `/api/submissions/[submissionId]/moderate` — done: admin-only removal route for reported or rule-breaking submissions; approve/reject is no longer part of battle submission flow
- `/api/submissions/[submissionId]/report` — done: logged-user route for community reports into server-owned `submissionReports`
- Admin moderation UI — done: open reports + active submission review/removal, with no raw video URL display and no approval queue
- `/batalhas/[battleId]/votar` — done: voting interface with embedded videos
- `/api/votes/create` — done: trusted server route for voting; writes vote and increments `voteCount` transactionally
- Vote service tests — done: voting phase, approved submission, duplicate vote, self-vote prevention
- `/batalhas/[battleId]/resultado` — done: ranked approved submissions by vote count
- Route-level tests — done for submission create, submission report/removal moderation, and vote create API wrappers
- Emulator manual QA fixtures/checklist — done: seed data now covers active submissions, open reports, removed submissions, voting, and results flows
- Remaining: human browser pass through `docs/MANUAL-QA.md`

### Architecture Decision: Battle vs Championship Split

**Decision (2026-04-29):** Keep `Battle` as the model for standalone one-off contests (both community and simple official). Introduce a separate `Championship` layer on top for structured official competitions.

**Why:** The current `Battle` schema works end-to-end for the MVP. Trying to extend it with group stages, knockout brackets, season scoping, and league hierarchies would create a bloated model full of nullable fields and an unmanageable status machine.

**The two layers:**

`Battle` (existing, unchanged) — standalone contest

- Created by any user (community) or admin (official one-offs)
- Single phase: registration → active → voting → finished
- Optional entry fee, prize pool
- Can award small unified season/category points when finalized through trusted scoring rules

`Championship` (new, Phase 6) — structured competition

- Admin-created only
- Multi-stage lifecycle managed by a parent doc
- Sub-collections: `stages`, `matches`
- Qualifier battles (community `Battle` docs) can feed registration slots
- All results feed larger unified season/category point boosts and National/Regional league rankings

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
- `firebase/functions/src/battles/finalize-handler.ts` + `.test.ts` — pure handler for standalone battle finalization; eligible official and community battle wins now write unified season/category points (`10` for 1v1 wins, `20` for group wins)
- `packages/types/src/championship.ts` — `Season`, `Championship`, `Stage`, `Match` Zod schemas + TypeScript types
- `/ranking` page upgraded — National/Regional tabs, state selector (all 27 Brazilian states), regional ranking queries by `state` field, state badge on each user row
- Admin `/batalhas` page — real-time battle table with status, participants, entry fee; "Aguardando finalizacao" section surfaces voting-phase battles prominently with a one-click Finalize button that calls the `finalizeBattle` Cloud Function

**Done (continued):**

- `firebase/functions/src/championships/finalize-match-handler.ts` + `.test.ts` — pure handler for match finalization; tests cover: match not found, wrong status, winner from top vote, null winner when no submissions, stage auto-finish when last match, no stage finish when others still active (5 cases)
- `firebase/functions/src/championships/finalize-championship-handler.ts` + `.test.ts` — pure handler for championship finalization; tests cover: not found, already finished, active stages blocking, champion from Final stage, Regional/National podium point writes, no placement points for non-placing participants, championship marked finished in batch
- `finalizeMatch` / `finalizeChampionship` onCall CFs delegate to handlers for testability; auth + admin checks remain in the CF wrapper
- `/ranking/temporadas` — Season archive page: lists upcoming/active/archived seasons with scope badges, date ranges, championship count; links back to ranking
- `/ranking` — "Ver temporadas anteriores" link added
- `/ranking` — Geral/Temporada switch; active season leaderboard reads the unified `seasonRankings/{seasonId}/users` aggregate
- `User.seasonPoints`, `User.seasonCategoryPoints`, and `seasonRankings` are typed/defaulted/protected in Firestore rules; trusted scoring writes keep unified totals and category breakdowns in sync
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
- Daily highlight submissions award 1 point through a trusted API route and write to the unified season/category points model.
- `/destaques` lists daily entries and uses a confirmation modal with embedded media before voting on an entry.
- Homepage `Enviar` opens a modal that saves to `dailyHighlights` instead of routing through battle submission pages.
- Ranking cards on the homepage now use active-season ranking fields when an active season exists, and the copy shows the active season label.
- Regional ranking should eventually query official regional ranking data directly, not filter a broad user query client-side. The current client-side filter is an acceptable local/MVP workaround to avoid index issues and stuck loading states.

**Priority B — Phase 6 / competition layer:**

- The homepage now surfaces a `Campeonatos` module before standalone battles, but public championship detail pages still need to be built.
- Production season bootstrap is still needed: each new official season should create National and Regional championship shells in a controlled admin/server process, not from client code.
- The current `Batalhas` section mixes official and community standalone battles through badges, but the product distinction is not fully explained. Add compact labels/tooltips or section grouping so users understand: community battle, official battle, qualifier, championship match.
- Battle ticker currently shows standalone battles only. Once championships are public, decide whether the ticker should include championship matches/events or have a separate official events strip.
- Qualifier pathway needs a clear public explanation: official participation requires an active subscription, and community users can enter official competitions through qualifiers.
- Competition categories are now modeled as Freestyle, Melodia, and Pássaros across battles, championships, scoring, and rankings; qualifier flows still need category-aware public explanation.

**Priority C — polish / clarity:**

- Add lightweight contextual explanation without turning the homepage into a landing page: what counts for official ranking, what daily highlights are, and why regional ranking defaults to Sao Paulo.
- Keep daily highlight CTA copy in pt-BR (`Enviar`) unless product direction changes.
- Platform stats should eventually come from stable aggregate counters rather than sampled client queries.

### Phase 7: Polish

- Mobile responsiveness pass
- Performance optimization (<2.5s load)
- Error handling + loading states review
- pt-BR copy review

### Phase 8: Testing + Deploy

- Component tests
- CI/CD test workflow — done for PR/push validation
- CI/CD (GitHub Actions) — done for Firebase App Hosting rollout path
- Production deploy to Firebase App Hosting — workflow added; requires GitHub `FIREBASE_SERVICE_ACCOUNT` secret and `FIREBASE_APP_HOSTING_BACKEND_ID` variable before first run

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
- Converted `Destaques Diários` from user/ranking cards to a media-forward audio layout: #1 gets larger left-side real estate while #2 and #3 stack equally on the right within the same overall height, using the same minimal player treatment as the `Enviar` modal.
- Daily highlight audio cards use one shared player layout across homepage and modals: `{displayName} - {naturalidade}` on the left, category on the right, icon-only play control, waveform, and current/total time below.
- Daily highlight audio cards render `displayName` brighter and `naturalidade` in softer grey so location reads as secondary metadata.
- Refined `Destaques Diários` rules: highlight cards always target three approved submissions when available, sort by vote count with recency as the no-vote fallback, display user name/category/vote count in the audio player, and use one `Ver mais` path into the voting flow.
- Added `userDisplayName` denormalization to new submissions and updated emulator seed data with three approved voting submissions for local homepage QA.
- Hid the homepage `Quer participar?` signup card for authenticated users.
- Removed sticky behavior from the homepage ranking rail so it scrolls together with the main homepage content row.
- Split the homepage ranking rail into `Ranking Nacional` and `Ranking Regional`, each capped at 20 users; regional defaults to Sao Paulo and includes a styled state dropdown under the description.
- Moved homepage `Plataforma` and `Ultimos vencedores` into the right column below the ranking cards.
- Changed homepage regional ranking to filter locally from a broader points-ordered user query so missing regional data shows an empty state instead of a stuck shimmer.
- Removed duplicated `Batalhas` and `Ranking` links from the header navigation and mobile drawer because the homepage now provides stronger access points for those flows.
- Added an `Enviar` CTA before `Ver mais` in the `Destaques Diários` section.
- Reduced battle ticker CTA visual weight from primary green to a neutral secondary action with subtle brand hover.
- Added separate daily highlights domain:
  - `packages/types/src/daily-highlight.ts` with `DailyHighlight`, likes, and 1-point submission constant;
  - trusted daily highlight submit/like services and API routes;
  - `SubmitDailyHighlightModal` and like-confirmation modal;
  - `/destaques` daily entry list with modal-confirmed likes;
  - Firestore rules block client writes to `dailyHighlights` and `dailyHighlightLikes`;
  - user `casualPoints` server-owned field was added for the earlier daily-highlight model; rename or migrate this concept into the unified season/category points ledger.
- Daily highlight voting now allows only one vote per user per Brazil `dayKey` (`America/Sao_Paulo`) until 22:00 BRT. Vote docs use deterministic IDs (`{dayKey}_{userId}`), so voting a second entry on the same day is blocked transactionally.
- Daily highlight day entries are created lazily from user submissions using `dayKey`; the daily closing scheduler now finalizes that day's active entries at 22:05 BRT, marks placements, and awards top-3 points.
- Added on-platform audio recording for `Destaques Diários`: users record up to 2 minutes in-browser, choose Freestyle/Melodia/Pássaros, upload compressed audio through a trusted API to Firebase Storage, and the new audio media is rendered with a same-footprint audio player showing play/pause, waveform bars, progress/duration, category, and username.
- Improved daily highlight recording UX with live recording feedback: timer, progress bar, and animated waveform-style bars before stopping the recording.
- Updated daily highlight local seed data to use today's audio entries with dedicated seed user IDs, keeping homepage and `/destaques` populated without consuming the seeded login users' one-submission-per-day slot.
- Daily highlights now support media metadata (`mediaType`, `mediaURL`, Storage path/content type/size/duration) and the product flow is audio-only; legacy external video URL submission has been disabled.
- Updated homepage `Destaques Diários` to read `dailyHighlights` instead of battle submissions.
- Updated homepage ranking copy/data to use active-season points when an active season exists and show the season label in the right rail.
- Added homepage `Campeonatos` section before standalone `Batalhas`, with seeded local National/SP championship fixtures.
- Fixed client-side redirects in login/register/profile pages by moving router updates out of render and into effects.
- Changed Firestore rules tests to use `demo-batalha-rules-test` instead of the manual QA emulator project, preventing rules-test cleanup from wiping seeded local app data.
- Hid `Enviar` daily highlight CTA for logged-out users on the homepage and `/destaques`.
- Added a focused visibility test for the daily highlight `Enviar` CTA so logged-out users do not see it and logged-in users do.
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
  - private `userPrivate/{uid}` stores CPF, phone, Chave Pix, and address so sensitive identity/contact/payout data is not exposed by public profile/ranking reads;
  - `usernames/{username}` reservations support trusted username availability checks.
- Naturalidade and Chave Pix are required before a profile can be finalized: email/password registration asks for both upfront, `/meu-perfil` requires both before save, and the trusted profile update API rejects profiles that still have no `birthState` or private `pixKey`.
- Added `/api/profile/username` and `/api/profile/update` so profile saves validate username uniqueness and CPF server-side before writing.
- Added `/api/profile/photo` with Firebase Storage-backed avatar uploads, server-owned photo metadata, 14-day replacement cooldown, immutable cache headers, and `photoVersion` cache busting.
- Updated `/meu-perfil` with compressed camera/avatar upload, username verification, first name, surname, CPF/address/phone warning, naturalidade dropdown, address, and phone fields.
- Added shared profile validation for CPF, Brazilian phone with DDD, Chave Pix, CEP, and basic address text fields. The UI now shows inline errors and the profile update API enforces the same validations server-side.
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
- Replaced the former `onUserCreate` behavior with `/api/auth/bootstrap`, which does not overwrite existing user documents and backfills missing private profile data when needed.
- Added manual QA guide in `docs/MANUAL-QA.md`, including Phase 5 submission, moderation, voting, results, and negative browser checks.
- Added emulator seed script: `pnpm seed:emulator` creates local Auth users plus free/paid, active submission, and voting battle fixtures.
- Verified the Phase 5 emulator seed with `firebase emulators:exec --only auth,firestore "pnpm seed:emulator"`.
- Added Pix payment idempotency: existing non-expired pending Pix is reused; expired pending Pix is marked rejected and its pending entry is cleaned up before creating a fresh Pix.
- Added controlled failures/tests for missing `MP_ACCESS_TOKEN` and malformed Mercado Pago Pix responses.
- Added `docs/MERCADO-PAGO-ACCOUNT-SETUP.md` with the Mercado Pago account/application steps the payment receiver should take.
- Added `docs/MERCADO-PAGO-SANDBOX.md` with the required external sandbox validation steps and secrets.
- Configured the Mercado Pago seller test access token locally, verified token auth with `users/me`, created Mercado Pago seller/buyer test users, validated direct Orders API Pix creation, migrated app Pix creation to Mercado Pago Orders API with idempotency/expiration fields, and added owner-only Orders API status polling for pending payments.
- Added `pnpm validate:mp` and `pnpm validate:mp:order` for repeatable Mercado Pago sandbox validation without printing secrets; latest run returned `users/me` 200 and Orders API Pix creation 201 with QR/copia-e-cola present.
- Deployed `onPaymentWebhook` to `southamerica-east1` for project `assobiadores-3f0f6`, set Firebase secrets for Mercado Pago access token and webhook secret, verified endpoint reachability/method gating/signature rejection, and enabled Artifact Registry cleanup policy.
- Upgraded Cloud Functions runtime target to Node.js 22 in `firebase/functions/package.json`, installed Node 22 locally through `nvm`, updated `.nvmrc` and root `package.json` engines to Node 22, enabled pnpm through Corepack, upgraded the Firebase CLI to `15.16.0`, verified functions tests/type-check/build and web type-check under Node 22, and deployed the full production `v2` function set on `nodejs22`.
- Removed the obsolete `onUserCreate` `v1` Auth trigger from Cloud Functions and replaced it with a trusted `/api/auth/bootstrap` web route. The route verifies the Firebase ID token server-side, creates/backfills public/private user docs transactionally, reserves a unique username with uid-suffixed fallback, and is called after Google/Apple/email sign-in and email registration. Added focused bootstrap service and route tests.
- Fixed local Mercado Pago paid-route QA for emulator users by replacing `.test`/non-deliverable payer emails with a Mercado Pago-compatible `@testuser.com` payer email before creating Orders API Pix payments.
- Fixed and redeployed the Mercado Pago webhook to match Orders API payment webhooks by `externalPaymentId` first, with legacy `externalId` fallback; added regression tests for the payment-ID path.
- Added the qualifier registration fee payment structure: `/classificatorias` has category selection, derives Regional from profile `Naturalidade`, `POST /api/qualifiers/register` creates/reuses a R$ 4,00 Orders API Pix, payments now support `targetType: qualifier_registration`, and status/webhook confirmation updates `qualifierRegistrations` to `confirmed`.
- Added an emulator-only payment approval endpoint/control for local browser QA: `POST /api/payments/[paymentId]/simulate-approval` is unavailable outside Firebase emulator mode and lets testers complete the Pix success UX without pretending that "Verificar pagamento" can approve an unpaid Pix.
- Polished qualifier payment UX: Pix now opens in a modal instead of expanding the page grid, the qualifier notice is hidden on `/classificatorias`, the notice copy is shortened to `Classificatórias`, and confirmed category registrations disable new Pix creation while still allowing other categories.
- Added qualifier journey structure:
  - `QualifierRegistration` now has `bracketStatus`, `currentRound`, `currentMatchId`, `matchIds`, and `qualifiedChampionshipId`;
  - `QualifierMatch` models random 1v1 official fixtures with round, participants, deadlines, submissions, public votes, W.O./disqualification, and next-match linkage;
  - `qualifierMatches` are public-readable but never client-writable in Firestore rules;
  - `/classificatorias/{registrationId}` shows the user's status, deadlines, empty draw state, and generated matches;
  - `/classificatorias` links confirmed registrations to the journey page instead of only showing a static status card;
  - `docs/COMPETITION-MODEL.md` documents the qualifier collections and ownership boundaries;
  - focused qualifier helper/API tests and Firestore rules tests pass, including public read/server-owned write protection for `qualifierMatches`.
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
- Historical implementation note: official/community ranking separation was enforced for standalone battles, but the current product rule has changed to unified season/category scoring:
  - extracted `finalizeBattle` into a pure tested handler;
  - eligible official and community battle wins now award the documented low-weight season/category points through trusted server code;
  - remaining work: add anti-farming controls and broader QA for community scoring.
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
- Updated Classificatórias browsing:
  - `/classificatorias` now shows all 2026 state/category qualifier tracks publicly, logged in or logged out;
  - logged users still get their Naturalidade-eligible tracks first, with clear copy that registration outside their birth state is not allowed;
  - public track cards link to the shareable `/classificatorias/{state-category-year}` pages and preserve confirmed participant counts;
  - the page now keeps `Inscrição` immediately after available tracks, hides it once the logged user has all three eligible categories active, shows rules before broader browsing, and paginates the all-state discovery grid with SP/RJ/MG/BA/RS prioritized.
- Updated branding assets/copy:
  - official logo assets from `/Users/fehbrito/work/assobiador` are now available in the web and admin public folders;
  - web/admin metadata and favicon assets use the official green-background logo (`logo-background-colour.png`);
  - header/mobile header now show the official logo with `assobiador.com`;
  - footer keeps the shorter `Assobiador` brand label;
  - former `Batalha(s) de Assobio` branding copy was rebranded to `A casa do assobiador`.
- Admin login now supports email/password in addition to Google. In emulator mode the form pre-fills the seeded admin credentials `admin@example.test / password123`; production leaves the fields blank. The login page redirects immediately to `/` after successful email or Google sign-in instead of requiring a manual reload.
- Admin QA cleanup pass:
  - `Usuarios` now reads real `users` documents instead of showing a placeholder empty state;
  - `Pagamentos` now reads real `payments` documents, including qualifier registration payments;
  - admin battle finalization no longer calls deployed callable functions directly from `localhost:3001`; it uses the web admin API `POST /api/admin/battles/finalize`, avoiding the local CORS failure;
  - Classificatórias now have their own admin page at `/classificatorias` with track stats and generate/advance-round operations. The admin `Campeonatos` page no longer shows qualifier controls and no longer links finished `Battle` docs as championship classifiers;
  - emulator seed now clears/reseeds `payments` with aligned qualifier payment examples.
- Admin moderation was realigned with current product rules:
  - battle submissions no longer require approve/reject moderation; new battle submissions are immediately active for voting (`approved`) and moderation only removes content that violates platform rules;
  - battle submissions now use the same audio-only media rule as `Destaques Diários`: recorded in-browser, max 2 minutes, uploaded to Firebase Storage through trusted APIs, no YouTube/external URL submission path;
  - added `submissionReports` for community reports, with server-owned writes through `POST /api/submissions/{submissionId}/report`;
  - admin moderation now shows open reports plus all active submissions, uses a single `Remover` action through `POST /api/submissions/{submissionId}/moderate`, and no longer displays raw video URLs in the UI;
  - public battle voting cards now include a report action for logged users;
  - Firestore rules protect `submissionReports` so only admins and the reporting user can read reports, with all writes server-owned;
  - emulator seed now includes active, reported, and removed submission fixtures instead of the old approval queue fixtures.
- Added qualifier bracket planning foundation:
  - `qualifierTracks`/`qualifierMatches` now support daily match scheduling metadata (`dailyMatchLimit`, planned match/day counts, current round, match day index, sequence in day);
  - bracket planner calculates byes, round sizes, total match days, and BRT submission/voting windows with daily caps of 5/12/24 matches for small/medium/large qualifier tracks;
  - trusted admin API `/api/admin/qualifiers/generate` now generates first-round qualifier matches from confirmed registrations, assigns byes, immediately qualifies tracks with 64 or fewer confirmed participants, and rejects duplicate generation;
  - admin `/classificatorias` includes `Gerar chave` and `Avançar rodada` controls for state/category qualifier bracket operation;
  - public qualifier track pages now include a first pass of the bracket view with round chevrons and vertical match cards;
  - emulator seed now includes sample SP Freestyle qualifier matches for browser QA;
  - `docs/COMPETITION-MODEL.md` documents byes, participant voting restriction, judge tiebreaker, and daily match caps.
- Added qualifier match submission foundation:
  - `qualifierSubmissions` is now modeled as public-readable/server-owned official audio media for qualifier matches;
  - `POST /api/qualifiers/matches/{matchId}/submit` verifies auth, participant ownership, confirmed registration, match `submissions_open` status, submission deadline, duplicate submission state, and 2-minute audio limits before writing the submission and attaching it to `qualifierMatches.submissionIds`;
  - `/classificatorias/{registrationId}` now shows an `Enviar assobio` action for the logged participant when their match submission window is open and switches to `Envio recebido` after submission;
  - emulator seed now creates confirmed qualifier registrations and keeps sample SP Freestyle matches open for browser QA;
  - tests added for qualifier submission service/API cleanup and Firestore rules for `qualifierSubmissions`.
- Added qualifier voting/finalization foundation:
  - `qualifierVotes` is now private-to-voter/server-owned and blocked from direct client writes;
  - `POST /api/qualifiers/matches/{matchId}/vote` enforces logged-in voting, match `voting` status, voting window, one vote per user per match, valid submitted audio, and participant exclusion from qualifier voting;
  - public qualifier track pages show submitted audio and vote controls inline on each participant row for `voting` matches, keep the match result summary centered in the end column, and show participants a no-vote notice;
  - `POST /api/admin/qualifiers/finalize-match` finalizes trusted qualifier matches, handles W.O. when one or both participants miss submission, writes winner/disqualification state, updates registration bracket status, and awards 200 phase-advance points to the winner;
  - emulator seed now includes a sample SP Freestyle voting match with audio submissions for browser QA.
- Added qualifier round advancement:
  - trusted admin API `POST /api/admin/qualifiers/advance-round` advances the current completed state/category round after every match is `finished` or `walkover`;
  - if more than 64 entrants remain, it creates the next round, carries byes forward, and updates registration `currentMatchId`/`matchIds`;
  - when 64 or fewer entrants remain, it marks them `qualified`, finishes the track, and awards 500 qualifier-to-Regional points;
  - admin `/campeonatos` now has `Avançar rodada` beside `Gerar chave`.
- Expanded emulator QA seed:
  - added 12 extra QA users (`qa1@example.test` through `qa12@example.test`, all with `password123`) with different states and season/category points;
  - seeded richer standalone battle fixtures: free open, paid open, active submission, voting with 8 participants/submissions, community group open, and finished results;
  - seeded battle entries, audio submissions, votes, removed submission, and open/reviewed moderation reports using audio-only media metadata;
  - seeded 10 `Destaques Diários` entries for the current UTC day with likes/vote counts so homepage and `/destaques` have enough ranked data;
  - seeded qualifier tracks across SP/RJ/MG/BA/RS, paid qualifier registrations with confirmed and pending-payment states, public participants, sample qualifier matches/submissions/vote, and payment records for every qualifier registration plus paid battle examples;
  - seed now clears the affected QA collections before rewriting them so stale fixture data does not linger.
- Added repeatable V1 day-one QA seed:
  - run with `pnpm seed:qa:v1`;
  - clears contest/ranking/payment emulator collections and recreates a fresh launch-like dataset;
  - preserves the main QA credentials `user@example.test / password123`, voter credentials `voter@example.test / password123`, and admin credentials `admin@example.test / password123`;
  - creates 200 ranked QA users, 50 audio-only `Destaques Diários` entries for today, one SP Freestyle Classificatória with 100 confirmed contestants, five qualifier matches with contestant/voter test states, and four battle fixtures: free public entry with 10 participants, paid open entry with 20 paid participants, paid active battle with 50 paid participants including the main account, and a 1v1 voting battle created by the main account without the main account as participant;
  - verified emulator counts after seeding: 203 users, 4 battles, 82 battle entries, 50 daily highlights, 100 confirmed SP Freestyle qualifier registrations, 170 payments, 5 qualifier matches, and 4 qualifier submissions.
- Refined standalone battle UX/rules:
  - `/batalhas` filter controls now use aligned dropdown selects for status/category/type instead of chip groups;
  - `/batalhas/{battleId}` is now the primary interaction surface with participants, submission state, playable audio, inline free/paid participation, and inline voting on participant cards with a confirmation modal to prevent misclicks;
  - `/batalhas/{battleId}` now presents `Cronograma` and `Regras` as the first two-column context row, moves `Participantes` to a full-width section with full-width participant rows, renames the registration schedule item to `Prazo Inscrições`, moves the long voting rule out of the header, hides empty rule placeholder copy, and shows the logged user's approved paid-entry timestamp when available;
  - battle audio submission now opens as an inline modal from `/batalhas/{battleId}` instead of navigating to `/batalhas/{battleId}/enviar`; the header battle ticker now routes active battles to the detail page for the same modal-first flow; battle submission category is inherited from the battle and the redundant `Seu envio` participant badge was removed;
  - creator-owned finalization is now available through `POST /api/battles/{battleId}/finalize`; the admin API remains an override path, but the admin UI no longer shows edit/finalize controls for normal battle operation;
  - admin battle rows are clickable/keyboard-accessible again and include an `Abrir` action to inspect or edit a battle when admin intervention is needed;
  - admin battle edit form is aligned with public battle rules: removed obsolete voting-mode selector, paid-battle prize total is read-only/derived from confirmed payments, and admin saves no longer overwrite paid battle prize pool/distribution;
  - paid battle confirmations now update flexible prize pools: 20% platform fee, 80% prize pool, paid to the single battle winner;
  - emulator paid battle seed now reflects confirmed paid entries only and derives prize/platform amounts from entry payments;
  - battle votes now follow the product rule of 100% community vote with the creator vote used only as a tie-break signal. Confirmed participants are blocked from voting in their own battle by the trusted vote API, creator votes no longer increment public `voteCount`, and finalization ranks by community votes first;
  - battle creation now supports open vs invite-only entry, while `1v1` forces exactly two participants and unresolved tied results award no season/category points;
  - trusted vote creation now blocks duplicate votes, self-votes, and confirmed participants voting in their own battle; battle voting is public/community-first with only the creator vote stored separately for tie-breaks;
  - trusted battle finalization now treats unresolved tied battle results as no-winner/no-points outcomes, while a creator tie-break vote can resolve a community-vote tie;
  - emulator battle entries now denormalize display names for cleaner participant QA.
- Fixed local QA audio playback:
  - seeded battle, qualifier, and `Destaques Diários` media now point to a real same-origin WAV fixture at `/sample-audio/assobio.wav` instead of a non-existent Firebase Storage emulator object;
  - the sample audio asset exists in both `apps/web/public/sample-audio/assobio.wav` and `apps/admin/public/sample-audio/assobio.wav` so relative seeded media URLs work in public and admin QA sessions;
  - the fixture was regenerated as an audible 4.8s mono whistle-like WAV after the first replacement proved playable but silent/too quiet;
  - `AudioHighlightPlayer` now catches unsupported-source/play failures so a bad media document cannot throw an uncaught promise rejection in the browser;
  - `pnpm seed:qa:v1` was rerun and emulator documents were verified with `mediaURL: /sample-audio/assobio.wav` and `mediaContentType: audio/wav` for daily highlights, battles, and qualifier submissions.
- Fixed homepage platform counters:
  - `Plataforma > Numeros gerais` no longer uses capped client query lengths (`highlightUsers` was limited to 100);
  - added public `GET /api/platform/stats`, backed by Firestore aggregate counts for `users` and `battles`;
  - homepage now reads those aggregate counters, which reports 203 users and 4 battles for the current V1 QA seed;
  - added tests for the platform stats service and API route.
- Refined ranking page behavior:
  - removed the unsupported `Top 50` business copy and removed the final `.slice(0, 50)` cap that made filters misleading;
  - removed the `limit(500)` user query cap from `/ranking`;
  - added pagination after the full filtered/sorted ranking result, showing 50 rows per page as presentation only while preserving the full result count;
  - removed the `Ver temporadas anteriores` link for now because this is the first season;
  - added tested ranking view helpers for filtering/sorting and post-filter pagination.
- Improved `Destaques Diários` voting feedback:
  - confirmed daily highlight voting already stores one server-owned `dailyHighlightLikes/{dayKey}_{userId}` document with `dayKey`, `dailyHighlightId`, and `userId`, and increments `dailyHighlights.voteCount` in the same trusted transaction;
  - `/destaques` now reads the logged user's like document for the current day and marks the selected entry as `Seu voto`;
  - after the user has voted, other entries keep the `Votar` label but are disabled, while only the selected entry shows `Seu voto`;
  - fixed the vote feedback lookup to use the `dayKey` of the currently visible highlights, not just the browser's current UTC date, so seeded/local QA entries that display as today still show the selected vote correctly;
  - added tested view helpers for daily highlight vote state.
- Fixed `Destaques Diários` daily consistency and closure:
  - homepage and `/destaques` now fetch enough `dailyHighlights` docs and use the same shared Brazil-day selector, so the homepage top 3 and `Ver mais` top 3 are the same;
  - the selector no longer falls back to previous-day entries and uses `America/Sao_Paulo` day keys instead of browser-local midnight;
  - daily highlight submit/vote backend day keys now use Brazil time;
  - voting is blocked by the trusted like service after 22:00 BRT;
  - added scheduled Cloud Function `finalizeDailyHighlights` at 22:05 BRT to close active entries, mark top-3 placements, and award 15/10/5 season/category points through server-owned writes;
  - V1/local seeds now create daily highlights for the current Brazil day; reseeded emulator data verified 50 daily entries for `2026-05-05` with top 3 `daily-v1-01`, `daily-v1-02`, and `daily-v1-03`.
- Fixed local daily-highlight submit 500 after emulator reseeds: the root cause was Firebase Admin rejecting the browser's stale/revoked ID token; the submit modal now forces an ID-token refresh before upload, and the shared auth helper returns a clear `401` if the session still needs a new login. Focused tests cover missing bearer tokens, valid verification, revoked/expired/invalid tokens, unexpected Admin errors, and emulator host setup.
- Added date-aware `Destaques Diários` UX:
  - homepage and `/destaques` titles now include the Brazil day date, for example `Destaques Diários - 05/05/2026`;
  - `/destaques` now has day navigation with chevrons plus `Ir para Hoje`;
  - today still shows the full voting list and submit action, while previous days show only finalized top-3 winners;
  - added Firestore indexes for `dailyHighlights` day-specific queries by `createdAt` and `placement`;
  - added tested daily-highlight view helpers for day-key formatting, date shifting, and previous-day winner filtering.
- Daily-highlight `Enviar` CTA now hides for logged-in users who already submitted an entry for the current Brazil day. Homepage and `/destaques` both use a direct `{dayKey, userId}` lookup instead of inferring from visible highlights, with a Firestore composite index and updated visibility tests.
- Local emulator QA data: replaced the mistaken `2025-05-04` finalized top-3 `Destaques Diários` records with `2026-05-04` entries (`Ana Paulista`, `Bruno Carioca`, `Carla Mineira`) so previous-day winner navigation can be tested.
- `/destaques` archive navigation is capped at `01/05/2026`; the previous-day chevron disables at that floor and cannot navigate earlier.
- Battle detail UX/rules update:
  - removed `Prazo Inscrições` from the battle detail schedule; the schedule now focuses on `Envios até`, `Votação inicia`, and `Votação encerra`;
  - confirmed participants can submit right after joining/payment/invite while the battle is in `registration` or `active`, as long as the submission deadline has not passed;
  - trusted submission service now enforces the same status/deadline rule server-side;
  - paid battle rules now show a dedicated `Prêmio` card: `80% do valor total do pagamento da taxa de entrada.`;
  - added tested battle detail view helpers for schedule/rule copy and submit CTA visibility.
- Battle listing now shows paid battle prize pools inline in the metadata row after participants/date, as `Prêmio: R$ ...`, while free/no-prize battles omit the prize label.
- Battle vote/result feedback:
  - battle detail now reads the logged user's `votes` doc for the current battle, marks the selected contestant as `Seu voto`, and disables the remaining vote buttons while keeping the `Votar` label;
  - finished battles now have a single winner only; tied 1v1 battles store no winner and award no points;
  - finished battle participant lists now sort the winner first, then the remaining contestants from most votes to least;
  - finished battle submissions now separate community vote count from the creator vote signal, showing `Voto do Criador` only when that vote exists;
  - finished battle winner metadata now labels ranking points as `Pontuação Ranking: +N`;
  - battle finalization now chooses winners only from confirmed participant submissions, ensuring the displayed winner and awarded points stay aligned;
  - battle finalization now stores only the first-place winner in `battle.winners`; paid battles award the available battle prize pool to that winner, and the older Cloud Functions finalizer follows the same single-winner rule;
  - battle finalization now requires `votingEnd` to be reached before creator/admin finalization can run; this is enforced in the trusted service and covered by focused tests;
  - added tested battle vote/result view helpers and finalization coverage for ignoring non-participant submissions.
- `/batalhas` now includes a logged-in top scope switch (`Todas` / `Minhas batalhas` / `Minhas participações`) in the same list section instead of a separate inner section. `Minhas batalhas` means battles created by the logged user; `Minhas participações` means battles where the user has a confirmed `battleEntries` record, backed by the `{userId, status}` Firestore index.
- `/batalhas` filter dropdowns were simplified after the top scope switch: neutral dropdown state now shows the field label instead of another `Todas` option, and `Inscrições abertas` was removed from status filters because contestants can submit immediately after joining/payment/invite.
- `/criar-batalha` cronograma now follows the same battle flow: removed `Inscrições encerram`, collects only `Envios até`, `Votação começa`, and `Votação encerra`. The trusted create service no longer requires a separate `registrationEnd`; it derives the legacy stored field from `submissionDeadline` for compatibility and validates only submission deadline -> voting start -> voting end ordering.
- Fixed the `/api/battles/create` 400 after removing the create-form registration deadline: `createCommunityBattle` now normalizes requests that omit `registrationEnd` before schema parsing, then stores `registrationEnd = submissionDeadline` only as a legacy compatibility field.
- Battle creation/entry edge fixes:
  - community battle creation now allows a small 60-second future-date tolerance for `Envios até`, avoiding false `Prazo de envio deve ser futuro` errors caused by `datetime-local` minute precision and server/client timing drift;
  - battle creators no longer see the public `Participar`/`Pagar entrada` CTA on their own battle;
  - free and paid battle entry paths now reject creator self-participation server-side.
- QA emulator seed for battle `eqTboF8twYKWwMsPer0C`:
  - reset only that battle's entries/submissions/votes;
  - seeded 20 confirmed contestants with approved on-platform audio submissions and vote counts;
  - set the battle to `voting` with `votingEnd` in the past so the creator/admin finish flow can be validated immediately.
- Public profile point activity feed:
  - added server-owned `pointActivities` documents for ranking point awards, with Firestore rules allowing public reads and blocking all client writes;
  - trusted web services now write point activity rows for daily highlight submissions, battle wins, qualifier entry confirmations, qualifier phase advancement, and Regional qualification;
  - Cloud Functions finalizers now also write point activity rows for battle wins and daily highlight top-3 placements;
  - `/perfil/[userId]` replaced the placeholder battle history with `Pontos conquistados`, showing rows such as `+20 Vitoria em batalha` and `+1 Envio em Destaques Diarios`;
  - public profile counters are now derived from real public records where possible (`battleEntries`, `submissions`, `dailyHighlights`, `pointActivities`) while keeping server aggregates as a fallback floor, reducing stale stat displays after QA reseeds or missed backfills.
- Account/profile wording and homepage UX polish:
  - `/conta` is now the logged-in account settings page, with `/meu-perfil` kept as a compatibility redirect to avoid breaking old links;
  - account navigation copy changed from `Meu Perfil` to `Minha Conta`, preserving `Meu Perfil` terminology for public profile contexts;
  - homepage main column is visually ordered as Batalhas first, then Classificatórias, then Campeonatos;
  - homepage Batalhas remains capped to 6 active cards, and Campeonato cards after the first 6 are hidden on mobile while still available on wider layouts;
  - finalized same-day Destaques Diários cards can show subtle `1º lugar` / `2º lugar` / `3º lugar` placement text above the media card.
- Classificatórias polish and QA seed:
  - `/classificatorias/[slug]` replaced the old `Como funciona` block with a `Regras` section matching the Batalhas card style;
  - qualifier bracket generation now marks first-round byes as `currentRound: 2` and `waiting_draw`, so odd/unpaired contestants are immediately waiting for the next round instead of remaining in round 1;
  - focused tests cover qualifier rule cards and the active-vs-bye registration updates during first-round generation;
  - qualifier match sorting now uses round, scheduled date, match day, and sequence so brackets render from Dia 1 forward consistently;
  - public qualifier match cards now show `Votação em andamento` during the voting window instead of repeating the submission deadline;
  - public qualifier W.O. cards now show `Resultado por W.O.` instead of stale submission deadline copy;
  - Cloud Functions now include `finalizeDueQualifiers`, a scheduled finalizer that checks due qualifier matches every 5 minutes in `America/Sao_Paulo` and finalizes voting matches after `votingEnd`;
  - admin Classificatórias gained a manual `Finalizar rodada` override, and the operation controls now place selectors and buttons on separate rows for readability;
  - qualifier advancement now writes qualified contestants into the matching Regional championship (`championship-{state}-2026-{category}`), updating `participantIds` and `currentParticipants` so the public Regional page shows them after qualification;
  - public qualifier bracket result cards now read the matching Regional championship participant list and show `Classificado para o Regional` when the winner has actually qualified, avoiding the ambiguous `Resultado` state after the final advance;
  - qualifier advancement also mirrors qualification metadata onto the public `qualifierParticipants/{registrationId}` record with merge writes, keeping future public UI reads aligned without exposing private registration/payment fields;
  - the V1 QA seed now puts `SP Freestyle 2026` in the final qualifier round with 500 confirmed contestants, 64 round-3 matches, 122 submitted audio entries, 58 voting matches, 6 visible W.O. matches, and 6 W.O. winners already waiting for qualification;
  - the same seed now keeps historical Rodada 1 and Rodada 2 match/submission documents so the public qualifier bracket chevrons can navigate back from the live final round;
  - the public qualifier page now defaults to the latest available round instead of always starting at Rodada 1;
  - after QA runs `Finalizar rodada` and then `Avançar rodada`, the final 64 alive contestants should be written into `championship-sp-2026-freestyle` for Regional page validation;
  - browser QA status: Classificatórias flow is checked for contestant/voter views, round navigation, W.O. display, final-round advancement, and Regional qualification visibility.
- Google integrations for stable/V1 launch:
  - added env-gated GA4 integration that loads `gtag.js` only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set and emulator mode is off;
  - GA4 page views are sent on client-side route/query changes so navigation interest can be tracked across the app;
  - added env-gated Google AdSense bottom banner using `NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT` and `NEXT_PUBLIC_GOOGLE_ADSENSE_BOTTOM_SLOT`, with bottom spacing and a `Publicidade` label;
  - added the production AdSense publisher/client ID `ca-pub-1405185920341102` to App Hosting and split publisher verification from ad-slot rendering, so Google can review `assobiador.com` before an approved bottom-banner slot exists; the publisher script is rendered in the document head so AdSense ownership verification can find it in the initial HTML;
  - documented setup in `docs/GOOGLE-INTEGRATIONS.md`;
  - added focused tests for Google integration config gating and GA page-path building.
- CI/CD:
  - added GitHub Actions CI in `.github/workflows/ci.yml` for PRs and pushes to `main`/`develop`, running pnpm install, tests including Firestore rules emulator tests, type-check, and build on Node.js 22 + Java 21;
  - added production deployment workflow in `.github/workflows/firebase-app-hosting.yml` that validates first, deploys Firestore/Storage config, then creates a Firebase App Hosting rollout by commit SHA;
  - documented required GitHub secrets/variables and App Hosting runtime configuration in `docs/CI-CD.md`;
  - updated `apps/web/apphosting.yaml` so GA4 and AdSense public IDs are available at build/runtime in Firebase App Hosting.
  - created Firebase App Hosting backend `assobiador-web` in `us-east4` for project `assobiadores-3f0f6`; `southamerica-east1` is not available for App Hosting, so the workflow defaults to `assobiador-web`.
  - created deploy service account `github-actions-deploy@assobiadores-3f0f6.iam.gserviceaccount.com`, granted `roles/firebase.admin` and `roles/firebaseapphosting.admin`, and generated the GitHub secret JSON at `/private/tmp/assobiadores-github-actions-deploy.json`.
  - granted `roles/iam.serviceAccountAdmin` to the same deploy service account after App Hosting local-source deploy required `iam.serviceAccounts.create`.
  - granted `roles/resourcemanager.projectIamAdmin` to the deploy service account after App Hosting local-source deploy required `cloudresourcemanager.projects.setIamPolicy`.
  - granted `roles/iam.serviceAccountUser` on `firebase-app-hosting-compute@assobiadores-3f0f6.iam.gserviceaccount.com` to the deploy service account after App Hosting rollout required `iam.serviceAccounts.actAs`.
  - fixed CI rules-test command to call Firebase CLI through `pnpm exec firebase` and added `firebase-tools@15.16.0` as a root dev dependency so GitHub runners have the CLI binary after `pnpm install`.
  - adjusted production deploy so Firestore rules/indexes deploy independently and Storage rules deploy only when `FIREBASE_DEPLOY_STORAGE_RULES=true`; Firebase Storage still needs the Firebase Console `Get started` bucket setup before production uploads can work.
  - removed the unnecessary `users.points DESC` composite index because Firestore rejected it as a single-field index that should be handled by automatic single-field indexing.
  - switched App Hosting CI/CD from `apphosting:rollouts:create --git-commit` to local-source `firebase deploy --only apphosting:assobiador-web` because the App Hosting backend is not connected to a Firebase Console GitHub repository; App Hosting now uses root-level `firebase.apphosting.json` so the source upload includes `apps/web`, and the corrected command passed a dry run.
  - fixed App Hosting YAML env declarations for web and admin by adding explicit `value` entries for public Firebase variables; optional GA/AdSense entries are left out until real production IDs exist because App Hosting rejects env entries that do not have either `value` or `secret`.
  - removed missing Firebase Admin private-key secrets from App Hosting config; the web runtime now uses App Hosting Application Default Credentials for Firebase Admin, while `MP_ACCESS_TOKEN` and `MP_WEBHOOK_SECRET` remain runtime-only secrets.
  - granted the `assobiador-web` App Hosting backend access to the existing `MP_ACCESS_TOKEN` and `MP_WEBHOOK_SECRET` secrets.
  - added focused `@batalha/firebase` tests for Firebase Admin initialization options so App Hosting can use default credentials without private-key secrets while still catching partial explicit credential config.
  - refactored ranking direction toward the long-term model: `pointActivities` remains the append-only ledger, `seasonRankings/{seasonId}/users/{userId}` is the public unified season leaderboard read model, and category points are now only breakdown/audit context.
  - removed category selector/copy from homepage and `/ranking` official ranking views so points from Freestyle, Melodia, and Pássaros combine into one season score.
  - added an official 2026 championship catalog seed for production/emulator use: 3 Nationals and 81 Regionals are upserted as real `championships` docs; Nationals display `A definir`, and Regional registration starts on 2026-06-01.
  - ran the official 2026 catalog seed against production project `assobiadores-3f0f6` and verified `84` championship docs exist for season `2026` (`3` national, `81` regional).
- Mercado Pago local QA setup:
  - restarted the Firebase emulator suite for `demo-batalha` and reseeded the local V1 day-one QA scenario with `pnpm seed:qa:v1`;
  - restarted the public web dev server at `http://localhost:3002` with `apps/web/.env.local` loaded, `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`, and emulator-backed data;
  - payment QA fixtures now include `user@example.test / password123`, paid battle `/batalhas/v1-paid-entry-20` where the main user can generate a fresh sandbox Pix, paid battle `/batalhas/v1-paid-main-50` where the main user is already confirmed, and SP classificatória categories where the main user is confirmed in Freestyle but can still generate fresh sandbox Pix for Melodia or Pássaros.
  - local Mercado Pago credential rule: browser Pix QA depends on the concrete Orders API response (`hasQr: true` and `hasCopyPaste: true`) rather than trusting a token prefix.
  - follow-up browser QA: user confirmed the local Mercado Pago payment creation flow is now working after credential/config adjustment for both paid battle entry and classificatória entry Pix generation; continue testing approval/webhook confirmation paths and idempotent Firestore updates.
  - added local/sandbox-only `MP_SANDBOX_AUTO_APPROVE=true`; when enabled, Mercado Pago Pix order creation sends the documented sandbox payer marker (`test@testuser.com` + `APRO`) so real sandbox approval/status/webhook paths can be tested without using the emulator-only approval shortcut. Focused paid battle and classificatória route tests cover that this marker is only sent when explicitly enabled.
  - browser QA confirmed Mercado Pago sandbox auto-approval works end-to-end locally: after generating Pix, the payment becomes paid/confirmed without clicking the emulator-only approval button.
  - production webhook alignment: `onPaymentWebhook` now supports Mercado Pago Orders API `order.*` notifications, maps `processed/accredited` to internal `approved`, confirms paid battle entries, updates battle prize/platform fee totals, confirms classificatória registrations, creates qualifier participant projections, and awards the +50 qualifier entry ranking activity.
  - added `scripts/validate-mercado-pago-webhook.cjs` and `pnpm validate:mp:webhook` for repeatable temporary production webhook QA; it creates clearly prefixed paid battle + classificatória payment fixtures, prints polling progress while waiting for Mercado Pago dispatch, and cleans temporary docs after both success and timeout unless `--keep` is used.
  - corrected the Mercado Pago ID interpretation after the Integrations list showed `Assobiador Sandbox` application `7371689332870221` while the sandbox credential/token context is `3392279113078093`; the webhook URL/events/secret belong to the Integrations application, while Orders API requests use the sandbox credentials from that application page.
  - renamed the Mercado Pago webhook QA script's strict token check from application-id language to `MP_EXPECTED_TOKEN_CONTEXT_ID`, keeping the old env var as a compatibility fallback so we do not confuse the dashboard application number with the sandbox credential context.
  - reran `pnpm validate:mp:webhook` with the strict app-id check; Mercado Pago still did not auto-dispatch Order webhook events after 3 minutes, so the next validation step is the Mercado Pago dashboard **Simular notificação** flow using a kept validator fixture and the printed `ORD...` Order ID.
  - updated `pnpm validate:mp:webhook` to print `battleOrderId` and `qualifierOrderId` for dashboard notification simulation and added `--create-only` so a kept fixture can be created without waiting through the polling timeout.
  - fixed Mercado Pago dashboard simulation 401s: `onPaymentWebhook` now uses query-string `data.id` first and falls back to POST body `data.id` for signature validation, matching the dashboard simulator payload shape; deployed the updated function and added regression coverage.
  - dashboard simulation still returned 401 after the body `data.id` fallback, so `onPaymentWebhook` now logs safe signature diagnostics on rejection (`hasSignatureHeader`, `hasRequestId`, data id source/body metadata only; no secrets or tokens) and the diagnostic build was deployed for the next simulator retry.
  - deployed the updated `onPaymentWebhook` function to `southamerica-east1` and validated the production endpoint with signed `order.updated` requests using the deployed Secret Manager webhook secret; verified Firestore side effects for paid battle (`entryStatus=confirmed`, `battleParticipants=1`, `battlePrizePool=320`, `platformFeeTotal=80`) and classificatória (`registrationStatus=confirmed`, participant projection exists, user points `50`), then cleaned up the temporary production QA docs.
  - rotated `MP_WEBHOOK_SECRET` to Secret Manager version 2 using the current **Assobiador Sandbox** webhook secret from Mercado Pago and redeployed `onPaymentWebhook` so the function no longer uses stale secret version 1.
  - Mercado Pago dashboard **Simular notificação** for `Order (Mercado Pago)` now returns `200 OK`, confirming the deployed webhook accepts the real dashboard signature after the secret rotation; use a real `ORD...` id from a kept QA fixture or browser Pix flow to validate Firestore side effects through Mercado Pago dispatch.
  - fixed the remaining Mercado Pago `ORDTST...` signature mismatch: the webhook signature verifier now accepts both the documented lowercased `data.id` manifest and Mercado Pago's observed raw uppercase Order ID manifest, still requiring the configured webhook secret; added focused regression coverage and redeployed `onPaymentWebhook`.
  - confirmed end-to-end Mercado Pago dashboard simulation with real kept QA order `ORDTST01KR14REZSA0K0AGF9J97H12ZN`: the production webhook returned `200 OK`, matched `payments/qa-mp-webhook-1778155010172-battle-payment`, set payment `approved`, confirmed the battle entry, incremented battle participants to `1`, and set the battle prize pool to `320` cents.
  - confirmed end-to-end Mercado Pago dashboard simulation for a real kept classificatória QA order `ORDTST01KR18N402YKBEQMD05SZZDA03`: production payment `qa-mp-webhook-1778159087206-qualifier-payment` became `approved`, registration became `confirmed`, qualifier participant projection exists, user points became `50`, the `pointActivities` ledger has one `qualifier_entry` activity, and `seasonRankings/2026/users/...` has `totalPoints: 50`.
  - added temporary `MP_SANDBOX_AUTO_APPROVE=true` runtime config to `apps/web/apphosting.yaml` for `assobiador.com` sandbox-domain QA; remove or disable it before switching App Hosting to real production Mercado Pago credentials or running a real-money Pix smoke test.
  - fixed date-sensitive submission-service tests that started failing once the real clock passed the hardcoded battle submission deadline; the 403 confirmed-entry and 409 duplicate-submission cases now pin `now` before the deadline so they assert the intended branches.
  - production domain classificatória payment creation returned `500` because Mercado Pago rejected the Orders API request with `400`; added server-side logging of Mercado Pago's rejected response body for battle and classificatória payment creation while keeping client errors generic, plus focused route tests.
  - tightened Mercado Pago rejection logging to print a plain `{ status, responseBody }` object from payment routes; Cloud Run was previously formatting the custom Error stack without the response body, which hid the actual Mercado Pago validation reason.
  - further tightened the same Mercado Pago rejection logs to JSON-stringify nested response bodies after Cloud Run rendered Mercado Pago's nested `errors` array as `[Object]`; focused payment-route tests still pass.
  - fixed the production classificatória Pix creation blocker reported by Mercado Pago: Orders API `external_reference` has a 64-character limit, while the raw Firebase UID + qualifier metadata reference reached 77 chars in production. Payment routes now use a deterministic short Mercado Pago reference with a hash suffix, and tests cover the 64-character limit plus battle/qualifier request payloads.
  - created production QA paid battle fixture `qa-paid-battle-mp-smoke-1778198264250` so the paid-battle Mercado Pago sandbox-domain smoke test can proceed while the public create-battle paid-entry UI is still pending polish.
  - paid-battle sandbox-domain smoke backend passed: Mercado Pago payment became `approved`, the battle entry became `confirmed`, battle participant count incremented to `1`, prize pool became `320` cents, and platform fee total became `80` cents.
  - fixed the paid-battle detail UI mismatch where the approved-payment badge appeared but participants and join state did not update: the `battleEntries` listener no longer depends on a missing production `battleId + createdAt` composite index and instead sorts participants client-side by `createdAt`; focused battle-detail and payment-route tests pass.
  - disabled `MP_SANDBOX_AUTO_APPROVE` in `apps/web/apphosting.yaml` so the next App Hosting deploy is ready for production Mercado Pago credential switching / real-money smoke tests; docs now state that the flag should only be enabled for explicit sandbox-domain QA.
  - deploy workflow clarification: `.github/workflows/ci.yml` only validates, while `.github/workflows/firebase-app-hosting.yml` performs the production App Hosting deploy on `main` pushes or manual `workflow_dispatch` after its own validation job.
  - remaining real Mercado Pago dispatch step: in the Mercado Pago webhook dashboard, enable **Order (Mercado Pago)** for the configured URL. Payment-only notifications do not dispatch the `order.*` event used by the Orders API Pix flow.
  - added `/agenda` as a simple unified upcoming-events page that lists Batalhas, Classificatórias, and scheduled Campeonatos sorted by the closest next relevant date/time; the header ticker CTA now points to this page and shares the same tested event-selection helper.
  - added legal draft pages for `/termos-de-uso` and `/privacidade`, wired the footer Legal links to those routes, and covered the route/content contract with a focused unit test.
  - configured production GA4 for App Hosting with `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-5VF1RXJ1TW`; Analytics should start receiving page views after the next App Hosting deploy.
  - fixed Google Analytics/AdSense runtime env loading for the Next client bundle: browser-facing Google integration components now pass explicit `NEXT_PUBLIC_*` env values through `getPublicGoogleEnv()` instead of relying on the whole `process.env` object, which can be empty/fragile in client bundles. Added regression coverage and the full web test suite passes.
  - added GA4 auth-funnel events: `auth_cta_click` for visible `Entrar`/`Criar conta` CTA clicks and `auth_attempt` for email/Google/Apple login/signup attempts. Events include only action/method/location metadata and no personal data.
  - improved mobile audio recording and preview reliability across Daily Highlights, Battles, and Qualifiers: recording settings are now centralized, Apple/mobile browsers prefer MP4-compatible recording when supported, upload filenames match the real recorded MIME type, microphone capture requests avoid voice-call processing that can damage whistle quality, recordings flush in 1-second chunks, and the shared audio player now shows loading/error feedback instead of failing silently. Added focused recorder-helper coverage.
  - fixed battle detail submission visibility/duplicate-submit bug: approved battle submissions are now read with a simple `battleId + status` query and sorted in memory instead of requiring a fragile `orderBy(voteCount)` composite query. This prevents the page from missing a just-submitted audio, keeping the `Enviar` action visible, and showing “Assobio ainda nao enviado” incorrectly. Duplicate server error copy now says audio instead of video.
  - polished the mobile shell UX: mobile header now has a visible icon action for `Criar batalha`, account/profile actions live inside the hamburger menu instead of taking header space, the mobile drawer opens from the right where the trigger lives, the mobile drawer has first-class navigation with `Criar batalha` as the primary action, the home Destaques header stacks actions below the copy on narrow screens, the header event ticker and qualifier notice are denser, and audio/payment/vote overlays lock background scroll and render as mobile-friendly bottom sheets. Added focused mobile-navigation coverage.
  - improved Mercado Pago Orders API payload quality for approval-rate recommendations: Battle and Classificatória Pix orders now send one structured item with `quantity: 1` and the correct `unit_price`, include the `ASSOBIADOR` statement descriptor in the payment method, load Mercado Pago's browser security script on payment-capable pages, and forward a sanitized `X-meli-session-id` Device ID header when available. The Device ID is not stored in Firestore.
  - fixed local Mercado Pago payment creation after the enriched payload: the Orders API rejects `items.external_code` longer than 30 characters, so item external codes now use a deterministic 30-character hashed form while payment `external_reference` remains capped at 64 characters. Verified the enriched Pix payload with `pnpm validate:mp -- --create-order`, which returned `status: 201`, QR data, and copia-e-cola.
  - added focused tests for Mercado Pago item normalization, statement descriptor/device-id forwarding, unsafe device-id rejection, Battle/Classificatória route payloads, and the 30-character item external-code limit. Verified with `pnpm --filter web test -- mercado-pago-orders payments/create qualifiers/register` and `pnpm --filter web type-check`.
  - added partner referral attribution for links like `https://assobiador.com/?ref=AbsoluteAssobio`: a root-level client capture stores approved attribution for 30 days in local/session storage, signup/login bootstrap sends it to the trusted API, and the server writes `users/{uid}.ref`, `refCode`, and `referral` once without overwriting an existing acquisition source. GA4 now receives `partner_referral_captured`, referral-tagged `auth_attempt`, `partner_referral_bootstrap`, and `partner_referral_rejected` for unknown ref attempts without personal data.
  - tightened referral attribution to a central allowlist registry instead of accepting arbitrary URL values. Current approved referral URL value is only `AbsoluteAssobio`; unknown values are ignored for persistence and only counted as rejected analytics attempts so Firestore acquisition data is not polluted.
  - added `AbsoluteAssobio` to the partner referral allowlist; links using `?ref=AbsoluteAssobio` are normalized to `absoluteassobio` and stored with partner name `AbsoluteAssobio`.
  - protected referral acquisition fields in Firestore rules so clients cannot create or edit `ref`, `refCode`, or `referral` directly; only trusted bootstrap/server code owns those fields. Added focused referral attribution/service/auth/bootstrap tests plus rules coverage. Verified with `pnpm --filter web test`, `pnpm --filter web type-check`, `pnpm --filter @batalha/types test`, and the Firestore rules test against the running emulator.
  - replaced the hardcoded `Destaques Diários` promo banner with admin-managed `platformSettings/homepage` fields. The public homepage now renders the banner only when `dailyHighlightBannerEnabled` is true and the configured end date has not passed; the banner has no icon. Added `/configuracoes` in the admin app for editing the banner text/end date, added shared `HomepageSettings` typing, and protected the settings document with public reads plus admin-only validated writes in Firestore rules. Verified with focused web/admin tests, web/admin/types type-checks, and Firestore rules coverage against the running emulator.
  - deployed the admin app as a separate Firebase App Hosting backend instead of mounting it under `assobiador.com`. Production admin backend is `assobiador-admin` in `us-east4`, available at `https://assobiador-admin--assobiadores-3f0f6.us-east4.hosted.app`. Updated `firebase.apphosting.json`, CI/CD, and docs so public (`assobiador-web`) and admin (`assobiador-admin`) deploy as separate backends. Deployed both backends from local source and seeded production `platformSettings/homepage` with the `R$5` daily highlights banner.
  - updated public web UI branding copy from `A casa do assobiador`/`Assobiador` to `Absolute Assobio` for page metadata, logo alt text, and the footer brand label only. Admin, legal, payment descriptions, domain-oriented `assobiador.com` copy, copyright text, rank names, user labels, and business logic were intentionally left unchanged.
  - replaced the public web logo/favicon assets with the provided Absolute Assobio image, formatted as `logo.png` 1024x1024, `favicon.png`/`favicon.ico` 64x64, and `logo-full.png` 1536x1024. Admin assets were intentionally left unchanged.
  - refreshed the admin client toward a more operational ERP layout: desktop sidebar navigation, compact mobile admin nav, Absolute Assobio admin metadata, and a live dashboard with `Usuários`, weekly `Novos Usuários`, `Inscrições Pagas`, and confirmed revenue metric cards. `Inscrições Pagas` counts approved payment records so pending Pix attempts are not treated as paid access.
  - updated the admin app logo/favicon assets to use the same Absolute Assobio icon set as the public app: `logo.png` 1024x1024, `favicon.png`/`favicon.ico` 64x64, `logo-full.png` 1536x1024, and source `absoluteAssobioLogo.png`.
  - added sortable admin table headers for `Usuários`, `Pagamentos`, and `Batalhas`; clicking a column header sorts by that field and clicking it again toggles ascending/descending order.
  - stabilized the desktop admin sidebar so it stays fixed to the viewport while the main page scrolls; the sidebar header/footer keep their position and only the nav area can scroll if it ever overflows.
  - added an admin-only user profile correction flow: admins can open users from the `Usuários` table in a modal and correct username, first name, surname, display name, and bio through a trusted web API. The API enforces admin role server-side, preserves username reservations, and does not expose edits for roles, points, payments, CPF, Pix, or ranking fields.
  - adjusted the admin battle form schedule inputs so date/time fields stay in a two-column layout instead of being squeezed into one five-column desktop row.
  - refined admin `datetime-local` inputs so the native calendar picker indicator renders white, remains at the end of the field, and has enough right-side spacing.
  - fixed production admin API base URL handling: admin App Hosting now sets `NEXT_PUBLIC_WEB_APP_URL=https://assobiador.com`, and admin client calls use a shared `getWebApiBaseUrl()` helper that does not fall back to `localhost` in production. Deployed the `assobiador-admin` backend hotfix and verified the production admin URL plus the production web admin-user API CORS preflight.
  - moved the public web app logo/favicon references off generic `/logo.png` and `/favicon.png` paths to versioned Absolute Assobio asset names (`/absolute-assobio-icon-v2.png`, `/absolute-assobio-favicon-v2.png`) to avoid stale CDN/browser cache showing the previous logo after refreshes.
  - archived and removed the production battles `Batalha Suprema`, `Grupo Elite WhatsApp`, and `Desafio Mauricião` from the live `battles` collection under archive run `archive-battles-2026-05-14`. Their related entries/submissions were copied to archive collections before deletion. Verified `Os Fundadores do Assobio` remains live as the only requested battle from that set.
  - added server-side audio playback normalization for new public uploads: WebM/Ogg recordings are saved as originals and transcoded with FFmpeg into AAC/M4A playback copies, while already mobile-safe MP4/AAC uploads reuse the original. Daily highlights, battle submissions, and qualifier submissions now store `mediaURL` as the playback asset plus `mediaOriginal*` audit fields for the untouched recording. Backfilled 19 existing production daily highlights so `mediaContentType` now points to MP4 playback copies while original WebM/Opus files remain referenced in `mediaOriginal*`. Verified focused service/API tests, type-checks, production build, a real local FFmpeg transcode, and production post-backfill counts.
  - replaced the admin dashboard's old `Áreas de operação` section with a referral analytics panel and compact bar charts. Added a protected web API route at `/api/admin/analytics/referrals` that verifies Firebase admin role, combines Firestore attributed users with optional GA4 Data API `partner_referral_captured` metrics, and falls back to Firestore-only attribution until `GA_PROPERTY_ID`, `GA_CLIENT_EMAIL`, and `GA_PRIVATE_KEY` are configured. Verified focused web/admin tests, web/admin type-checks, and both production builds.
  - narrowed referral reporting to only `AbsoluteAssobio` plus an `organic` bucket. The dashboard now treats users without the approved ref as organic, and the web App Hosting config declares server-side GA4 Data API env/secret hooks (`GA_PROPERTY_ID`, `GA_CLIENT_EMAIL`, `GA_PRIVATE_KEY`) in addition to the existing public `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
  - configured production Secret Manager values for the GA4 admin analytics reader, granted the `assobiador-web` App Hosting backend access to `GA_PROPERTY_ID`, `GA_CLIENT_EMAIL`, and `GA_PRIVATE_KEY`, and enabled the Google Analytics Data API for project `assobiadores-3f0f6`. A live Data API read against property `535113543` now succeeds with the service account, and the web App Hosting rollout completed after the secret IAM fix. Deployed the admin App Hosting backend as well so the dashboard UI can call the updated web analytics API. Remaining GA setup: register the event-scoped `partner_ref` custom dimension in GA4 before the dashboard can group visitors by referral code.
  - fixed the production admin analytics 500 caused by GA4 rejecting `customEvent:partner_ref` before the custom dimension exists. The web analytics API now loads GA total visitors separately and falls back to Firestore attribution for referral rows with a setup warning instead of throwing. Verified focused route/service tests, web type-check, web production build, and deployed the web App Hosting hotfix.
  - removed the visible GA4 custom-dimension setup warning from admin analytics and added a quiet single-ref fallback: while `partner_ref` is unavailable as a GA4 custom dimension, the API counts `partner_referral_captured` events without grouping and attributes them to `AbsoluteAssobio` because it is the only allowed ref. The organic row remains the no-ref bucket (`total visitors - ref visitors`). Verified focused tests, web type-check, web production build, and deployed the web App Hosting update.

Security/test work to do before expanding features:

- Add integration coverage for real Mercado Pago sandbox payload shapes once credentials/webhook URL are available.
- Manual QA for partner referrals after deploy: open a clean browser/session at `/?ref=AbsoluteAssobio`, navigate around before creating/logging into an account, then confirm the user document keeps the same partner fields and GA4 receives the referral/auth events. Also check `/?ref=random` does not save referral fields and only emits the rejected-ref analytics event.
- Optional: consolidate web/functions rank constants into one built shared domain package once package build/runtime strategy is upgraded.
- Remaining standalone battle scoring gap: eligible community battle wins now have basic anti-farming controls, but broader browser QA and abuse-monitoring thresholds are still needed before relying on community scoring in production.
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
- Component/UI tests for submission form, voting page reports, moderation reports/removal, public battle creation form, and admin battle management page.
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
- [ ] Deploy Firestore security rules/indexes through CI/CD
- [ ] Enable Firebase Storage in Firebase Console, then set `FIREBASE_DEPLOY_STORAGE_RULES=true` for CI/CD Storage rules deploy
- [x] Deploy Cloud Functions cleanly: all production functions are deployed as active `v2` functions on Node.js 22
- [x] Set up Firebase App Hosting backend for `apps/web` (`assobiador-web`, `us-east4`)

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
