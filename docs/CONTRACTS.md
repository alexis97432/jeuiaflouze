# Contrats v1 — arbitrage Codex, correction C0 à relire par Alexis

Arbitrage du 16 novembre 2026 après avis FLK et revue C0 Alexis. Les valeurs de réglage restent des hypothèses de playtest. Toute modification future du déterminisme augmente rulesVersion. FLK possède la simulation ; Alexis la consomme sans recopier ses règles. Cette correction documentaire attend sa revue externe avant gel.

## Simulation F0

Les règles exactes et leur ordre sont définis dans `src/game/core/README.md` (F0 `3725541`, PASS Codex). Cette référence est normative pour éviter deux jeux de formules divergents : entiers en millièmes, vitesse arrondie une fois par étage ; plafond sur la vitesse de base avant modulation, premier étage numéroté 1 avec tirage initial ; départ impair gauche/pair droite, rebond avec surplus réfléchi ; déplacement avant pose, premier appui au tick 1 ; chevauchement nul = raté prioritaire sur parfait, tolérance parfaite incluse. Ces précisions répondent à M1–M7 de la revue C0 Alexis.

Les doublons d'appuis dans un même tick sont fusionnés à l'exécution ; le rejeu sérialisé exige des ticks strictement croissants et rejette doublons/désordre. `replayRun` et `verifyRunResult` renvoient l'union discriminée documentée dans core/README. Leurs limites sont une configuration serveur de confiance. Les parties interactives ne sont pas encore bornées : décider inactivité/durée maximale et règles de classement avant A2 (M8), sans prétendre qu'un score local garantit l'admissibilité serveur.

Pause : aucun tick n'avance, reprise sans rattrapage après onglet caché. Un long gel visible peut abandonner du temps ; les entrées en attente sont recalées de la même quantité, bornées au premier tick non simulé et fusionnées par tick. Ce comportement de présentation ne change pas les règles du rejeu à ticks donnés.

API à exporter de src/game/index.ts :
```ts
export type RunConfig = { seed: number; rulesVersion: 1 };
export type RunResult = {
  seed: number; rulesVersion: 1; score: number;
  perfectCount: number; durationTicks: number; inputTicks: number[];
};
export type GameEvent =
  | { type: 'placement'; tick: number; floor: number; perfect: boolean; perfectStreak: number }
  | { type: 'miss'; tick: number; floor: number };
export type GameHandle = {
  pause(): void; resume(): void; destroy(): void;
};
export function mountGame(options: {
  canvas: HTMLCanvasElement; config: RunConfig;
  onEnd(result: RunResult): void;
  onEvent?(event: GameEvent): void;
  sound?: boolean;
  reducedMotion?: boolean;
}): GameHandle;
```

B1 accepté : onEvent signale chaque pose réussie et le raté, dans l'ordre des ticks. Le shell dérive first_placement de la première pose réussie, une seule fois ; aucun événement d'un simple toucher ou du raté ne le remplace. Les callbacks de mesure ne doivent ni détruire/remonter le moteur ni modifier son état ; leur erreur ne doit pas interrompre la partie et reste visible en développement.

B2 arbitré pour M1 : `sound` (défaut true) et `reducedMotion` sont transmis à la création, comme proposé par FLK. Le shell garde et affiche la préférence de son ; M1 permet de la changer **entre les parties**. Aucun bouton promettant une coupure immédiate pendant une partie sans setter. Si reducedMotion est omis, le moteur suit la préférence système en direct. Un `setPrefs` à chaud est reporté à un besoin concret ; il n'est pas requis pour intégrer A1. Ne jamais remonter la partie pour changer le son en cours et perdre son état.

B3 accepté : config invalide → RangeError synchrone ; contexte Canvas 2D indisponible → Error synchrone, sans écouteurs/RAF/audio laissés attachés. Le shell rattrape l'erreur, affiche un message et permet retour/réessai sans score inventé.

`destroy` libère RAF, événements, observateur et audio ; il est idempotent. `mountGame` ne touche ni stockage, réseau, ni menus. `onEnd` arrive une seule fois après le délai visuel `END_DELAY_MS` exporté, jamais après destroy. Les tests shell attendent cet événement asynchrone sans fixer un score de mock. Les entrées tactiles ne doublent pas via les événements souris ; espace ne déclenche pas un bouton DOM pendant la partie.

## Shell A0/A1

Boot → écran d'accueil → jeu → résultat → rejouer/défier. Premier jeu accessible en un geste. Responsive dès 320 px, focus visible, boutons DOM, son désactivable et activé seulement après interaction, préférence reduced-motion respectée. En mode caché, appeler pause ; retour explicite ou reprise sûre sans saut temporel.

Défi URL `?v=1&seed=<uint32>&target=<entier>` (`v` = rulesVersion) : valider strictement, rejeter règles inconnues et valeurs excessives ; aucun HTML injecté. target entre 0 et 10000, pure déclaration amicale, jamais un score vérifié. Seed 1..4294967295. Valeurs numériques en décimal canonique ASCII : aucun signe, espace, exposant, hexadécimal ou zéro initial (sauf target=0). Rejeter les doublons de paramètres connus. Paramètres invalides : expliquer et proposer nouvelle partie. Copier URL en secours si Web Share absent/refusé ; un partage annulé n'est pas un succès. Aucune permission obligatoire.

localStorage préfixe `poc:v1:` ; record, préférences, derniers résultats bornés ; JSON invalide/quota indisponible = jeu toujours fonctionnel. Scores locaux explicitement locaux. Service classement absent = aucun classement public affiché. Un défi quotidien ultérieur dérive sa seed de la date UTC et de la version, pas de l'heure locale.

## Mesure

Horodatage des événements relatif à la session, aucune heure murale requise. Adaptateur `track(name, payload)` côté platform ; console/mémoire en développement par défaut, aucun envoi distant sans configuration et dispositif de consentement adapté. Événements : session_start, run_start, first_placement, run_end, retry, share_attempt, share_success, challenge_open. Champs communs : schemaVersion=1, rulesVersion, buildId, mode=free|challenge|daily, sessionId éphémère, runId. run_end : score, durationTicks, perfectCount ; retry : previousRunId. Ne pas mettre de nom, email, URL complète ou identifiant de publicité. Dédupliquer run_end par runId. Ni clic partager ni copie ne prouvent une arrivée d'ami ; challenge_open seul ne prouve pas un joueur distinct.

## Services A2 (hors M1)

Aucun secret côté client. Un score client n'est jamais une preuve. Serveur : challenge émis/horodaté, payload et inputTicks bornés, replay partagé F2, vérification version/seed/durée, quotas et anti-abus, clés d'idempotence. Le rejeu déterministe limite les scores impossibles mais ne bloque pas les bots : documenter cette limite. Pas de paiements développés sans prestataire, comptes et modèle commercial concrets.

## B4 — Mesure avant l'essai public

Ajouter A1.5 avant M2 public : export local de mesures pour les essais modérés, puis collecteur distant minimal optionnel si un essai public est justifié. Mode local toujours fonctionnel. Alexis possède la collecte dans platform/server ; aucune collecte distante active sans configuration et dispositif de consentement adaptés. Définir schéma borné, quotas, rétention et suppression avant activation ; ni classement ni paiement requis. J1 n'est mesurable qu'avec identifiant de retour consenti et méthode explicite, sinon le déclarer non mesurable. Un simple src=share ne prouve ni un ami distinct ni une arrivée attribuable à un partage particulier ; un protocole d'attribution séparé, minimisé et revu est nécessaire avant cette métrique. Ne pas bloquer M1 en attendant ce collecteur.

## Arbitrages V2 après revue C3 Alexis

- `mode: daily` accepté pour run_start, run_end, retry, first_placement et share_* ; date du jour `YYYY-MM-DD` UTC fixée au lancement dans run_start. Ni identifiant personnel ni collecte distante ajoutés. Lien reçu sous forme de défi reste mode challenge, même si la seed provenait d'une Tour du jour.
- Motif partageable V2 limité à deux catégories réellement observables : parfait / pose normale. Pas de champ de géométrie ajouté à GameEvent uniquement pour décorer une carte.
- Afficher la date UTC de la Tour du jour et la prochaine heure de changement convertie dans le fuseau du navigateur ; ne pas imposer Europe/Paris aux joueurs du monde entier. Une partie déjà commencée garde seed/date initiales.
- Workflow GitHub Pages à déclenchement manuel accepté pour A4 : l'utilisateur a demandé et autorisé le lien de jeu publié. Aucun nouvel accord utilisateur nécessaire pour préparer ce workflow ; revue, CI et SHA traçable restent requis avant publication. Garder /jeuiaflouze/, source-commit.txt et vérifier les assets HTTPS. Pas de publication automatique de branches de travail.

## Présentation V2 — F4

Interface additive convenue avec les deux propriétaires : `MountOptions.appearance?: { theme: ThemeId; skin: SkinId }`. ThemeId = confiserie | orbital | jardin ; SkinId = gomme | marbre | bonbon | verre | strie | ceramique. Les types, listes d'identifiants et validateurs sont exportés par src/game/index.ts, ainsi que `resolveAppearance(raw: unknown)`. Valeur inconnue → repli indépendant sur confiserie/gomme. Ni score, seed, géométrie ni rulesVersion modifiés ; sélection possédée/stockée par le shell, aucune lecture de stockage dans le renderer.

`renderAppearancePreview(canvas, appearance, options?)` dessine un aperçu fixe avec le même dessin de matière que le jeu, renvoie false si Canvas 2D indisponible, n'attache ni événement ni RAF. Le shell garde un libellé/aperçu de secours et des boutons accessibles. Options de taille/DPR et palier réservées aux appels contrôlés. Le shell A4 importe les types publics plutôt que les redéclarer et transmet la sélection validée au montage.
