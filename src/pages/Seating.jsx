import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { toSeatingGuests } from '../seating/adapters/guestAdapter';
import { createEmptyPlan, normalizePlan } from '../seating/adapters/planAdapter';
import { useSeatingWorkspaceStore } from '../seating/store/seatingWorkspaceStore';
import EmptyState from '../components/ui/EmptyState';
import { FormField, EventSelect } from '../components/ui/FormFields';
import SeatingSetup from './SeatingSetup';
import SeatingDashboard from './SeatingDashboard';

export default function Seating() {
  const {
    events,
    guests,
    selectedEventId,
    setSelectedEventId,
    getSeatingPlan,
    syncSeatingParticipants,
    upsertSeatingPlan,
    navigate,
  } = useApp();

  const hydrate = useSeatingWorkspaceStore((s) => s.hydrate);
  const workspacePlan = useSeatingWorkspaceStore((s) => s.plan);
  const [view, setView] = useState('setup');

  const eventId = useMemo(() => {
    const preferred = selectedEventId || events[0]?.id || '';
    if (preferred && events.some((e) => e.id === preferred)) return preferred;
    return events[0]?.id || '';
  }, [selectedEventId, events]);
  const event = events.find((e) => e.id === eventId);

  const persistedPlan = useMemo(() => getSeatingPlan(eventId), [getSeatingPlan, eventId]);

  useEffect(() => {
    if (!eventId || !event) return;
    let plan = persistedPlan || syncSeatingParticipants(eventId);
    plan = normalizePlan(plan, event) || createEmptyPlan(eventId, event);
    if (!plan.participantGuestIds?.length) {
      const synced = syncSeatingParticipants(eventId);
      plan = normalizePlan(synced, event) || plan;
    }
    const seatingGuests = toSeatingGuests(guests, plan.participantGuestIds);
    hydrate(plan, seatingGuests);
    setView(plan.step === 'dashboard' ? 'dashboard' : 'setup');
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!workspacePlan || workspacePlan.eventId !== eventId) return;
    const t = setTimeout(() => {
      upsertSeatingPlan(workspacePlan);
    }, 500);
    return () => clearTimeout(t);
  }, [workspacePlan, eventId, upsertSeatingPlan]);

  if (!events.length) {
    return (
      <div className="page-container">
        <EmptyState icon="⊞" title="尚無活動" description="請先建立活動，再進行排位" />
      </div>
    );
  }

  if (!event || !workspacePlan || workspacePlan.eventId !== eventId) {
    return (
      <div className="page-container">
        <EmptyState icon="⊞" title="載入中…" description="正在準備排位方案" />
      </div>
    );
  }

  return (
    <div className={`page-container seating-module${view === 'dashboard' ? ' seating-dashboard-view' : ''}`}>
      <div className="page-header">
        <div>
          <h1 className="page-title">活動排位</h1>
          <p className="page-subtitle">配置會場布局，安排嘉賓座位</p>
        </div>
      </div>

      <div className="mb-6 max-w-md">
        <FormField label="選擇活動">
          <EventSelect events={events} value={eventId} onChange={setSelectedEventId} />
        </FormField>
      </div>

      {view === 'dashboard' ? (
        <SeatingDashboard
          event={event}
          onBackToSetup={() => setView('setup')}
        />
      ) : (
        <SeatingSetup
          event={event}
          plan={workspacePlan}
          guests={guests}
          onEnterDashboard={() => setView('dashboard')}
        />
      )}

      <div className="mt-8 pt-4 border-t border-border text-center">
        <button type="button" className="btn-secondary text-sm" onClick={() => navigate('invitations', eventId)}>
          ← 返回邀請與出席
        </button>
      </div>
    </div>
  );
}
