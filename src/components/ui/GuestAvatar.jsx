import { useState } from 'react';
import { getInitials, getAvatarColor } from '../../utils/helpers';

const sizeMap = {
  sm: { box: 'w-10', aspect: 'aspect-[3/4]', text: 'text-sm', initials: 'w-10 h-10 text-sm rounded-full' },
  md: { box: 'w-14', aspect: 'aspect-[3/4]', text: 'text-lg', initials: 'w-14 h-14 text-lg rounded-full' },
  lg: { box: 'w-24', aspect: 'aspect-[3/4]', text: 'text-3xl', initials: 'w-24 h-24 text-3xl rounded-full' },
  xl: { box: 'w-32', aspect: 'aspect-[3/4]', text: 'text-4xl', initials: 'w-32 h-32 text-4xl rounded-full' },
};

export default function GuestAvatar({ guest, size = 'md', className = '' }) {
  const [imgError, setImgError] = useState(false);
  const cfg = sizeMap[size] || sizeMap.md;
  const name = guest?.name || '?';

  if (guest?.photo && !imgError) {
    return (
      <img
        src={guest.photo}
        alt={name}
        className={`${cfg.box} ${cfg.aspect} object-cover rounded-lg flex-shrink-0 ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${cfg.initials} flex items-center justify-center font-display font-bold flex-shrink-0 ${className}`}
      style={{ backgroundColor: getAvatarColor(name), color: '#0a0f1a' }}
    >
      {getInitials(name)}
    </div>
  );
}
