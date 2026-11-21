# Stack or Crash : musiques (V7, V8)

## Droits et crédits

Chaque piste est une **composition originale écrite pour Stack or Crash**. Le jeu ne contient **aucun fichier audio externe** :
- chaque piste est une partition décrite dans le code (`src/app/music/tracks.ts`) ;
- le compositeur la transforme en notes (`compose.ts`) ;
- le synthétiseur du jeu joue ces notes dans le navigateur du joueur (`synth.ts`).

Licence : celle du dépôt, sans droit de tiers ni attribution due. Aucune bibliothèque, aucun échantillon et aucun enregistrement n'ont été intégrés : il n'y a donc aucune source externe à citer.

V8 : le piano est lui aussi synthétisé (aucune banque de sons ni échantillon de piano). Les mélodies des quatre pièces au piano sont écrites note à note dans `tracks.ts` (champ `written`) ; ce sont des compositions originales, pas des airs existants ni des chants de Noël traditionnels.

Les crédits du jeu l'indiquent dans Réglages (« Musiques : compositions originales de Stack or Crash… »). Cette page tient lieu de crédits dans le dépôt.

## Direction musicale

**Principes :**
- une musique de fond légère, jamais plus forte que les effets sonores ;
- chaque univers a son ambiance ;
- d'autres styles se collectionnent.

**Structure d'une piste :** quatre sections de 8 mesures (16 pour la valse) :
- A, le thème ;
- B, le contraste ;
- C, l'envolée, la plus énergique ;
- D, la respiration.

**Enchaînement des sections :**
- **Ordre :** le lecteur choisit la section suivante selon la hauteur de la tour : plus la tour monte, plus les sections énergiques reviennent souvent. Il ne joue jamais deux fois de suite la même section.
- **Thème commun :** A et C partagent le même motif mélodique, le thème reconnaissable de la piste.
- **Raccords :** les sections sont programmées à l'échantillon près sur l'horloge audio, 3 s à l'avance. Chacune porte sa propre queue de réverbération, qui recouvre le début de la suivante : aucune coupure sèche.

| Piste | Rareté | Origine | Ambiance |
|---|---|---|---|
| Sucre glace | Commun | Univers Confiserie | Pop sucrée et bondissante, marimba |
| Rosée du matin | Rare | Univers Jardin | Pastorale, flûte et harpe |
| Apesanteur | Épique | Univers Orbital | Nappes spatiales, cloches lointaines |
| Lagon | Épique | Univers Récif | Piano électrique et bulles, tempo nonchalant |
| Nocturne néon | Légendaire | Univers Cité néon | Synthwave pulsée |
| Mirage | Commun | Univers Désert | Luth et percussions, mode phrygien dominant |
| Cimes | Rare | Univers Montagne | Accordéon, guitare |
| Manège | Épique | Univers Fête foraine | Valse, orgue et glockenspiel |
| Hymne des nuées | Légendaire | Univers Royaume des nuées | Cordes, harpe, cor |
| Premier étage | Commun | **Offerte à tous** | Pop douce |
| Goûter lo-fi | Commun | Boutique, 180 pièces | Hip-hop feutré, accords jazz |
| Pixel parade | Rare | Boutique, 450 pièces | Chiptune rapide |
| Fanfare de poche | Rare | Boutique, 450 pièces | Cuivres et caisse claire de défilé |
| Funk des briques | Épique | Boutique, 900 pièces | Basse funk, clavinet |
| Aurore polaire | Légendaire | Boutique, 1 800 pièces | Ambient lumineuse |
| Sous-bois (V8) | Rare | Univers Forêt de brume | Piano mystérieux, mode dorien, nappe chaude et verre |
| Vitraux brisés (V8) | Épique | Univers Cathédrale oubliée | Piano mélancolique en mineur harmonique, orgue lointain, cordes |
| Cendres (V8) | Légendaire | Univers Cœur d'obsidienne | Piano dramatique, basses en octaves pulsées, cordes |
| Veillée (V8) | Épique | Univers Veillée de Noël (saison) | Valse au piano, clochettes et cordes douces |

La musique d'un univers est possédée avec l'univers. Les musiques de la boutique s'achètent avec les pièces du jeu et restent possédées quand elles quittent la sélection du jour.

## Pièces au piano (V8)

**Écriture :** chaque section (A, B, C, D) a une mélodie écrite, en phrases de quatre mesures :
- une question qui finit en suspens, puis une réponse qui se pose sur la tonique ;
- A et C portent le thème de la pièce, B le contraste, D la respiration ;
- la main gauche joue des arpèges brisés, des accords de valse ou des octaves pulsées, selon la pièce.

Le lecteur enchaîne les sections comme pour les autres pistes : la boucle est faite de phrases complètes, jamais coupée au milieu d'une phrase.

**Piano synthétisé** (`synth.ts`, voix `piano`) :
- quatre partiels légèrement inharmoniques, comme une corde raide ;
- chaque partiel s'éteint plus vite que le précédent, les aigus plus vite que les graves ;
- deux cordes très légèrement désaccordées au médium et à l'aigu, pour le battement ;
- une frappe de marteau très courte (bruit filtré) et un étouffoir à la fin de la note.

## Choix techniques

**Rendu :**
- **Rendu hors ligne :** chaque section est rendue une seule fois, dans un `OfflineAudioContext`, en mono à 22 050 Hz (environ 1,5 à 2,6 Mo par section).
- **Pendant une partie :** le lecteur ne joue que des tampons déjà rendus. Rien n'est synthétisé en temps réel, et la musique ne dépend pas de la fluidité de l'affichage.
- **Moment du rendu :** dans les menus. Pendant une partie, aucun rendu n'est lancé dès qu'une section de la piste est prête : rien ne saccade.
- **Mémoire :** 6 sections gardées au plus. Les tampons d'une piste quittée sont libérés.

**Centrale audio** (`src/platform/audio-hub.ts`) :
- un seul `AudioContext` pour la musique, les effets et les sons de l'interface ;
- créé au premier geste du joueur, relancé à chaque geste si le système l'a mis en pause ;
- suspendu en arrière-plan.

**Mixage :**
- bus musique passant par un bus d'atténuation, curseurs de volume au carré ;
- la musique s'efface brièvement sous un parfait, un boost ou une chute.

**Comportement propre :**
- une seule piste audible à la fois, avec un court fondu croisé entre deux pistes ;
- une écoute en boutique ou en collection arrête la précédente et se termine en quittant l'écran, ou après 20 s ;
- plus rien ne joue une fois le lecteur détruit.

## Contrôles réellement exécutés (techniques, sans écoute)

**Mesures dans Chromium sans affichage** (`OfflineAudioContext`), pour les 15 pistes × 4 sections :
- aucune valeur invalide ;
- crêtes entre −5 et −16 dBFS ;
- RMS entre −19 et −22 dBFS, selon l'énergie de la section ;
- queue éteinte sous −46 dBFS en fin de tampon.

**Raccords :** à la jonction de deux sections, le plus grand saut entre deux échantillons reste inférieur au plus grand saut mesuré dans les ±0,25 s alentour. Aucune discontinuité au raccord.

**Coût :**
- **Fil principal :** 20 à 40 ms par section (construction du graphe).
- **Rendu complet, hors du fil d'affichage :** 0,2 à 2,2 s par section dans ce conteneur cloud sans GPU. Ce n'est pas un téléphone : la durée réelle sur un appareil modeste n'a pas été mesurée.

**Tests unitaires** (`tests/app/v7-logic.test.ts`) :
- composition déterministe, registres bornés ;
- une seule piste audible ;
- pas de multiplication des sources ;
- écoute remplacée, puis arrêtée ;
- aucun rendu pendant une partie ;
- fin de vie.

**Tests en navigateur** (`tests/e2e/v7.spec.ts`) :
- un seul contexte audio sur trois parties ;
- écoute arrêtée en changeant d'écran ;
- contexte suspendu en arrière-plan, puis repris.

**Mesures V8 des pièces au piano** (même méthode) :
- crêtes entre −7 et −11 dBFS ; RMS entre −19,5 et −22 dBFS ;
- queues sous −58 dBFS ; aucune valeur invalide ;
- aux raccords, le saut entre échantillons reste inférieur aux sauts mesurés alentour.

**Coût du rendu :** 0,4 à 3,2 s par section dans ce conteneur. C'est plus que les autres pistes, car chaque note de piano compte plusieurs partiels. Le rendu se fait hors de l'affichage et jamais pendant une partie ; sur un téléphone modeste, le délai avant la première note n'a pas été mesuré.

**Limite :** aucune piste n'a été écoutée par une personne pendant ce travail. Personne n'a jugé la qualité, l'équilibre avec les effets ni le confort d'écoute sur de nombreuses parties.

Des extraits WAV ont été produits dans l'espace de travail temporaire de la session pour permettre une écoute humaine ; ils ne sont pas versionnés.
