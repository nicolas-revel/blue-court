# Phases du tournoi

Un tournoi est une **suite de phases**. Chaque phase a son format, ses règles de match (voir [regles-match.md](regles-match.md)) et une règle de qualification vers la suivante (par exemple les 2 premiers de chaque poule, ou les 4 meilleurs 3es).

| Format de phase | Principe | Matchs par équipe |
| --- | --- | --- |
| Poules | Chacun rencontre tout le monde dans sa poule | Taille de poule moins 1 |
| Poules de niveau | Nouvelles poules formées à partir du classement précédent | Taille de poule moins 1 |
| Élimination directe | Le perdant sort, consolante optionnelle | Variable |
| Double élimination | Winner et loser bracket, on sort après 2 défaites | 2 minimum |
| Classement intégral | Gagnant d'un côté, perdant de l'autre ; chaque équipe finit avec une place unique | log2(N), soit 4 pour 16 équipes |

Exemple type du club : poules le matin, puis poules de niveau ou classement intégral l'après-midi.

## Règles transverses

- Quand le nombre d'équipes n'est pas une puissance de 2, l'application propose des exempts.
- L'organisateur peut corriger à la main toute poule ou tout tableau généré ; les phases suivantes se recalculent.
