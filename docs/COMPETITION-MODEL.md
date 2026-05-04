# Competition Model Direction

This project should support three related but distinct concepts:

1. Official competitions
2. Community battles
3. User-created casual battles

The current `battles` collection is enough for the early MVP, but future work should avoid overfitting everything into a simple one-off battle shape.

## Battle Ownership

- Admins can create official battles.
- Admins can create community battles.
- Public users can create community/casual battles from assobiadores.com.

## Battle Formats

User-created battles must support:

- `1v1`
- Group battles

Free/non-subscribed creators are limited to 50 entries for group battles. Subscription/plan logic can raise this limit later.

## Invitations

Users must be able to add competitors by searching usernames and selecting exact matches.

The system should avoid ambiguous username matching when inviting users.

User profile records include `username` and `usernameLower` so invite/search flows can query exact normalized usernames.

## Unified Season Ranking Scope

Assobiador rankings should use one unified season/category points model. Daily highlights, standalone battles, qualifiers, Regionals, and Nationals can all award points into the same season leaderboard when the result is eligible and written by trusted server code.

This keeps casual users able to appear in rankings while still giving official competition winners a large proportional lead.

Season ranking should support:

- National League
- Regional League by Brazilian state
- Season rankings with fresh starts, archives, and champions
- Category-scoped rankings for the global categories: Freestyle, Melodia, and Pássaros

Homepage ranking summaries should use active-season language, such as `Temporada 2026`, rather than generic all-time ranking copy.

User profile records include `state`, `city`, `country`, and `officialProfile` metadata so regional leagues and official eligibility can be modeled separately from casual profile data.

Season rankings should be first-class. They give new and mid-tier users a credible path to compete for the top each season without needing to catch up to all-time career leaders immediately.

### Season Points Model

All point writes must be server-owned. Clients may request actions, but points, rank, XP, official metadata, and prize-affecting results must be calculated through API routes, Cloud Functions, or other trusted server code.

Initial 2026 scoring table:

| Activity                     | Points |
| ---------------------------- | -----: |
| Daily highlight submission   |      1 |
| Daily highlight 3rd place    |      5 |
| Daily highlight 2nd place    |     10 |
| Daily highlight 1st place    |     15 |
| 1v1 battle win               |     10 |
| Group battle win             |     20 |
| Open Qualifier entry         |     50 |
| Open Qualifier phase advance |    200 |
| Qualify for Regional         |    500 |
| Regional phase advance       |  1,000 |
| Regional 3rd place           |  4,000 |
| Regional 2nd place           |  6,000 |
| Regional champion            | 10,000 |
| Qualify for National         |  3,000 |
| National phase advance       |  5,000 |
| National 3rd place           | 15,000 |
| National 2nd place           | 25,000 |
| National champion            | 40,000 |

Ranking points should be category-scoped whenever the source event has a category. Daily highlights and battles should award points to the submitted/battle category. Overall season totals can be derived as a sum across categories, but category leaderboards remain the product source of truth for official competition context.

Community battle scoring needs abuse controls before release because user-created events can be farmed. At minimum, points should only be awarded after trusted finalization, confirmed participants, valid submissions, and completed voting. Additional per-user/day or per-opponent caps can be added if battle farming becomes visible.

## Qualifiers

Community participation should be able to lead into official competition through qualifiers.

Qualifiers should:

- provide a bridge from community activity into official slots;
- have clear eligibility rules;
- require the official entry payment/subscription rules defined for that event;
- make qualification visible on user profiles and competition pages;
- preserve ranking integrity by awarding points only from trusted finalization and documented scoring rules.

Open Qualifiers are official entry pathways into Regional competitions:

- qualifier entry fee: `R$ 4,00` per contestant per category;
- platform fee: 20% of each qualifier entry;
- prize allocation: 80% of each qualifier entry goes into the prize pool for that Regional category;
- match format: random `1v1` pairings for each phase;
- advancement: winners advance to the next qualifier phase until Regional slots are filled;
- non-submission: if one contestant misses the submission deadline, the opponent wins by W.O.; if both miss it, both are disqualified.

Qualifier voting is fully public: `100%` public vote.

When Open Qualifiers are available, logged-in users who are not registered should see a persistent qualifier notice with a CTA to `/classificatorias`. The notice should remain visible until the user has a `pending_payment` or `confirmed` qualifier registration for the active season.

### Qualifier data model

The qualifier layer is separate from standalone Battles and from Championship stages. It is the official entry funnel into Regional championships.

Current collections:

- `qualifierTracks/{trackId}`: public discovery/read model for one season, state, and category. It stores the shareable `slug` (for example, `sp-freestyle-2026`), status, fee, registration/bracket dates, Regional qualification slots (`maxQualified`), and aggregate registration counts (`registeredCount`, `confirmedCount`, `pendingPaymentCount`) so listing/detail pages can show social proof without scanning private registrations. `maxQualified` is not a registration cap; Classificatórias are open to as many paid entrants as the platform can support.
- `qualifierRegistrations/{registrationId}`: private-to-user registration/payment state for one user, season, state, and category. It stores `status` (`pending_payment`, `confirmed`, `cancelled`), `bracketStatus` (`registered`, `waiting_draw`, `active`, `eliminated`, `qualified`), current round/match references, payment metadata, and the eventual Regional championship ID when qualified.
- `qualifierParticipants/{registrationId}`: public read/server-owned participant projection written when a qualifier payment is confirmed. It stores only public display data needed by public track pages: user ID, display name, state/category/season, current category rank/points snapshot, and confirmation timestamps. It must not expose payment IDs or private registration metadata.
- `qualifierMatches/{matchId}`: public read model for random `1v1` qualifier pairings. It stores season, state, category, round, participants, registration IDs, official deadlines, submission IDs, public vote counts, winner/W.O./disqualification state, and next-match linkage.

Security rule: qualifier registrations are readable only by their owner or admins. Qualifier tracks, participants, and matches are public-readable because they are official discovery/fixture/result data, but all writes are server/admin-owned.

Participant UX:

- Homepage shows a left-column `Classificatórias` section, matching Campeonatos/Batalhas placement so the ranking rail stays visible. Logged-in users see the three category tracks for their immutable `Naturalidade`; logged-out users see São Paulo and Rio de Janeiro as default public previews. Homepage cards should not show entrant counts or `64` as “vagas”; that context belongs on `/classificatorias`.
- `/classificatorias` is the full entry/payment page. It keeps `Suas Classificatórias` first, lists available tracks by category/state, shows full-width rules, and shows the full-width `Inscrição` payment section.
- `/classificatorias/{state-category-year}` is the public/shareable track page for discovery, social proof, rules, confirmed participant list ordered by confirmation date, and future public fixture/results browsing.
- `/classificatorias/{registrationId}` remains the private participant journey page for one paid registration, including status, deadlines, and generated matches.
- Match submission/voting pages are still pending. When implemented, they should use `qualifierMatches` deadlines as the source of truth and write through trusted server routes.

## Championships

Official battles/championships need sports-style scheduling and structure:

- visible event dates and times in headers/detail pages;
- visible competitors in headers/detail pages;
- group stages;
- knockout phases:
  - round of 32;
  - round of 16;
  - round of 8;
  - quarter-finals;
  - semi-finals;
  - finals.

Official competitions use exactly three global category tracks:

- Freestyle
- Melodia
- Pássaros

Each official season should create championship shells for all category tracks:

- 3 National championships, one per category
- 81 Regional championships, one per Brazilian state per category
- 84 official championship shells per season total

Official season rankings are category-scoped through trusted server writes to `seasonCategoryPoints`.

### 2026 Official Season

The 2026 official season starts from the current planning date, May 3, 2026.

Recommended schedule:

- Open Qualifier registration: May 4, 2026 - May 31, 2026
- Open Qualifier battles: June 1, 2026 - July 12, 2026
- Regional roster lock: July 13, 2026
- Regional competitions: July 20, 2026 - September 27, 2026
- National roster lock: September 28, 2026
- National competition: October 5, 2026 - December 13, 2026

Official async match deadlines should use Brazil time (BRT):

- recording submission closes at 14:59 on the scheduled match date;
- voting starts at 15:00 and closes at 21:59 on the scheduled match date;
- Open Qualifiers use 100% public voting;
- Regional and National matches use 70% judges and 30% public voting.

Regional competitions should use flexible brackets per state/category:

- minimum: 16 contestants;
- preferred/full: 64 contestants;
- accepted bracket sizes: 16, 32, or 64;
- if fewer than 16 eligible qualifiers exist for a state/category, postpone that Regional track or keep a waiting list;
- if more than 64 qualify, select the top 64 using qualifier results and documented tie-breakers.

Regional-to-National qualification:

- 64-contestant Regional: top 10 qualify for the National category competition;
- 32-contestant Regional: top 6 qualify;
- 16-contestant Regional: top 4 qualify;
- for a 64 bracket, the top 8 are quarter-finalists and spots 9-10 are the two best Round of 16 eliminations by weighted score.

Regional tie-breakers should be:

1. higher judge score;
2. higher public vote percentage;
3. higher total public votes;
4. earlier submission time;
5. admin/judge review if still tied.

Regional prize pools are flexible and category-scoped. For each Regional category, the total prize pool is based on the qualifier entry payments collected for that state/category:

- gross pool = number of paid qualifier entries x `R$ 4,00`;
- platform keeps 20%;
- distributable prize pool = 80% of gross pool.

Regional prize distribution from the distributable prize pool:

- 1st place: 50%;
- 2nd place: 30%;
- 3rd place: 20%.

## Daily Highlights

`Destaques Diários` is a casual daily feature and should not reuse the `Battle` or `Championship` entity as its primary model.

Daily highlights:

- store user-submitted audio entries in a separate daily highlights collection;
- award 1 season/category point for submission;
- award low-weight season/category placement points for the daily top 3;
- support public likes/votes through a confirmation flow;
- can later feed profile-level retention features such as streaks.

## Architecture Implications

Future schema work likely needs concepts beyond `Battle`:

- competition/championship;
- stage;
- round;
- match;
- bracket seed;
- competitor invite;
- creator subscription/limits;
- competition category;
- daily highlight entry;
- season points ledger;
- ranking scope;
- region/state;
- official result.

Do not let Phase 5 submissions/voting assume every battle is a standalone official-only XP event. Scoring must follow the unified season/category points table and trusted finalization rules for the source event.
