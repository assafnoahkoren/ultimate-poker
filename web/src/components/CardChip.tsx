import type { Card } from '../lib/cards';
import { RANK_LABELS, SUIT_SYMBOLS, rankOf, suitOf, suitColorClass } from '../lib/cards';

interface Props {
  card: Card | null;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean;
}

export function CardChip({ card, size = 'md', highlight }: Props) {
  const sizeClasses = {
    sm: 'w-9 h-12 text-base',
    md: 'w-12 h-16 text-xl',
    lg: 'w-14 h-20 text-2xl',
  }[size];

  if (card === null) {
    return (
      <div
        className={`
          ${sizeClasses}
          rounded-md border-2 border-dashed border-white/30 bg-feltDark/40
          ${highlight ? 'border-yellow-400 animate-pulse' : ''}
        `}
      />
    );
  }
  return (
    <div
      className={`
        ${sizeClasses} rounded-md bg-white font-extrabold
        flex flex-col items-center justify-center shadow leading-none
        ${suitColorClass(suitOf(card))}
      `}
    >
      <div>{RANK_LABELS[rankOf(card)]}</div>
      <div className="leading-none">{SUIT_SYMBOLS[suitOf(card)]}</div>
    </div>
  );
}
