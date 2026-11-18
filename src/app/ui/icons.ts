/**
 * Icônes de l'interface V4 : sous-ensemble de Lucide (licence ISC, voir docs/LICENCES-TIERS.md).
 * Les SVG sont construits avec le `document` du shell (testable, sans innerHTML) et sont toujours
 * décoratifs (`aria-hidden`) : le nom accessible vient du texte du bouton.
 */
import {
  ArrowLeft,
  Award,
  Ban,
  CalendarDays,
  Candy,
  Check,
  CircleHelp,
  Clock,
  Coins,
  Copy,
  Crown,
  Download,
  Flame,
  Gem,
  Gift,
  Hand,
  Heart,
  House,
  Image,
  Layers,
  Leaf,
  Link,
  ListChecks,
  Magnet,
  Lock,
  LogOut,
  Medal,
  Moon,
  Orbit,
  Palette,
  PartyPopper,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Share2,
  Shield,
  ShoppingBag,
  Smartphone,
  Snail,
  Sparkles,
  Star,
  Sun,
  SunMoon,
  Target,
  Trophy,
  Users,
  Vibrate,
  Video,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
  Zap,
} from 'lucide';

type IconNode = readonly (readonly [string, Record<string, string | number | undefined>])[];

const ICONS = {
  back: ArrowLeft,
  award: Award,
  ban: Ban,
  calendar: CalendarDays,
  candy: Candy,
  check: Check,
  help: CircleHelp,
  clock: Clock,
  coin: Coins,
  copy: Copy,
  crown: Crown,
  download: Download,
  flame: Flame,
  gem: Gem,
  gift: Gift,
  hand: Hand,
  heart: Heart,
  home: House,
  image: Image,
  layers: Layers,
  leaf: Leaf,
  link: Link,
  missions: ListChecks,
  magnet: Magnet,
  lock: Lock,
  quit: LogOut,
  medal: Medal,
  moon: Moon,
  orbit: Orbit,
  palette: Palette,
  party: PartyPopper,
  pause: Pause,
  play: Play,
  replay: RotateCcw,
  settings: Settings,
  share: Share2,
  shield: Shield,
  shop: ShoppingBag,
  phone: Smartphone,
  slow: Snail,
  sparkles: Sparkles,
  star: Star,
  sun: Sun,
  auto: SunMoon,
  target: Target,
  trophy: Trophy,
  users: Users,
  vibrate: Vibrate,
  video: Video,
  sound: Volume2,
  mute: VolumeX,
  magic: WandSparkles,
  close: X,
  zap: Zap,
} as const satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

const SVG_NS = 'http://www.w3.org/2000/svg';

export function icon(doc: Document, name: IconName, extraClass = ''): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', `ic ${name}${extraClass ? ` ${extraClass}` : ''}`);
  for (const [tag, attrs] of ICONS[name] as IconNode) {
    const child = doc.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined && k !== 'key') child.setAttribute(k, String(v));
    }
    svg.append(child);
  }
  return svg;
}
