import { ATTENDANCE_STATUS, STATUS_COLORS } from '../../data/constants';

export default function StatusBadge({ status }) {
  const label = ATTENDANCE_STATUS[status] || status || '—';
  const color = STATUS_COLORS[status] || 'bg-muted/20 text-muted';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
