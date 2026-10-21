---
name: grill
description: Interroger l'humain sans relâche sur une idée, un plan ou une spec jusqu'à une compréhension partagée. À utiliser quand on demande de « griller », challenger ou creuser une idée, et avant toute nouvelle spec.
---

# Grill

But : faire émerger toutes les décisions cachées d'une idée avant qu'elle devienne une spec ou du code. Mieux vaut dix questions maintenant qu'une règle de volley inventée plus tard.

## Déroulé

1. **Reformuler** l'idée en deux ou trois phrases et la faire valider.
2. **Chercher avant de demander** : si la réponse se trouve dans `docs/specs/`, le code, les issues ou le journal, la lire au lieu de poser la question. Ne demander que ce que seul l'humain sait.
3. **Parcourir l'arbre de décision** branche par branche : pour chaque décision, résoudre d'abord celles dont elle dépend.
4. **Une question à la fois**, toujours avec :
   - le contexte en une phrase ;
   - 2 à 4 options courtes ;
   - l'option recommandée et pourquoi.
5. **Pousser sur les cas limites** du domaine : nombre impair d'équipes, égalité parfaite, forfait, abandon en cours de match, terrain retiré, score corrigé après coup, retard qui décale tout le planning.
6. **S'arrêter** quand il ne reste plus de décision qui change le comportement, ou quand l'humain dit stop.

## Sortie

Un récapitulatif des décisions prises (une ligne chacune) et des questions restées ouvertes. Si la suite est une spec, enchaîner avec le skill `creer-spec`.
