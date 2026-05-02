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
- Official standalone Battles and Championship results may feed official XP/rankings. Community Battles feed only community stats unless explicitly configured as official qualifiers with a documented scoring rule.
- A `Season` document scopes rankings in time so mid-tier users have a realistic path each season.
- Qualifier Battles (community `Battle` docs) can grant registration slots in a Championship, bridging community participation to official competition.
- When building new features that touch rankings, leaderboards, or official scoring — check whether the feature belongs to the `Battle` layer, the `Championship` layer, or both, before writing code.

## Product Direction

Assobiadores.com is intended to become the official ranking and competition platform for whistle battles in Brazil. Preserve this product direction when designing data models, routes, admin workflows, and ranking logic.

- The admin panel can create both official and community battles.
- Public users on assobiadores.com must also be able to create their own community battles.
- User-created battles can be `1v1` or group battles.
- Group battles created by users are limited to 50 entries unless the creator has a subscription/plan that raises the limit.
- Users must be able to invite competitors by searching and adding exact usernames in an "add to battle" flow.
- Official standalone battles and official championships count toward user XP and official rankings.
- Community battles should not affect official XP/rankings unless a future product rule explicitly says otherwise.
- Official rankings should behave like a formal sports leaderboard, including at least:
  - National League.
  - Regional League by Brazilian state.
- Ranking should include season-based scopes so new and mid-tier users have a realistic "I can get there" path each season.
- Community users should have a pathway into official competitions through qualifiers.
- Qualifiers can bridge community participation into official competition slots, but only official/qualified results should affect official ranking scopes.
- Official battles/championships need richer schedule and bracket modeling than a simple battle:
  - event dates and times surfaced in headers and detail pages;
  - competitor information in the header/details;
  - group stages;
  - knockout phases such as round of 32, round of 16, round of 8, quarter-finals, semi-finals, finals.
- Do not collapse official competitions, community battles, and casual user-created battles into one simplistic model if that would block these requirements.
