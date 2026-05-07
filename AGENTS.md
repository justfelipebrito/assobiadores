# Project Instructions

## Testing Requirement

Every feature must include solid automated tests before it is considered complete.

- Add or update tests in the same change set as the feature or bug fix.
- Cover the behavior, authorization boundaries, validation failures, and relevant edge cases.
- For backend or security-sensitive work, include negative tests that prove unauthorized clients cannot perform protected actions.
- If a feature cannot be tested immediately because the test harness is missing, add the harness first or explicitly mark the feature incomplete in `SESSION-SUMMARY.md`.
- Do not rely on `type-check` and `build` as substitutes for behavioral tests.

## Security Requirement

Do not trust client-side checks for protected workflows.

- Enforce authorization and state transitions server-side through API routes, Cloud Functions, or Firestore rules.
- Keep Firestore rules strict for client-writable collections: validate ownership, allowed fields, immutable fields, status/phase constraints, and numeric bounds.
- Payment, points, ranks, prizes, roles, and moderation decisions must never be client-writable.

## Documentation Requirement

After every meaningful code or architecture change, update `SESSION-SUMMARY.md` with what changed, what remains, and any newly discovered risks.

## Data Model: Battle vs Championship

Do not collapse standalone battles and structured official competitions into one model.

- `Battle` is a standalone one-off contest (community or simple official). It has a single-phase lifecycle and is the model used for all current MVP flows.
- `Championship` is a structured official competition with stages (group/knockout), matches, league scope (national/regional), and season membership. It is a separate Firestore collection hierarchy: `championships/{id}/stages/{stageId}/matches/{matchId}`.
- Standalone Battles, Daily Highlights, Qualifiers, and Championship results may feed the unified season/category ranking when they have a documented scoring rule and are finalized by trusted server code.
- A `Season` document scopes rankings in time so mid-tier users have a realistic path each season.
- Official competition categories are globally limited to Freestyle, Melodia, and Pássaros. Do not add extra official categories without an explicit product decision.
- The official public ranking is a unified season total across all categories. Use trusted server writes to the `seasonRankings/{seasonId}/users/{userId}` read model for leaderboard display, backed by append-only `pointActivities` ledger entries.
- Keep category-level scoring as breakdown/audit data only (`seasonCategoryPoints` and `pointActivities.category`), not as the main public ranking split.
- Qualifier Battles (community `Battle` docs) can grant registration slots in a Championship, bridging community participation to official competition.
- When building new features that touch rankings, leaderboards, or official scoring — check whether the feature belongs to the `Battle` layer, the `Championship` layer, or both, before writing code.

## Product Direction

Assobiadores.com is intended to become the official ranking and competition platform for whistle battles in Brazil. Preserve this product direction when designing data models, routes, admin workflows, and ranking logic.

- The admin panel can create both official and community battles.
- Public users on assobiadores.com must also be able to create their own community battles.
- User-created battles can be `1v1` or group battles.
- Group battles created by users are limited to 50 entries unless the creator has a subscription/plan that raises the limit.
- Battle detail pages should be the primary interaction surface: participants and submitted audio are visible on the battle page, public users can join/pay from that page when the battle is open, and voting should happen inline without forcing a separate entries page.
- Public/open battles can show a `Participar` action. Invite-only/private battles should show participants and playable audio but should not show a public join action.
- Paid battle entries use Pix confirmation like qualifiers. On approval, the platform keeps 20% and the remaining 80% is added to the flexible battle prize pool paid to the single winner.
- Battle voting is decided 100% by community votes. The creator vote is stored separately and is used only as the tie-breaker when community votes are tied. Confirmed participants cannot vote in their own battle. Enforce these rules in trusted vote/finalization APIs; UI visibility is only guidance.
- `1v1` battles are exactly two participants, always use open community voting, and tied `1v1` results without a creator tie-break award no season/category points.
- Users must be able to invite competitors by searching and adding exact usernames in an "add to battle" flow.
- Usernames are mandatory and must be unique. Use trusted server checks/reservations before saving username changes.
- Public profile fields live in `users/{uid}`. Sensitive identity/contact/payout fields such as CPF, phone, Chave Pix, and address live in private `userPrivate/{uid}` documents and must not be exposed through public reads.
- Profile photos must be uploaded through the trusted `/api/profile/photo` flow. Do not accept raw photo URLs from profile forms; the server owns `photoURL`, `photoPath`, `photoVersion`, `photoUpdatedAt`, and `photoChangeAvailableAt`.
- Profile photo replacement is limited to once every 14 days. Client uploads should be compressed before sending and displayed with `photoVersion` cache busting.
- CPF, phone, Chave Pix, and CEP validations must exist on both the profile UI and trusted profile update API. UI validation is for guidance only; server validation is authoritative.
- Keep manual address entry lean: collect CEP, city, street, and number. Neighborhood, complement, and address state should not be prominent manual fields; derive/verify them through an address validation provider later.
- Chave Pix is mandatory for profile completion because it is needed for contestant prize payouts. CPF and Naturalidade are immutable once set. Username and address fields can change only after their 14-day cooldown expires. Enforce this in trusted profile APIs, keep cooldown metadata server-owned, and mirror the locked state in the UI.
- Do not show user profile photos on voting screens, submission comparison flows, official ranking lists, or full competition participant lists. This reduces vote bias and avoids turning whistle contests into appearance-driven contests. Homepage ranking previews may show avatars as a compact highlight, but large ranking pages should use names/ranks only.
- Daily highlights, standalone battles, qualifiers, and official championships can all award season points. Casual/community activities should award smaller points; official competition progression should award proportionally larger boosts.
- Season rankings should behave like a formal sports leaderboard, including at least:
  - National League.
  - Regional League by Brazilian state.
- Ranking should include season-based scopes so new and mid-tier users have a realistic "I can get there" path each season.
- Homepage ranking summaries should present the active season, not generic all-time language.
- Community users should have a pathway into official competitions through qualifiers.
- Qualifiers bridge community participation into official competition slots and grant larger season point boosts for entry, phase advancement, and qualification.
- Official competition participation requires the official entry payment/subscription rules defined for that event. Open Qualifiers currently have a concrete entry-fee rule; broader subscription enforcement details are still pending product design.
- Open Qualifiers are random 1v1 official entry paths into Regional competitions. The current product rule is `R$ 4,00` per qualifier entry, 20% platform fee, and 80% allocated to the Regional category prize pool.
- Logged-in users who are not registered for the active Open Qualifiers should see a persistent qualifier notice with CTA to `/classificatorias` until they have a `pending_payment` or `confirmed` qualifier registration.
- Regional category prize pools pay 50% to 1st place, 30% to 2nd place, and 20% to 3rd place.
- Official async matches use Brazil-time deadlines: submissions close at 13:00, voting runs 13:00-23:59, one missed submission loses by W.O., and two missed submissions disqualify both contestants.
- Regional competitions should support flexible brackets per state/category: minimum 16, preferred/full 64, accepted sizes 16/32/64. Regional-to-National qualification is top 10 for 64, top 6 for 32, and top 4 for 16.
- Competitions need exactly three category tracks: Freestyle, Melodia, and Pássaros. Championship/qualifier/battle entries remain category-scoped, but the main public ranking is unified across categories.
- `Destaques Diários` is a separate daily highlights feature, not a Battle/Championship reuse. Submitting a daily highlight and finishing in the daily top 3 award low-weight season/category points through trusted server code.
- Battles and `Destaques Diários` must use on-platform recorded audio only: maximum 2 minutes, uploaded through trusted APIs to Firebase Storage, with media metadata stored on the entity. Do not add YouTube/external URL submission paths for these product flows.
- Official battles/championships need richer schedule and bracket modeling than a simple battle:
  - event dates and times surfaced in headers and detail pages;
  - competitor information in the header/details;
  - group stages;
  - knockout phases such as round of 32, round of 16, round of 8, quarter-finals, semi-finals, finals.
- Do not collapse official competitions, community battles, and casual user-created battles into one simplistic model if that would block these requirements.
