# Licences des éléments tiers livrés avec le jeu

Les textes complets sont publiés avec le site, dans `public/licences-tiers.txt`. Le fichier est servi à côté du jeu, et l'écran Réglages y mène par le lien « Crédits : police Oswald, icônes Lucide, musiques originales ».

| Élément | Paquet et version | Licence | Titulaire | Ce qui est livré |
|---|---|---|---|---|
| Police Oswald (variable, graisses 200 à 700), titres et boutons depuis la V8 | `@fontsource-variable/oswald` 5.3.0 | SIL Open Font License 1.1 | © 2016 The Oswald Project Authors | Fichiers `woff2` (latin, latin étendu, cyrillique, cyrillique étendu, vietnamien), chargés seulement pour les caractères affichés |
| Icônes Lucide | `lucide` 1.66.0 | ISC | © 2026 Lucide Icons and Contributors | Tracés SVG des icônes utilisées, dans le JavaScript du jeu |
| Icônes Lucide issues de Feather | `lucide` 1.66.0 | MIT | © 2013-present Cole Bemis | Mêmes tracés, pour les icônes héritées de Feather (par exemple check, clock, lock, log-out, moon, shopping-bag, smartphone, target, x) |

Icônes utilisées (`src/app/ui/icons.ts`) : ArrowLeft, Award, Ban, CalendarDays, Candy, Check, CircleHelp, Clock, Coins, Copy, Crown, Download, Flame, Gem, Gift, Hand, Heart, House, Image, Layers, Leaf, Link, ListChecks, Lock, LogOut, Medal, Moon, Orbit, Palette, PartyPopper, Pause, Play, RotateCcw, Settings, Share2, ShoppingBag, Smartphone, Snail, Sparkles, Star, Sun, SunMoon, Target, Trophy, Users, Vibrate, Video, Volume2, VolumeX, WandSparkles, X et Zap.

Jusqu'à la V7, la police était Fredoka (même licence) ; elle n'est plus livrée depuis la V8. Le texte courant utilise la police du système de l'appareil.

Musiques : compositions originales du jeu, synthétisées dans le navigateur, sans échantillon ni banque de sons tiers (voir `docs/MUSIQUE.md`).

Aucun appel externe : la police et les icônes sont servies avec le jeu. Aucune police ni icône n'est téléchargée depuis un service tiers à l'exécution.

Les skills de `.claude/skills` viennent de [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills), sous licence Apache-2.0. Ce sont des outils de développement : ils ne sont pas livrés avec le site, et leurs notices restent dans leur dossier.
