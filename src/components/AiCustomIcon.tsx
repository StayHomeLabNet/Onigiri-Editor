import React from 'react';
import {
  AlignLeft,
  BookOpen,
  Bot,
  Brain,
  CheckCheck,
  Code2,
  FileSearch,
  FileText,
  Globe,
  Languages,
  Lightbulb,
  ListChecks,
  Mail,
  MessageSquare,
  PenLine,
  RefreshCw,
  Scissors,
  Smile,
  Sparkles,
  SpellCheck,
  Tags,
  Terminal,
  Wand2,
  Zap,
  type LucideProps,
} from 'lucide-react';
import type { AiCustomButtonIconId } from '../types';

const ICON_MAP: Record<AiCustomButtonIconId, React.ComponentType<LucideProps>> = {
  languages: Languages,
  sparkles: Sparkles,
  wand: Wand2,
  spellcheck: SpellCheck,
  'file-text': FileText,
  'align-left': AlignLeft,
  bot: Bot,
  zap: Zap,
  lightbulb: Lightbulb,
  'pen-line': PenLine,
  'check-check': CheckCheck,
  'list-checks': ListChecks,
  code: Code2,
  'message-square': MessageSquare,
  'book-open': BookOpen,
  'refresh-cw': RefreshCw,
  scissors: Scissors,
  tags: Tags,
  mail: Mail,
  brain: Brain,
  globe: Globe,
  'file-search': FileSearch,
  smile: Smile,
  terminal: Terminal,
};

interface AiCustomIconProps extends LucideProps {
  icon: AiCustomButtonIconId;
}

export const AiCustomIcon: React.FC<AiCustomIconProps> = ({ icon, ...props }) => {
  const IconComp = ICON_MAP[icon] ?? Sparkles;
  return <IconComp {...props} />;
};
