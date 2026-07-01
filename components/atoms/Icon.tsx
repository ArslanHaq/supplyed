import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleHelp,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Grid3X3,
  Heart,
  Home,
  Image as ImageIcon,
  List,
  LucideIcon,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Palette,
  Plus,
  PoundSterling,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Upload,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/cn";

const icons: Record<string, LucideIcon> = {
  home: Home,
  search: Search,
  bell: Bell,
  calendar: CalendarDays,
  message: MessageCircle,
  user: User,
  users: Users,
  building: Building2,
  file: FileText,
  check: Check,
  checkCircle: CheckCircle2,
  x: X,
  plus: Plus,
  arrow: ArrowRight,
  arrowLeft: ArrowLeft,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  shield: ShieldCheck,
  pin: MapPin,
  clock: Clock,
  settings: Settings,
  upload: Upload,
  download: Download,
  eye: Eye,
  eyeOff: EyeOff,
  edit: Pencil,
  palette: Palette,
  send: Send,
  star: Star,
  zap: Zap,
  grid: Grid3X3,
  heart: Heart,
  image: ImageIcon,
  list: List,
  help: CircleHelp,
  moreH: MoreHorizontal,
  pound: PoundSterling,
  award: Award,
  filter: Filter,
};

type IconProps = {
  name: string;
  size?: number;
  className?: string;
};

export function Icon({ name, size = 16, className }: IconProps) {
  const Component = icons[name] ?? Circle;

  return (
    <Component
      aria-hidden="true"
      className={cn("shrink-0", className)}
      size={size}
      strokeWidth={1.8}
    />
  );
}
