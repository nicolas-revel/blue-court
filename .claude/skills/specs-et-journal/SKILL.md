---
name: specs-et-journal
description: Mettre à jour docs/specs et ajouter une entrée au journal de bord de Blue Court. À utiliser à la fin de chaque issue, ou quand une décision fonctionnelle est prise.
---

# Specs et journal de bord

## Specs (`docs/specs/`)

- Les specs décrivent le comportement voulu, en français, sans détail d'implémentation.
- Si le code s'écarte des specs ou les précise (une règle de départage clarifiée, un cas limite tranché), modifier le fichier concerné **dans la même PR**.
- Une question encore ouverte va dans `hors-perimetre.md`, section « Questions ouvertes ».

## Journal (`docs/journal/AAAA-MM-JJ.md`)

Le journal est public : il montre comment le projet est construit avec l'IA. Une entrée par PR, ajoutée au fichier du jour (le créer s'il n'existe pas) :

```markdown
## <Titre de la PR> (#<numéro de l'issue>)

- **Fait par l'IA** : ce que l'agent a produit (code, tests, specs).
- **Repris à la main** : ce que l'humain a corrigé ou décidé, et pourquoi.
- **Décisions** : choix fonctionnels ou techniques pris en route.
- **Ce qui a coincé** : erreurs de l'agent, ambiguïtés, temps perdu. Rester honnête, c'est l'intérêt du journal.
```

Rester factuel et court : 3 à 6 lignes par entrée.
