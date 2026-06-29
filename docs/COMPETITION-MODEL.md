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

Battle detail pages are the primary battle surface. A user opening `/batalhas/{battleId}` should immediately see the participants, whether each participant has submitted audio, and any playable submitted audio. Public/open battles can show an inline `Participar` action while registration is open. Paid battles show `Pagar entrada` and use the same Pix confirmation modal pattern as qualifiers. Invite-only battles should show the participant/media state without a public join action.

`1v1` battles are exactly two participants, always use open community voting, and tied `1v1` results without a creator tie-break award no season/category points.

Battle votes are community-first:

- community votes decide the result with 100% weight;
- the creator vote is stored separately and is used only as a tie-breaker when community votes are tied.

Confirmed participants cannot vote in their own battle. The trusted vote API records the creator vote as the tie-break signal and all other eligible non-participant votes as community votes. Finalization ranks submissions by community vote count first and only consults the creator signal when the top community score is tied.

Paid battle prize pools are flexible and based on confirmed paid entries. On each approved entry payment, the platform keeps 20% and 80% goes into the battle prize pool. Battles have a single winner, so the winner receives the available battle prize pool.

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

The official public ranking is a unified season leaderboard. Points from Freestyle, Melodia, and
Pássaros all contribute to the same season total, so `10` points in Melodia plus `10` points in
Pássaros displays as `20` ranking points.

Category remains important as context and audit data:

- every points event in `pointActivities` stores the source category when applicable;
- `users/{uid}.seasonCategoryPoints` can keep category breakdowns for profile/history views;
- official competitions, qualifiers, and battles are still category-scoped for participation rules.

The public leaderboard should read from the denormalized `seasonRankings/{seasonId}/users/{userId}`
aggregate. That aggregate is maintained only by trusted server code and can be rebuilt from
`pointActivities` if scoring logic ever needs correction.

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
- bracket generation allows byes when the entrant count is odd or when byes are needed to reduce the field cleanly toward 64 Regional qualifiers;
- advancement: winners advance to the next qualifier phase until Regional slots are filled;
- non-submission: if one contestant misses the submission deadline, the opponent wins by W.O.; if both miss it, both are disqualified.

Qualifier voting is fully public: `100%` public vote.

Qualifier participants cannot vote in their own qualifier track. Logged-in non-participants can vote publicly. If a public vote result is tied, the first judge vote recorded for that match is the tiebreaker.

Qualifier scheduling should avoid overwhelming one-day parallel rounds. The initial daily match limit is track-size based:

| Confirmed participants | Daily match limit per state/category track |
| ---------------------: | -----------------------------------------: |
|                  1-100 |                                          5 |
|                101-500 |                                         12 |
|                   501+ |                                         24 |

The system plans each round sequentially. For example, with one match day window per day, 100 entrants need 36 matches over 8 days, 500 entrants need 436 matches over 38 days, and 1000 entrants need 936 matches over 41 days to reach up to 64 Regional qualifiers.

When Open Qualifiers are available, logged-in users who are not registered should see a persistent qualifier notice with a CTA to `/classificatorias`. The notice should remain visible until the user has a `pending_payment` or `confirmed` qualifier registration for the active season.

### Qualifier data model

The qualifier layer is separate from standalone Battles and from Championship stages. It is the official entry funnel into Regional championships.

Current collections:

- `qualifierTracks/{trackId}`: public discovery/read model for one season, scope, and category. State qualifiers use `scope: regional` plus a state `region`; Mini Classificatórias use `scope: national`, `region: null`, and an `eventId`. It stores the shareable `slug` (for example, `sp-freestyle-2026` or `mini-freestyle-2026`), status, fee, registration/bracket dates, qualification slots (`maxQualified`), daily scheduling metadata (`dailyMatchLimit`, `plannedMatchDays`, `plannedMatchCount`, `currentRound`), and aggregate registration counts (`registeredCount`, `confirmedCount`, `pendingPaymentCount`) so listing/detail pages can show social proof without scanning private registrations. `maxQualified` is not a registration cap; Classificatórias are open to as many paid entrants as the platform can support.
- `qualifierRegistrations/{registrationId}`: private-to-user registration/payment state for one user, season, scope, and category. State qualifiers store the entrant's state `region`; national mini registrations store `region: null`, `originalRegion`, `eventId`, and `format: mini_knockout`. It stores `status` (`pending_payment`, `confirmed`, `cancelled`, `migrated_to_mini`), `bracketStatus` (`registered`, `waiting_draw`, `active`, `eliminated`, `qualified`), current round/match references, payment metadata, and the eventual championship ID when qualified.
- `qualifierParticipants/{registrationId}`: public read/server-owned participant projection written when a qualifier payment is confirmed or migrated into a mini event. It stores only public display data needed by public track pages: user ID, display name, scope/state/category/season, current category rank/points snapshot, and confirmation timestamps. It must not expose payment IDs or private registration metadata.
- `qualifierMatches/{matchId}`: public read model for random `1v1` qualifier pairings. It stores season, scope, optional state region, category, round, match day index, sequence within the day, participants, registration IDs, official deadlines, submission IDs, public vote counts, winner/W.O./disqualification state, and next-match linkage.
- `qualifierSubmissions/{submissionId}`: public read/server-owned audio submission for one qualifier match participant. It stores match/registration/user references, season/scope/optional state/category/round, audio media metadata, and submission status. Creation must go through the trusted match submission API, which validates participant ownership, `submissions_open` status, the match submission deadline, audio limits, and duplicate submissions before attaching the submission ID to `qualifierMatches/{matchId}.submissionIds`.
- `qualifierVotes/{voteId}`: private-to-voter/server-owned vote record for one qualifier match. It stores the match, submission, voted user, voter, voter type, and weight. The vote API blocks qualifier participants from voting in any match of their qualifier, enforces one vote per logged-in user per match, and updates public aggregate counts on `qualifierSubmissions` and `qualifierMatches`.

Security rule: qualifier registrations are readable only by their owner or admins. Qualifier tracks, participants, matches, and submissions are public-readable because they are official discovery/fixture/result data, but all writes are server/admin-owned. Qualifier votes are readable only by the voter or admins and are never client-writable.

Participant UX:

- Homepage hero promotes only the national Freestyle Mini Classificatória plus available battles, capped at three total hero items. The lower `Classificatórias` section can still show normal state qualifier discovery, matching Campeonatos/Batalhas placement so the ranking rail stays visible. Homepage cards should not show entrant counts or `64` as “vagas”; that context belongs on `/classificatorias`.
- `/classificatorias` is the full entry/payment page. It keeps `Suas Classificatórias` first, lists available tracks by category/state, shows full-width rules, and shows the full-width `Inscrição` payment section.
- `/classificatorias/{state-category-year}` is the public/shareable track page for discovery, social proof, rules, confirmed participant list ordered by confirmation date, and future public fixture/results browsing.
- `/classificatorias/{registrationId}` remains the private participant journey page for one paid registration, including status, deadlines, generated matches, and the match audio submission action while the participant's match is in `submissions_open`.
- Public qualifier track pages show voting controls during `voting` matches. Logged-in non-participants can play submitted audio and vote once per match; participants see the match but cannot vote.
- Qualifier match finalization is trusted/admin-owned. It handles W.O. when one or both participants miss submission, determines winners by public vote count, uses the first judge vote as the tiebreaker when judge votes exist, awards qualifier phase-advance points, and updates winner/loser registration state.
- Qualifier round advancement is trusted/admin-owned. Once every match in the current round is `finished` or `walkover`, the advancement service gathers all `waiting_draw` live registrations, creates the next round if more than 64 entrants remain, carries byes forward, or marks everyone `qualified` once the Regional cut is reached and awards the qualifier-to-Regional points.
- Mini Classificatórias are a separate official qualifier format for low-density last-call events. They remain in the qualifier layer, use `format: mini_knockout`, `scope: national`, `region: null`, are linked by `eventId`, and run as one-winner knockout brackets with the same trusted submission/vote/finalization flow as state qualifiers. They are not attached to the user's birth city, naturalidade, or state. The current Mini Classificatória product decision is Freestyle-only; do not create Mini Melodia or Mini Pássaros tracks without a new product decision.
- When a state qualifier is postponed into a Mini Classificatória, paid state registrations are not deleted. Trusted admin migration marks the original registration as `migrated_to_mini`, creates a confirmed mini registration, issues a server-owned `qualifierTickets/{ticketId}` document for the future state qualifier entry, and postpones the affected state track.
- Qualifier tickets are not a wallet/balance. They represent one future entry right for the same user, state, category, and season context. Future state qualifier registration consumes an `available` ticket server-side and creates a confirmed registration without Pix payment.
- Mini Classificatória prize pools follow the same paid-entry rule: 20% platform fee and 80% prize pool. For the one-winner mini format, the final winner receives the mini prize pool and keeps the same qualifier scoring/qualification rewards applied by trusted advancement code.

Admin UX:

- The admin panel can trigger official qualifier bracket generation per state/category through a trusted admin API.
- Generation uses only `confirmed` registrations for that season/state/category.
- If `confirmedCount <= maxQualified`, all confirmed entrants are marked qualified without creating matches.
- If matches already exist for the track, generation is rejected. Regeneration should be a separate explicit admin override because it can invalidate public fixtures and participant journey state.
- The admin panel can create the Freestyle Mini Classificatória from paid confirmed Freestyle state qualifier entries, then finalize and advance mini rounds by event ID without using fake state brackets.

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

Official season rankings are unified through trusted server writes to `seasonRankings`. Category
breakdowns remain available through `seasonCategoryPoints` and the immutable `pointActivities`
ledger.

## Official 2026 Championship Catalog

The production catalog should contain real championship shell documents before the events start so
users can see the season structure and prepare:

- 3 Nationals: Freestyle, Melodia, and Pássaros.
- 81 Regionals: every Brazilian state across the same three categories.
- Regional registration starts on June 1, 2026.
- National dates are intentionally shown as `A definir` until the final schedule is confirmed.

Use the repeatable upsert seed when the catalog needs to be restored or refreshed:

```bash
GOOGLE_CLOUD_PROJECT=assobiadores-3f0f6 GCLOUD_PROJECT=assobiadores-3f0f6 pnpm seed:official-2026-catalog
```

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
- accept only audio recorded on the platform, up to 2 minutes; external video URLs are not valid submissions;
- award 1 season/category point for submission;
- award low-weight season/category placement points for the daily top 3;
- support public likes/votes through a confirmation flow;
- use the Brazil day key (`America/Sao_Paulo`) as the daily boundary;
- close voting at 22:00 BRT through trusted scheduled code, then finalize the day and award top-3 placement points: 1st = 15, 2nd = 10, 3rd = 5;
- can later feed profile-level retention features such as streaks.

## Battle Media

Standalone battles use the same media rule as daily highlights:

- users record audio directly on the platform;
- each submission is limited to 2 minutes;
- trusted APIs upload the audio to Firebase Storage and write `mediaType: audio`, `mediaURL`, Storage path, content type, duration, and size metadata;
- battle voting/results render the stored audio player, not an external video embed;
- admins moderate by reports/removal, not by approving external video links.

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
