import { Fragment } from 'react';
import type { Card } from '../lib/cards';
import { RANK_LABELS, SUIT_SYMBOLS, makeCard, suitColorClass } from '../lib/cards';

interface Props {
  picked: Set<Card>;
  onPick: (c: Card) => void;
  disabled?: boolean;
}

// 4 rows (♠ ♥ ♦ ♣). Each row starts with the suit symbol so the rank cells
// can be compact squares instead of tall rank-over-suit chips.
const SUIT_ORDER = [3, 2, 1, 0];

export function CardPicker({ picked, onPick, disabled }: Props) {
  return (
    <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[2px] p-1 bg-feltDark/60 rounded-lg">
      {SUIT_ORDER.map((suit) => (
        <Fragment key={suit}>
          {/* Suit label at the start of each row */}
          <div
            className={`aspect-square flex items-center justify-center text-base font-bold ${suitColorClass(suit)}`}
          >
            {SUIT_SYMBOLS[suit]}
          </div>
          {/* 13 rank squares */}
          {RANK_LABELS.map((label, rank) => {
            const card = makeCard(rank, suit);
            const isPicked = picked.has(card);
            const colorClass = isPicked ? 'text-feltDark/30' : suitColorClass(suit);
            return (
              <button
                key={card}
                disabled={isPicked || disabled}
                onClick={() => onPick(card)}
                className={`
                  aspect-square rounded text-sm font-extrabold leading-none
                  flex items-center justify-center
                  ${isPicked
                    ? 'bg-feltDark/80 line-through'
                    : 'bg-white active:bg-yellow-300'}
                  ${colorClass}
                  ${disabled ? 'opacity-40' : ''}
                  transition-colors
                `}
              >
                {label}
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
