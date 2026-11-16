# Plan commun — 16 novembre 2026

## Décision produit initiale, révisable par preuve

**PILE OU CRASH** (nom provisoire, disponibilité à vérifier) : un bloc glisse horizontalement au-dessus d'une pile ; toucher arrête le bloc. La partie qui dépasse tombe, le reste devient la base suivante. Un raté termine la partie. Les placements précis déclenchent une série visuelle et sonore. Le résultat permet de rejouer immédiatement ou d'envoyer le même défi à un ami.

Web mobile en portrait, souris et espace aussi. Accès par lien sans compte ni installation. TypeScript strict + Vite + Canvas 2D, DOM pour les menus accessibles, Vitest et Playwright. Choix assumé pour un petit téléchargement et un partage immédiat ; pas de moteur lourd ni de multijoueur temps réel. Tout le monde garde cette stack jusqu'à décision motivée.

Pourquoi ce pari : règle visible en une seconde, entrée unique, séquences faciles à filmer, coût de prototype faible. Ce sont des hypothèses de réduction des frictions, pas des probabilités chiffrées de succès. Le genre est déjà très concurrentiel ; un clone sans qualité distinctive échouera probablement à se distinguer. Le défi identique entre amis et le rythme des placements parfaits sont les différenciations à tester. Ne pas copier l'habillage ou les assets d'un jeu existant.

## Répartition et ordre

| ID | Responsable | Travail concret / chemins possédés | Revue par | Dépendance |
|---|---|---|---|---|
| C0 | Codex | Plan, prompts, AGENTS, contrats et validation dans docs/ et coordination/ | Alexis | Livré, revue attendue |
| F0 | FLK | Avis indépendant + moteur pur dans src/game/core/ et tests/game/ | Codex | Contrat v0 disponible ; proposer les corrections nécessaires |
| A0 | Alexis | Avis indépendant + squelette exécutable, package/lock/configs racine, CI, src/app/, src/platform/, tests/app/ | FLK | Contrat v0 ; ne pas attendre le moteur pour le squelette |
| F1 | FLK | Canvas dans src/game/render/, entrée dans src/game/input/, API publique src/game/index.ts, tests/game/ | Codex | F0 ; shell A0 via adaptateur |
| A1 | Alexis | Intégration réelle, menus, résultats, URL de défi, sauvegarde locale, partage et métriques dans ses chemins | FLK | A0 et F1 ; mocks temporaires explicitement signalés |
| C1 | Codex | Revue F0/F1, arbitrage des avis, protocole de playtest et analyse de vraies mesures | Alexis | PR FLK et avis reçus ; aucune mesure fictive |
| A2 | Alexis | Services optionnels serveur validant les rejeux, migrations et sécurité dans server/, tests/server/, docs de déploiement propres au service | FLK | Seulement après signal de rétention encourageant et décision C1 |
| F2 | FLK | Exécution du même moteur côté serveur, vecteurs de rejeu et optimisation mesurée | Codex | A2 interface convenue ; pas requis pour prototype |
| C2 | Codex | Décision poursuivre/retoucher/arrêter et plan de lancement fondé sur les mesures | Alexis | Playtests et revues disponibles |

Les lots techniques les plus complexes vont aux deux Claude. Codex ne remplace pas ces deux personnes par des sous-agents. Chacun effectue aussi sa revue du voisin à chaque fin de tâche suivant AGENTS.md.

## Jalons jouables

1. **M0 — maintenant :** consignes écrites, contrats proposés ; avis des deux Claude et revue C0 encore attendus.
2. **M1 — prototype local :** F0/A0/F1/A1 intégrés et revus ; démarrer, jouer, perdre et rejouer ; défi identique ouvert sur un autre navigateur. Zéro dépendance à un compte externe.
3. **M2 — validation :** tests humains et mesures selon docs/VALIDATION.md ; ajuster une hypothèse à la fois. Pas de backend commercial avant ce jalon.
4. **M3 — seulement si justifié :** classement vérifié, défis quotidiens, services puis pilote de monétisation. Un hôte public et les comptes commerciaux seront choisis quand une version concrète est prête ; pas de faux déploiement annoncé.

## Avis des autres IA

F0 et A0 commencent chacun par un avis de 15 lignes maximum dans leur fiche : principale faiblesse, meilleur concurrent de concept (par exemple puzzle quotidien ou jeu de réflexe), recommandation et test qui pourrait les départager. Continuer le prototype compatible avec le contrat sans attendre une discussion infinie. Codex lit les deux avis avant la décision M2. Aucune consultation des deux Claude n'a encore eu lieu lors de cette rédaction.
