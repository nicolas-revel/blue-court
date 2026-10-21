# Overview

A web app that runs a volleyball tournament end to end, whatever the club's rules, with no manual fixing afterwards. It is a public project that also showcases an AI-assisted development method.

## Users

- **Organizer**: creates the tournament, configures the formats, can correct the draw at any time.
- **Scoring table** (*table de marque*): enters and validates scores.
- **Player or spectator**: follows the tournament on their phone, without an account.

## Lessons from the current tool (Tournoi Plus)

Tournoi Plus is a generic tool built for football: it has no notion of sets or volleyball rules. Observed on a real tournament (6 teams, 2 courts, 8-minute matches, a single pool):

| Observation | What v1 does |
| --- | --- |
| Ranking by "goal difference", draws allowed (12:12) | Volleyball vocabulary (sets, points), draws allowed or not per phase |
| A single score per match, no sets | Set-by-set score, or a single score for timed matches |
| A single pool, no phase sequencing | Chained phases with automatic qualification |
| Public view is a wide table, hard to read on a phone | Mobile-first view, with "My team" |
| Ads and untranslated labels | No ads, fully localized |

Worth keeping: the full-screen venue display for a TV, the QR code poster, printable referee cards, filtering matches by team.
