import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getPrimaryAffiliation, formatDateTime } from '../utils/helpers';
import GuestAvatar from '../components/ui/GuestAvatar';
import CategoryTag from '../components/ui/CategoryTag';
import EmptyState from '../components/ui/EmptyState';
import { FormField, EventSelect, Input } from '../components/ui/FormFields';

export default function CheckIn() {
  const { events, guests, attendance, selectedEventId, setSelectedEventId, checkInGuest } = useApp();
  const [search, setSearch] = useState('');

  const eventId = selectedEventId || events[0]?.id || '';
  const guestMap = useMemo(() => Object.fromEntries(guests.map((g) => [g.id, g])), [guests]);

  const records = useMemo(() => {
    return attendance
      .filter((a) => a.eventId === eventId && ['attending', 'checked_in'].includes(a.status))
      .map((a) => ({ ...a, guest: guestMap[a.guestId] }))
      .filter((r) => r.guest);
  }, [attendance, eventId, guestMap]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((r) => {
      if (!q) return true;
      const aff = getPrimaryAffiliation(r.guest);
      return (
        r.guest.name?.toLowerCase().includes(q) ||
        aff.organization?.toLowerCase().includes(q) ||
        r.guest.phone?.includes(q)
      );
    });
  }, [records, search]);

  const confirmed = records.length;
  const checkedIn = records.filter((r) => r.status === 'checked_in').length;
  const notCheckedIn = confirmed - checkedIn;

  if (!events.length) {
    return <div className="page-container"><EmptyState icon="✓" title="尚無活動" description="請先建立活動" /></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">簽到模式</h1>
          <p className="page-subtitle">現場快速簽到，適合手機與平板操作</p>
        </div>
      </div>

      <div className="mb-6 max-w-md">
        <FormField label="選擇活動">
          <EventSelect events={events} value={eventId} onChange={setSelectedEventId} />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card text-center">
          <p className="text-muted text-xs">確認出席</p>
          <p className="font-display text-3xl font-bold text-info">{confirmed}</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-muted text-xs">已簽到</p>
          <p className="font-display text-3xl font-bold text-success">{checkedIn}</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-muted text-xs">未簽到</p>
          <p className="font-display text-3xl font-bold text-warning">{notCheckedIn}</p>
        </div>
      </div>

      <Input className="mb-6" placeholder="搜尋姓名、單位或電話..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {filtered.length === 0 ? (
        <EmptyState icon="✓" title="沒有確認出席的嘉賓" description="請先在邀請與出席頁面標記嘉賓為確認出席" />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const aff = getPrimaryAffiliation(r.guest);
            const isCheckedIn = r.status === 'checked_in';
            return (
              <div key={r.guestId} className={`card p-4 flex items-center gap-4 ${isCheckedIn ? 'border-success/30' : ''}`}>
                <GuestAvatar guest={r.guest} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-primary">{r.guest.name}</p>
                  <p className="text-sm text-secondary">{aff.organization}</p>
                  <p className="text-xs text-muted">{aff.title}</p>
                  {isCheckedIn && (
                    <p className="text-sm text-success mt-1">已簽到 · {formatDateTime(r.checkedInAt)}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <CategoryTag category={r.guest.category} subcategory={r.guest.subcategory} small />
                  {!isCheckedIn ? (
                    <button
                      onClick={() => checkInGuest(eventId, r.guestId)}
                      className="px-6 py-3 bg-success hover:bg-success/80 text-white font-semibold rounded-xl text-lg transition-all active:scale-95"
                    >
                      簽到
                    </button>
                  ) : (
                    <span className="px-4 py-2 bg-success/20 text-success rounded-xl font-medium">✓ 已簽到</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
