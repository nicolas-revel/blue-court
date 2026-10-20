# Objectif et utilisateurs

Une application web qui monte un tournoi de volley de A à Z, quelles que soient les règles du club, sans retouche à la main derrière. Projet public qui sert aussi de vitrine à une méthode de développement assisté par IA.

## Utilisateurs

- **Organisateur** : crée le tournoi, règle les formats, corrige le tableau à tout moment.
- **Table de marque** : saisit et valide les scores.
- **Joueur ou spectateur** : suit le tournoi sur son téléphone, sans compte.

## Ce qu'on retient de l'outil actuel (Tournoi Plus)

Tournoi Plus est un outil générique pensé pour le foot : il ne connaît ni les sets ni les règles du volley. Constaté sur un tournoi réel (6 équipes, 2 terrains, matchs de 8 minutes, une seule poule) :

| Constat | Ce que fait la v1 |
| --- | --- |
| Classement en « différence de buts », matchs nuls possibles (12:12) | Vocabulaire volley (sets, points), match nul autorisé ou non selon la phase |
| Un seul score par match, pas de sets | Score set par set, ou score unique pour les matchs au temps |
| Une seule poule, pas d'enchaînement de phases | Phases chaînées avec qualification automatique |
| Vue publique en tableau large, peu lisible sur téléphone | Vue mobile d'abord, avec « Mon équipe » |
| Publicités et libellés non traduits | Pas de publicité, tout en français |

À garder : l'affichage salle plein écran pour une TV, l'affiche avec QR code, les cartes d'arbitre imprimables, le filtre des matchs par équipe.
