import type { Card } from '../lib/cards';
import { RANK_LABELS, SUIT_SYMBOLS, isRedSuit, rankOf, suitOf } from '../lib/cards';

interface Props {
  card: Card | null;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean;
}

export function CardChip({ card, size = 'md', highlight }: Props) {
  const sizeClasses = {
    sm: 'w-7 h-10 text-[10px]',
    md: 'w-9 h-12 text-xs',
    lg: 'w-11 h-14 text-sm',
  }[size];

  if (card === null) {
    return (
      <div
        className={`
          ${sizeClasses}
          rounded border-2 border-dashed border-white/30 bg-feltDark/40
          ${highlight ? 'border-yellow-400 animate-pulse' : ''}
        `}
      />
    );
  }
  const red = isRedSuit(suitOf(card));
  return (
    <div
      className={`
        ${sizeClasses} rounded bg-white font-bold
        flex flex-col items-center justify-center shadow
        ${red ? 'text-red-600' : 'text-black'}
      `}
    >
      <div>{RANK_LABELS[rankOf(card)]}</div>
      <div className="leading-none">{SUIT_SYMBOLS[suitOf(card)]}</div>
    </div>
  );
}
