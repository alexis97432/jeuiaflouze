/**
 * V8 — palette propre à chaque matière.
 *
 * Avant la V8, une matière n'avait pas de couleur : elle peignait sa texture sur la couleur
 * d'étage de l'univers (`theme.blocks`). Toute la collection prenait donc les mêmes tons pastel
 * (lavande, menthe), d'où l'impression « bleu, mauve, bleu, mauve ».
 *
 * Désormais chaque matière possède 2 à 4 tons d'une même famille, alternés d'un étage à l'autre.
 * La composition d'ensemble couvre des familles distinctes : terres cuites et ocres, rouges et
 * braises, émeraudes et minéraux, ivoires et métaux, verres teintés, glace, monochromes.
 * La couleur de rareté reste un repère d'interface : elle n'est jamais imposée à l'objet.
 */
import type { Rgb } from './color';

export const SKIN_PALETTE: Readonly<Record<string, readonly Rgb[]>> = {
  // Communs : matières brutes et naturelles.
  gomme: [[176, 82, 56], [158, 70, 48], [190, 104, 66], [146, 64, 50]], // brique de terre cuite
  strie: [[112, 114, 70], [96, 100, 60], [128, 124, 82]], // caoutchouc kaki côtelé
  bonbon: [[176, 30, 46], [232, 214, 190], [150, 22, 40], [226, 200, 170]], // sucre d'orge rouge et crème
  graphite: [[66, 66, 68], [56, 56, 58], [78, 78, 80]], // mine de crayon, monochrome
  bois: [[120, 78, 46], [150, 102, 58], [98, 62, 38]], // noyer, chêne
  papier: [[234, 224, 202], [198, 166, 122], [222, 204, 168]], // ivoire, kraft, parchemin
  ardoise: [[72, 80, 82], [60, 66, 70], [86, 92, 88]], // V8 : schiste gris-vert
  // Rares : minéraux et verres.
  marbre: [[226, 222, 214], [58, 54, 54], [74, 106, 86]], // Carrare, Marquina, vert antique
  ceramique: [[120, 160, 132], [142, 38, 36], [196, 140, 52], [226, 214, 186]], // céladon, sang-de-bœuf, ocre
  verre: [[200, 130, 40], [56, 120, 78], [118, 114, 110]], // ambre, vert bouteille, fumé
  nacre: [[234, 228, 216], [226, 216, 220], [216, 224, 216]], // perle
  pixel: [[139, 172, 15], [98, 140, 40], [60, 108, 52]], // écran vert monochrome
  mosaique: [[198, 146, 70], [170, 84, 52], [224, 206, 170], [44, 120, 114]], // ocre, rouille, crème, sarcelle
  fer: [[70, 64, 60], [58, 54, 52], [82, 72, 64]], // V8 : fer forgé noirci
  givre: [[214, 230, 232], [204, 222, 226], [226, 236, 236]], // V8 Noël : verre givré
  // Épiques : métaux, verres sertis, lumière.
  circuit: [[22, 92, 60], [18, 78, 52]], // circuit émeraude
  holographique: [[200, 202, 208], [186, 188, 196]], // argent
  lave: [[60, 44, 40], [52, 38, 34]], // roche volcanique
  or: [[212, 160, 52], [198, 146, 44]], // or
  neon: [[34, 28, 30], [30, 26, 28]], // verre fumé
  vitrail: [[150, 30, 40], [24, 110, 70], [200, 130, 30], [44, 72, 150]], // rubis, émeraude, ambre, saphir
  ebene: [[38, 28, 24], [30, 22, 20], [46, 34, 28]], // V8 : ébène
  velours: [[118, 18, 34], [98, 14, 28], [132, 26, 42]], // V8 Noël : velours bordeaux
  // Légendaires : chacun son monde.
  galaxie: [[24, 16, 14], [20, 14, 14]], // espace profond, nébuleuses chaudes
  cristal: [[226, 236, 238], [236, 232, 226]], // cristal incolore
  aurore: [[10, 30, 26], [8, 26, 24]], // nuit boréale verte
  abysse: [[8, 40, 52], [6, 34, 46]], // océan profond
  phenix: [[72, 22, 12], [64, 18, 10]], // braise
  obsidienne: [[18, 16, 20], [14, 12, 16]], // V8 : verre volcanique
  sapin: [[24, 66, 42], [20, 56, 36]], // V8 Noël : sapin
};

const FALLBACK: readonly Rgb[] = [[150, 140, 130]];

/** Couleur de base de l'étage `floor` pour la matière `skin`. */
export function skinColor(skin: string, floor: number): Rgb {
  const p = SKIN_PALETTE[skin] ?? FALLBACK;
  return p[((floor % p.length) + p.length) % p.length]!;
}
