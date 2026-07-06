import { useApp } from '../../context/AppContext';
import { getGuestCategoryLabel } from '../../utils/guestCategories';

const CATEGORY_COLORS = {
  government: 'bg-info/20 text-info border-info/30',
  community: 'bg-success/20 text-success border-success/30',
  public: 'bg-secondary/20 text-secondary border-secondary/30',
  business: 'bg-accent/20 text-accent border-accent/30',
  media: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  vip: 'bg-warning/20 text-warning border-warning/30',
  sponsor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  other: 'bg-muted/20 text-muted border-muted/30',
};

const CUSTOM_COLOR = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';

export default function CategoryTag({ category, small }) {
  const { settings } = useApp();
  const label = getGuestCategoryLabel(category, settings);
  const isBuiltin = category && Object.prototype.hasOwnProperty.call(CATEGORY_COLORS, category);
  const color = isBuiltin ? CATEGORY_COLORS[category] : CUSTOM_COLOR;
  return (
    <span className={`inline-flex items-center border rounded-full font-medium ${small ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs'} ${color}`}>
      {label}
    </span>
  );
}
