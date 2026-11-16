# Contrats v0 — proposition Codex à relire par Alexis et FLK

Ces contrats permettent de travailler en parallèle. Valeurs initiales = hypothèses à ajuster après playtest ; toute modification du déterminisme augmente rulesVersion. FLK possède l'implémentation de simulation ; Alexis la consomme, sans recopier les règles.

## Simulation F0

Temps logique entier à 120 ticks/s ; temps d'affichage indépendant. Largeur logique 360 unités, bloc de départ 240 unités centré. Bloc mobile entièrement contenu dans la largeur ; trajet triangulaire, premier déplacement vers la droite. Vitesse initiale 90 unités/s, +3 par étage, plafond 210. Arrondir les positions au millième d'unité à chaque tick pour stabiliser le rejeu JS. Un input à un tick donné est traité après le déplacement de ce tick. Un seul placement par tick ; ignorer les doublons. La mécanique ne dépend ni de Date.now, ni de Math.random, ni de la fréquence de rendu.

Chevauchement nul = échec ; sinon conserver exactement l'intersection horizontale. Tolérance parfait = 4 unités entre bords gauches ; dans ce cas aligner sur la base et garder sa largeur, sans agrandissement. Score = nombre d'étages posés (un par placement), série de parfaits informative, aucun bonus payant. Base plus étroite = difficulté naturelle. Aucun second essai dans un défi classé.

Seed uint32 non nulle ; PRNG xorshift32 (shifts 13,17,5 avec coercition unsigned). Pour chaque nouvel étage, consommer exactement un tirage, vitesse multipliée par 0.9 + 0.2*(tirage/2**32). Départ alternant bord gauche/droit selon parité de l'étage ; FLK formalise et teste le cas initial. Même seed + rulesVersion + inputTicks = même résultat. Pause : aucun tick n'avance, reprendre sans rattrapage après onglet caché. Mode compétitif futur : temps réel contrôlé serveur, distinct du simple défi amical.

API à exporter de src/game/index.ts :
```ts
export type RunConfig = { seed: number; rulesVersion: 1 };
export type RunResult = {
  seed: number; rulesVersion: 1; score: number;
  perfectCount: number; durationTicks: number; inputTicks: number[];
};
export type GameHandle = {
  pause(): void; resume(): void; destroy(): void;
};
export function mountGame(options: {
  canvas: HTMLCanvasElement; config: RunConfig;
  onEnd(result: RunResult): void;
}): GameHandle;
```

FLK exporte aussi une fonction pure de rejeu depuis core pour tests et futur serveur ; proposer sa signature dans F0. destroy libère RAF, événements et audio. mountGame ne touche ni stockage, ni réseau, ni menus. onEnd appelé une seule fois. Les entrées tactiles ne doublent pas via les événements souris ; espace ne déclenche pas le bouton DOM focalisé pendant le jeu.

## Shell A0/A1

Boot → écran d'accueil → jeu → résultat → rejouer/défier. Premier jeu accessible en un geste. Responsive dès 320 px, focus visible, boutons DOM, son désactivable et activé seulement après interaction, préférence reduced-motion respectée. En mode caché, appeler pause ; retour explicite ou reprise sûre sans saut temporel.

Défi URL `?v=1&seed=<uint32>&target=<entier>` : valider strictement, rejeter règles inconnues et valeurs excessives ; aucun HTML injecté. target entre 0 et 10000, pure déclaration amicale, jamais un score vérifié. Seed 1..4294967295. Paramètres invalides : expliquer et proposer nouvelle partie. Copier URL en secours si Web Share absent/refusé ; un partage annulé n'est pas un succès. Aucune permission obligatoire.

localStorage préfixe `poc:v1:` ; record, préférences, derniers résultats bornés ; JSON invalide/quota indisponible = jeu toujours fonctionnel. Scores locaux explicitement locaux. Service classement absent = aucun classement public affiché. Un défi quotidien ultérieur dérive sa seed de la date UTC et de la version, pas de l'heure locale.

## Mesure

Adaptateur `track(name, payload)` côté platform ; console/mémoire en développement par défaut, aucun envoi distant sans configuration et dispositif de consentement adapté. Événements : session_start, run_start, first_placement, run_end, retry, share_attempt, share_success, challenge_open. Champs communs : schemaVersion=1, rulesVersion, buildId, mode=free|challenge, sessionId éphémère, runId. run_end : score, durationTicks, perfectCount ; retry : previousRunId. Ne pas mettre de nom, email, URL complète ou identifiant de publicité. Dédupliquer run_end par runId. Ni clic partager ni copie ne prouvent une arrivée d'ami ; challenge_open seul ne prouve pas un joueur distinct.

## Services A2 (hors M1)

Aucun secret côté client. Un score client n'est jamais une preuve. Serveur : challenge émis/horodaté, payload et inputTicks bornés, replay partagé F2, vérification version/seed/durée, quotas et anti-abus, clés d'idempotence. Le rejeu déterministe limite les scores impossibles mais ne bloque pas les bots : documenter cette limite. Pas de paiements développés sans prestataire, comptes et modèle commercial concrets.
