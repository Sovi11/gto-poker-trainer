import { allHandClasses, HandClass } from '../engine/range';

// Render the 13x13 starting-hand grid, highlighting the hands in `selected`.
export function RangeGrid({
  selected,
  onCellClick,
  highlight,
}: {
  selected: Set<HandClass>;
  onCellClick?: (cls: HandClass) => void;
  highlight?: HandClass | null;
}) {
  const grid = allHandClasses();
  return (
    <div className="range-grid">
      {grid.map((row, i) =>
        row.map((cls, j) => {
          const inRange = selected.has(cls);
          const isPair = cls.length === 2;
          const suited = cls[2] === 's';
          const cellType = isPair ? 'pair' : suited ? 'suited' : 'offsuit';
          return (
            <div
              key={`${i}-${j}`}
              className={`range-cell ${cellType} ${inRange ? 'in-range' : ''} ${highlight === cls ? 'cell-highlight' : ''}`}
              onClick={onCellClick ? () => onCellClick(cls) : undefined}
              style={{ cursor: onCellClick ? 'pointer' : 'default' }}
            >
              {cls}
            </div>
          );
        }),
      )}
    </div>
  );
}
