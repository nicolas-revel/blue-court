---
name: creer-spec
description: Rédiger ou faire évoluer une spec fonctionnelle de Blue Court dans docs/specs, puis la découper en issues. À utiliser pour toute nouvelle fonctionnalité ou tout changement de comportement avant le code.
---

# Créer une spec

## Déroulé

1. **Comprendre la demande** et identifier le ou les fichiers de `docs/specs/` concernés.
2. **Explorer l'existant** : specs voisines, code du moteur, issues ouvertes. Une spec ne doit pas contredire ni dupliquer une autre.
3. **Griller l'humain** avec le skill `grill` jusqu'à ce que le comportement soit sans ambiguïté.
4. **Écrire la spec** dans `docs/specs/<sujet>.md` (créer le fichier ou compléter l'existant, et le référencer dans `docs/specs/README.md`) avec ce plan :

   ```markdown
   # <Sujet>

   <Une ou deux phrases : ce que l'organisateur ou le joueur peut faire.>

   ## Comportement
   ## Réglages (paramètres et valeurs par défaut FFVB)
   ## Cas limites
   ## Exemples (tournois concrets, avec les chiffres)
   ## Hors périmètre
   ```

   Décrire le comportement, jamais l'implémentation. Chaque réglage a une valeur par défaut.
5. **Faire valider la spec** par l'humain dans une PR dédiée ou dans la PR de la fonctionnalité.
6. **Découper en issues** verticales : chaque issue livre un comportement testable de bout en bout, avec ses critères d'acceptation et le lien vers la section de spec. Proposer le découpage à l'humain avant de créer les issues.
