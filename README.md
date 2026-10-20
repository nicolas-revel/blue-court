# Blue Court

Blue Court est un gestionnaire de tournois de volley où tout se règle : taille des équipes, inscriptions solo ou en équipe, enchaînement de phases (poules, poules de niveau, élimination directe, double élimination, classement intégral), règles de match par phase, planning des terrains, saisie des scores et vue mobile en direct pour les joueurs.

Projet en cours de construction. Les spécifications sont dans [docs/specs](docs/specs/README.md) et l'avancement dans le [journal de bord](docs/journal).

## Méthode

Le projet est développé avec Claude Code, de façon visible :

- `CLAUDE.md` décrit les conventions et le domaine pour l'agent ;
- chaque fonctionnalité part d'une issue reliée aux specs et passe par une PR revue ;
- la CI (build, typecheck, tests) bloque toute régression ;
- le journal de bord trace ce que l'IA a produit et ce qui a été repris à la main.

## Démarrer

```sh
pnpm install
pnpm test
```

## Licence

[Functional Source License 1.1, ALv2 Future License](LICENSE.md) : le code est lisible, réutilisable et modifiable, sauf pour en faire un service concurrent. Chaque version passe sous licence Apache 2.0 deux ans après sa publication.
