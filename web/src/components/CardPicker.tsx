import type { Card } from '../lib/cards';
import { RANK_LABELS, SUIT_SYMBOLS, makeCard, suitColorClass } from '../lib/cards';

interface Props {
  picked: Set<Card>;
  onPick: (c: Card) => void;
  disabled?: boolean;
}

// 4 rows of 13 cards. Suits ordered ♠ ♥ ♦ ♣ for visual readability.
const SUIT_ORDER = [3, 2, 1, 0];

export function CardPicker({ picked, onPick, disabled }: Props) {
  return (
    <div className="grid grid-cols-13 gap-[2px] p-1 bg-feltDark/60 rounded-lg">
      {SUIT_ORDER.map((suit) =>
        RANK_LABELS.map((_, rank) => {
          const card = makeCard(rank, suit);
          const isPicked = picked.has(card);
          const colorClass = isPicked ? 'text-feltDark/30' : suitColorClass(suit);
          return (
            <button
              key={card}
              disabled={isPicked || disabled}
              onClick={() => onPick(card)}
              className={`
                h-14 rounded text-base leading-none font-extrabold
                flex flex-col items-center justify-center gap-[1px]
                ${isPicked
                  ? 'bg-feltDark/80 line-through'
                  : 'bg-white active:bg-yellow-300'}
                ${colorClass}
                ${disabled ? 'opacity-40' : ''}
                transition-colors
              `}
            >
              <div className="text-[15px] leading-none">{RANK_LABELS[rank]}</div>
              <div className="text-[17px] leading-none">{SUIT_SYMBOLS[suit]}</div>
            </button>
          );
        })
      )}
    </div>
  );
}
