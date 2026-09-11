import type { TicketTypeCategory } from '@/types/database';

const ICON_BY_CATEGORY: Record<TicketTypeCategory, { emoji: string; bg: string }> = {
  day_pass: { emoji: '☀️', bg: 'bg-sun/25' },
  season_pass: { emoji: '⭐', bg: 'bg-aqua/25' },
  group_pass: { emoji: '👨‍👩‍👧‍👦', bg: 'bg-coral/20' },
  addon: { emoji: '🏖️', bg: 'bg-ocean/15' },
};

/** Small color-coded icon chip used on ticket cards to visually distinguish categories. */
export function TicketCategoryIcon({ category }: { category: TicketTypeCategory }) {
  const { emoji, bg } = ICON_BY_CATEGORY[category] ?? ICON_BY_CATEGORY.day_pass;
  return (
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${bg}`} aria-hidden="true">
      {emoji}
    </span>
  );
}

const ACCENT_BY_CATEGORY: Record<TicketTypeCategory, string> = {
  day_pass: 'border-l-sun',
  season_pass: 'border-l-aqua',
  group_pass: 'border-l-coral',
  addon: 'border-l-ocean',
};

export function ticketAccentClass(category: TicketTypeCategory) {
  return ACCENT_BY_CATEGORY[category] ?? ACCENT_BY_CATEGORY.day_pass;
}
