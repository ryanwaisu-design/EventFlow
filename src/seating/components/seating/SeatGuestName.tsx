import { memo } from 'react';
import { formatSeatGuestName, nameFontClass } from '../../utils/rankOrder';

interface SeatGuestNameProps {
  name: string;
  className?: string;
}

function SeatGuestName({ name, className }: SeatGuestNameProps) {
  const lines = formatSeatGuestName(name);
  return (
    <span
      className={[
        className ?? 'seat-name',
        nameFontClass(name),
        lines.length > 1 ? 'seat-name-multiline' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {lines.map((line, i) => (
        <span key={i} className="seat-name-line">
          {line}
        </span>
      ))}
    </span>
  );
}

export default memo(SeatGuestName);
