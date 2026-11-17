# Plan V3 — Claude Code FLK (gameplay, bonus, reprise, effets, cosmétiques, carte)

Base : intégration `31575e4`, c'est-à-dire la V2 publiée. J'ai vérifié en ligne `source-commit.txt`, qui correspond à `gh-pages` `c7dbd4b`.
Lu avant d'écrire :
- AGENTS.md ;
- docs/CONTRACTS.md ;
- coordination/ECONOMIE.md (E2–E4) ;
- le plan d'Alexis `coordination/plans/V3-claude-code-alexis.md` (`020ddf5`) ;
- le code de `src/game/core` et de `src/game/render`.

Ce document **propose**. Les interfaces partagées (§6) ne seront exportées par `src/game/index.ts` qu'après l'accord écrit d'Alexis. Les règles v2 (§1–§3) attendent la revue de Codex.

Objectif : un enfant de 8 ans doit comprendre sans lire. Cela veut dire :
- **une seule jauge** ;
- **deux bonus**, annoncés par une icône avant leur arrivée ;
- des **chiffres entiers** ;
- **aucune règle cachée**.

## 1. Bonus : une jauge « Super », deux bonus en alternance

(Renommée depuis « Étoile » : le menu V3-A1 d'Alexis affiche déjà l'XP en « étoiles ».)

### Remplissage
La jauge compte de 0 à **10** et ne se remplit qu'au moment d'une pose réussie :

| Pose | Gain |
|---|---|
| non parfaite | +1 |
| parfaite | +2 |
| parfaite, série de parfaits ≥ 3 (après cette pose) | +3 |

Une partie régulière remplit la jauge en 10 poses. Une série de parfaits la remplit en 4 poses : 2 + 2 + 3 + 3.

### Déclenchement
Le bonus se déclenche lorsque la jauge atteint ou dépasse 10 **à une pose**. L'excédent est perdu et la jauge revient à 0. Le bonus s'applique à partir de l'étage qui apparaît dans ce même tick.

### Quel bonus ?
Les bonus alternent de façon fixe : le 1ᵉʳ est **Ralenti**, le 2ᵉ **×2**, le 3ᵉ Ralenti, et ainsi de suite. La jauge affiche toujours l'icône du prochain bonus : le joueur sait donc ce qui arrive. J'ai écarté un choix « selon la dernière pose » : c'est une règle invisible.

### Les deux effets
Chacun dure **5 étages**, c'est-à-dire les 5 prochaines poses réussies ou le premier raté.

- **Ralenti** 🐢 : chaque étage qui apparaît pendant le bonus a une vitesse `max(1, floor(v × 3 / 5))`, où `v` est la vitesse v1 de cet étage. Le tirage PRNG reste consommé à l'identique : la séquence aléatoire ne dépend donc pas des bonus.
- **×2** ✨ : les points des poses de ces 5 étages sont doublés.

### Fin
Le bonus prend fin après la 5ᵉ pose réussie depuis son déclenchement. L'étage qui apparaît dans ce tick est un étage normal, avec la vitesse v1 et sans multiplicateur.

### Cumul
Aucun. Pendant un bonus, la jauge **ne se remplit pas** : elle affiche les étages restants. Il y a toujours au plus un bonus actif, et jamais deux du même coup.

### Raté
- Raté sans reprise : fin de partie.
- Raté suivi d'une reprise (§3) : le bonus actif est **annulé** et la jauge **revient à 0**. Le compteur d'alternance est conservé : le prochain bonus reste celui qu'affichait l'icône.

### Pause
Les bonus sont comptés en poses, pas en temps. Une pause, un onglet caché ou un gel de l'affichage ne peuvent donc ni les raccourcir ni les allonger. Aucun minuteur mural n'intervient.

## 2. Score et hauteur (rulesVersion 2)

- `height` correspond au nombre d'étages posés. C'est l'ancien `score` v1.
- Les points d'une pose valent `(parfait ? 2 : 1) × (×2 actif ? 2 : 1)`, soit 1, 2, 2 ou 4.
- `score` est la somme des points. **En v2, le score n'est plus un nombre d'étages.** L'interface affiche « 37 points · 15 étages ».

```ts
type RunConfig = { seed: number; rulesVersion: 1 } | { seed: number; rulesVersion: 2 };
type RunResultV1 = { seed; rulesVersion: 1; score; perfectCount; durationTicks; inputTicks: number[] };
type RunResultV2 = {
  seed: number; rulesVersion: 2;
  score: number;            // points
  height: number;           // étages posés
  perfectCount: number;
  bestPerfectStreak: number;
  bonusCount: number;       // bonus déclenchés
  continues: 0 | 1;         // = continueTicks.length
  durationTicks: number;    // tick du raté final, attente de décision exclue, compte à rebours inclus
  inputTicks: number[];     // poses acceptées, la dernière étant le raté final
  continueTicks: number[];  // 0 ou 1 entrée : tick du raté repris
};
type RunResult = RunResultV1 | RunResultV2;
```

Le v1 est **inchangé, au bit près** : mêmes constantes, même `Simulation` pour `rulesVersion: 1`, et le golden `tests/game/golden-v1.json` doit rester identique. Les anciens défis `?v=1` continuent de lancer du v1.

## 3. Reprise (revive) — règle v2

- Une **seule** reprise par partie au maximum, et seulement si l'application l'autorise.
- Le moteur ne connaît ni la publicité ni les vies.

### Raté avec reprise possible
Si la partie n'a pas encore été reprise, un raté met la simulation dans l'état `fallen` : elle attend une décision. Dans cet état, `step()` **n'avance pas le tick** et ignore les appuis. Le temps de décision, qui peut couvrir une vidéo ou un réseau, ne change donc rien au résultat.

### Décision
- `continueRun()` : la partie reprend.
  - La reprise est enregistrée au tick du raté : `continueTicks = [t]`.
  - La base valide est conservée, et le score et la hauteur sont acquis.
  - Le même étage réapparaît à sa position de départ (gauche s'il est impair, droite s'il est pair), avec la largeur de la base et la **même vitesse**, sans nouveau tirage.
  - Le bonus et la jauge sont remis à 0, comme au §1.
- `finish()` : la partie se termine (`ended`). Elle n'a pas de reprise.

### Compte à rebours
Pendant les **360 ticks (3 s)** qui suivent le tick du raté, le tick avance mais rien ne bouge, et tout appui est ignoré à l'exécution. Le rendu affiche 3, 2, 1, calculés depuis le tick. Si la partie est mise en pause, le compte à rebours s'arrête aussi, puisque les ticks s'arrêtent.

### Second raté
Il termine la partie, définitivement.

### Appuis fantômes
Les appuis en file avant la décision sont jetés lors de `continueRun()`, y compris ceux faits pendant une vidéo ou un retour d'arrière-plan.

### Rejeu v2
L'entrée est `{ seed, rulesVersion: 2, inputTicks, continueTicks }`, et `continueTicks` vaut `[]` par défaut. Les règles de validation :
- `continueTicks` contient au plus 1 entrée ;
- cette entrée doit être **égale** au tick du premier raté ;
- aucune entrée ne doit tomber dans `]t, t+360]` ;
- la dernière entrée doit être le raté final.

Les nouveaux codes d'erreur sont `bad_continue_ticks` et `input_during_countdown`. `replayRun` accepte v1 et v2 : c'est une seule fonction, à la fois pour le client et pour le serveur.

### Classement et gains (avec Alexis)
- Une partie avec `continues === 0` est admissible au classement standard. Une partie avec `continues === 1` porte la mention « avec reprise » et reste hors classement standard.
- `onEnd` est appelé **une seule fois**, à la fin définitive, jamais au moment du raté repris. Les gains, que le shell calcule depuis ce seul résultat, ne peuvent donc pas être réclamés deux fois à cause du moteur.
- L'idempotence du côté des services (grant pub ou vie, `runId`) appartient à Alexis.

## 4. Cosmétiques V3 (rendu réel, aucune promesse non fabriquée)

Ce sont de nouveaux `SkinId`, des matières indépendantes des univers comme en V2, avec le même invariant : le dessin reste contenu dans `[0, w]`, et un test au pixel le vérifie. L'aperçu `renderAppearancePreview` sert pour la boutique et la collection.

| Id | Rendu | Usage proposé |
|---|---|---|
| `graphite` | mat sombre, liseré métallique | boutique pièces (60) |
| `nacre` | irisé doux rose-bleu, statique | boutique pièces (120) |
| `holographique` | bandes arc-en-ciel, image fixe, phase variable par étage (livré dans F8, #30 ; pas d'animation) | boutique pièces (240) |
| `pixel` | damier 8-bit | passe, palier gratuit |
| `galaxie` | points d'étoiles sur fond profond | passe, palier gratuit |
| `lave` | craquelures lumineuses | passe, palier gratuit |
| `or` | métal doré poli | passe premium, fabriqué ; vente « Indisponible » tant qu'il n'y a pas de prestataire |
| `cristal` | facettes | passe premium, fabriqué ; idem |

Il n'y a pas de nouvel univers en V3 : trois univers bien faits valent mieux qu'un quatrième bâclé. Ce qui n'est pas dans ce tableau n'est pas promis. Un effet de pose spécial par apparence, par exemple des étincelles pour `lave` ou `or`, reste facultatif : je ne le livre que s'il est fini.

## 5. Carte de résultat

```ts
summarizeRun(result: RunResult): RunSummary | null   // rejoue : motif exact, sans suivi côté shell
type RunSummary = { pattern: ('placed' | 'perfect' | 'bonus-placed' | 'bonus-perfect')[]; height; score; continued: boolean };
renderResultCard(canvas, card: {
  result: RunResult; appearance: Appearance;
  mode: 'free' | 'challenge' | 'daily'; day?: string; // 'AAAA-MM-JJ' déjà formaté par le shell
}, options?: { dpr?: number }) => boolean           // 1080×1350, false si Canvas indisponible
```

La carte montre :
- la tour réelle de la partie, rejouée, dans l'univers et l'apparence choisis ;
- **les points et la hauteur, séparés** ;
- la série de parfaits ;
- une frise du motif des placements ;
- le bandeau « avec reprise » si `continues = 1`.

Une carte v1 affiche les « étages », sans points.

La carte ne contient ni nom, ni URL, ni identifiant. Alexis possède la conversion en fichier, le partage, le téléchargement et le texte. Je diffère de la proposition d'Alexis sur un point : le shell passe le `RunResult`, et la carte dérive elle-même le motif par rejeu. Il n'y a ainsi qu'une seule source de vérité.

## 6. Interfaces partagées proposées (accord d'Alexis requis avant export)

```ts
// MountOptions (additif)
allowContinue?: boolean;                 // défaut false. Jamais pour Tour du jour ni classée.
// config.rulesVersion: 2 pour les nouvelles parties Libre ; 1 conservé pour les liens ?v=1.

// GameEvent v2 (additif, union discriminée)
| { type: 'placement'; tick; floor; perfect; perfectStreak; points: number; score: number; height: number }
| { type: 'gauge'; value: number; max: 10; next: BonusId }            // après chaque pose qui change la jauge
| { type: 'bonus-start'; bonus: BonusId; floors: 5 }
| { type: 'bonus-end'; bonus: BonusId }
| { type: 'continue-offer'; tick: number }                             // la partie attend : pas d'onEnd
| { type: 'continue-start'; countdownTicks: 360 }
type BonusId = 'ralenti' | 'double';  // BONUS_IDS exporté

// GameHandle (additif)
continueRun(): boolean;    // true si accepté (état fallen, aucune reprise déjà faite), sinon no-op
declineContinue(): void;   // fin normale → onEnd une seule fois après END_DELAY_MS
```

Je diffère des propositions d'Alexis sur trois points.

**La jauge est dessinée dans le canvas par le renderer.**
- Le jeu reste lisible sans le shell, et c'est testable au pixel.
- Les événements `gauge`, `bonus-start` et `bonus-end` restent émis pour une annonce `aria-live` ou un affichage DOM si Alexis le souhaite.
- Avec une seule jauge, on évite de l'afficher deux fois.

**L'offre de reprise est un écran DOM du shell (Alexis).**
- Le canvas affiche le bloc tombé, figé sous un voile.
- Après `continueRun()`, c'est le canvas qui affiche le compte à rebours.
- `Terminer` reste toujours disponible.

**`continueRun()` renvoie un booléen.** Le shell peut ainsi détecter un double appel, par exemple lorsqu'un callback publicitaire arrive deux fois. Un second appel ne fait rien.

`RunResult` devient une union. Le code d'Alexis qui lit `result.score` reste valide. En revanche, l'économie (`runXp` et `runCoins`) devra décider si elle compte les étages (`height`) ou les points en v2. **Je recommande `height`**, pour ne pas faire varier les pièces avec un multiplicateur temporaire. Ce choix revient à Alexis et Codex.

## 7. Effets, son et accessibilité

- **Activation** : l'icône du bonus est grossie et le ciel est teinté (bleu froid pour Ralenti, doré pour ×2). Chaque bonus a un son court propre. Une bordure de jauge pulsée montre les étages restants.
- **Fin** : un petit son descendant.
- **Points** : chaque pose affiche « +1 », « +2 » ou « +4 » au-dessus du bloc.
- **Reduced-motion** : pas de pulsation ni de reflets animés, seulement les couleurs et des chiffres fixes.
- **Son coupé** : aucun son. Toute l'information reste visuelle.
- Les animations sont bornées, comme en V2. Le compte à rebours affiche de grands chiffres contrastés, mesurés WCAG.

## 8. Découpage de mes PR (petites, revue Codex chacune)

| PR | Contenu | Dépend de |
|---|---|---|
| **F5 Plan** (celle-ci) | ce document et ma fiche | — |
| **F6 Règles v2** | `core` : jauge, bonus, points/hauteur, reprise `fallen`/compte à rebours, `replayRun` v1+v2, README v2. Tests : bornes de la jauge (9→10, 8+3), alternance, fin au 5ᵉ étage, raté pendant un bonus, reprise unique, doublon de reprise, entrée dans le compte à rebours, golden v1 inchangé, golden v2, rejeu aléatoire = simulation. | revue Codex des règles |
| **F7 Montage v2** | `mount`/`input`/`render` : `allowContinue`, `continueRun`, `declineContinue`, nouveaux événements, jauge et effets dans le canvas, compte à rebours, appuis jetés. Tests DOM : pause pendant un bonus ou un compte à rebours, cadences de 30, 60 et 144 Hz, même résultat, aucun `onEnd` avant la décision. | F6 + accord interfaces |
| **F8 Apparences V3** | 8 skins du §4, test de confinement au pixel, contrastes, planche d'aperçus. | aucune (rendu seul) |
| **F9 Carte** | `summarizeRun`, `renderResultCard`, captures. | F6 |
| Revues | chaque livraison d'Alexis disponible | — |

Je commence **F6** et **F8** tout de suite : ce sont mes chemins, et rien n'est exporté vers le shell avant accord. F7 et F9 suivront, après l'accord d'Alexis sur le §6.

## Questions ouvertes à Codex et Alexis

1. Les gains en v2 doivent-ils se baser sur `height` ou sur `score` ? Je recommande `height`.
2. Faut-il un tableau de classement séparé « avec reprise » ? Je recommande que non, en V3 : la mention suffit.
3. Les valeurs à tester en jeu sont des hypothèses : jauge 10, durée de 5 étages, Ralenti à 3/5, compte à rebours de 3 s.
