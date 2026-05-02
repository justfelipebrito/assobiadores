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

## Official Ranking Scope

Official battles count toward official XP and rankings.

Community and casual user-created battles should not affect official XP/rankings unless a future product decision explicitly changes that.

Official ranking should support:

- National League
- Regional League by Brazilian state
- Season rankings with fresh starts, archives, and champions

User profile records include `state`, `city`, `country`, and `officialProfile` metadata so regional leagues and official eligibility can be modeled separately from casual profile data.

Season rankings should be first-class. They give new and mid-tier users a credible path to compete for the top each season without needing to catch up to all-time career leaders immediately.

## Qualifiers

Community participation should be able to lead into official competition through qualifiers.

Qualifiers should:

- provide a bridge from community activity into official slots;
- have clear eligibility rules;
- make qualification visible on user profiles and competition pages;
- preserve official ranking integrity by separating community/casual activity from official ranking points unless the event is explicitly an official qualifier.

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

## Architecture Implications

Future schema work likely needs concepts beyond `Battle`:

- competition/championship;
- stage;
- round;
- match;
- bracket seed;
- competitor invite;
- creator subscription/limits;
- ranking scope;
- region/state;
- official result.

Do not let Phase 5 submissions/voting assume every battle is a standalone official XP event.
