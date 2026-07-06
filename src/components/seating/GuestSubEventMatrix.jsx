import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { getPrimaryAffiliation } from '../../utils/helpers';
import GuestAvatar from '../ui/GuestAvatar';
import { getGuestSubEventAttendeeCount } from '../../seating/adapters/planSubEvent';
import { useSeatingWorkspaceStore } from '../../seating/store/seatingWorkspaceStore';

export default function GuestSubEventMatrix({ eventId, guests }) {
  const { attendance } = useApp();
  const plan = useSeatingWorkspaceStore((s) => s.plan);
  const setGuestSubEvents = useSeatingWorkspaceStore((s) => s.setGuestSubEvents);
  const setGuestSubEventAttendeeCount = useSeatingWorkspaceStore((s) => s.setGuestSubEventAttendeeCount);
  const setGuestVipEligible = useSeatingWorkspaceStore((s) => s.setGuestVipEligible);
  const toggleSubEventForAllGuests = useSeatingWorkspaceStore((s) => s.toggleSubEventForAllGuests);

  const subEvents = plan?.subEvents ?? [];

  const attendingGuests = useMemo(() => {
    const ids = new Set(
      attendance
        .filter((a) => a.eventId === eventId && ['attending', 'checked_in'].includes(a.status))
        .map((a) => a.guestId),
    );
    return guests.filter((g) => ids.has(g.id));
  }, [attendance, eventId, guests]);

  if (!plan || subEvents.length === 0 || attendingGuests.length === 0) {
    return (
      <p className="text-sm text-muted">
        {attendingGuests.length === 0
          ? '請先在「邀請與出席」確認嘉賓出席，再勾選各子活動的參與名單。'
          : '尚無子活動。'}
      </p>
    );
  }

  const isAllSelectedForSub = (subId) =>
    attendingGuests.length > 0 &&
    attendingGuests.every((g) => {
      const sub = subEvents.find((s) => s.id === subId);
      return sub?.participantGuestIds.includes(g.id);
    });

  const handleToggleGuest = (guestId, subId, checked) => {
    const current = subEvents
      .filter((s) => s.participantGuestIds.includes(guestId))
      .map((s) => s.id);
    const next = checked
      ? [...new Set([...current, subId])]
      : current.filter((id) => id !== subId);
    setGuestSubEvents(guestId, next);
  };

  const handleAttendeeCountChange = (guestId, subId, rawValue) => {
    const parsed = Math.max(1, Math.floor(Number(rawValue)) || 1);
    setGuestSubEventAttendeeCount(guestId, subId, parsed);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[520px]">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="p-2 font-medium">嘉賓</th>
            {subEvents.map((sub) => (
              <th key={sub.id} className="p-2 font-medium text-center min-w-[96px]">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs leading-tight">{sub.name || '子活動'}</span>
                  <span className="text-[10px] text-muted">出席人數</span>
                  {sub.vipLounge?.enabled && (
                    <span className="text-[10px] text-muted">VIP</span>
                  )}
                  <button
                    type="button"
                    className="text-[10px] text-accent hover:underline"
                    onClick={() => toggleSubEventForAllGuests(sub.id, !isAllSelectedForSub(sub.id))}
                  >
                    {isAllSelectedForSub(sub.id) ? '取消全選' : '全選'}
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attendingGuests.map((guest) => {
            const aff = getPrimaryAffiliation(guest);
            return (
              <tr key={guest.id} className="border-b border-border/50 hover:bg-card-hover/50">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <GuestAvatar guest={guest} size="sm" />
                    <div>
                      <p className="font-medium text-primary">{guest.name}</p>
                      <p className="text-xs text-muted truncate max-w-[180px]">{aff.organization}</p>
                    </div>
                  </div>
                </td>
                {subEvents.map((sub) => {
                  const participates = sub.participantGuestIds.includes(guest.id);
                  const attendeeCount = getGuestSubEventAttendeeCount(sub, guest.id);
                  const vipEligible = sub.participations?.[guest.id]?.vipEligible ?? false;
                  return (
                    <td key={sub.id} className="p-2 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-accent"
                          checked={participates}
                          onChange={(e) => handleToggleGuest(guest.id, sub.id, e.target.checked)}
                          aria-label={`${guest.name} 出席 ${sub.name || '子活動'}`}
                        />
                        {participates && (
                          <label className="flex items-center gap-1 text-[10px] text-muted">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              className="w-12 rounded border border-border bg-background px-1 py-0.5 text-center text-xs text-primary"
                              value={attendeeCount}
                              onChange={(e) => handleAttendeeCountChange(guest.id, sub.id, e.target.value)}
                              aria-label={`${guest.name} 在 ${sub.name || '子活動'} 的出席人數`}
                            />
                            <span>人</span>
                          </label>
                        )}
                        {participates && sub.vipLounge?.enabled && (
                          <label className="flex items-center gap-1 text-[10px] text-muted">
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 accent-accent"
                              checked={vipEligible}
                              onChange={(e) => setGuestVipEligible(guest.id, sub.id, e.target.checked)}
                              aria-label={`${guest.name} VIP 休息室 ${sub.name || '子活動'}`}
                            />
                            <span>VIP</span>
                          </label>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
