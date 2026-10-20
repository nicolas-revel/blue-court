# Méthode : développer Blue Court avec l'IA

Blue Court est développé avec Claude Code. Ce dépôt montre la méthode autant que le produit : tout ce qui guide l'agent est versionné ici.

## La boucle de travail

1. **Specs** (`docs/specs/`) : le comportement voulu, rédigé avec l'humain avant le code.
2. **Issue** : une fonctionnalité, ses critères d'acceptation, le lien vers les specs.
3. **Agent** : Claude Code traite l'issue avec le skill `implementer-issue` : tests d'abord, code minimal, vérifications.
4. **Garde-fous automatiques** : formatage à chaque modification (hook), CI (lint, build, typecheck, tests), revue de PR par Claude.
5. **Revue humaine** : l'humain relit, tranche, fusionne.
6. **Journal** (`docs/journal/`) : ce que l'IA a fait, ce qui a été repris à la main, ce qui a coincé.

## Le harness

| Élément | Rôle |
| --- | --- |
| `CLAUDE.md` | Conventions, commandes et vocabulaire du domaine, lus par l'agent à chaque session |
| `.claude/skills/implementer-issue` | Le déroulé complet d'une issue jusqu'à la PR |
| `.claude/skills/moteur-tests` | Règles du moteur pur et tests par propriété |
| `.claude/skills/specs-et-journal` | Tenir les specs et le journal à jour |
| `.claude/skills/revue-pr` | La grille de revue, utilisée par l'agent et par la CI |
| `.claude/settings.json` | Permissions de l'agent et hooks (formatage, installation en session cloud) |
| `.github/workflows/ci.yml` | Lint, build, typecheck, tests sur chaque PR |
| `.github/workflows/claude-review.yml` | Revue automatique de chaque PR par Claude |
| `.github/pull_request_template.md` | Rappelle specs, journal et vérifications |

## Pourquoi des tests par propriété

Un moteur de tournoi a beaucoup d'invariantes (chaque paire se rencontre une fois, chaque équipe a une place unique...). Un test par propriété vérifie l'invariante sur des centaines de cas générés : c'est le meilleur filet pour du code produit par un agent, qui peut passer les exemples écrits à la main et rater un cas limite.
