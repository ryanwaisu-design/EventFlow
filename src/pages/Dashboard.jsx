import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/helpers';
import { EVENT_TYPES } from '../data/constants';
import EmptyState from '../components/ui/EmptyState';

export default function Dashboard() {
  const { guests, events, attendance, settings, navigate } = useApp();
  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  const pendingInvite = attendance.filter((a) => a.status === 'pending_invite').length;
  const pendingReply = attendance.filter((a) => a.status === 'pending_reply').length;
  const attending = attendance.filter((a) => ['attending', 'checked_in'].includes(a.status)).length;
  const declined = attendance.filter((a) => a.status === 'declined').length;

  const sortedEvents = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcoming = sortedEvents.filter((e) => new Date(e.date) >= new Date(new Date().toDateString()));
  const recent = [...events].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);

  const stats = [
    { label: '總嘉賓數', value: guests.length, color: 'text-info' },
    { label: '活動數量', value: events.length, color: 'text-accent' },
    { label: '待發邀請', value: pendingInvite, color: 'text-warning' },
    { label: '待回覆', value: pendingReply, color: 'text-warning' },
    { label: '已確認出席', value: attending, color: 'text-success' },
    { label: '缺席 / 婉拒', value: declined, color: 'text-danger' },
  ];

  const getEventStats = (eventId) => {
    const att = attendance.filter((a) => a.eventId === eventId);
    return {
      total: att.length,
      invited: att.filter((a) => a.invitedDate).length,
      pending: att.filter((a) => a.status === 'pending_reply').length,
      attending: att.filter((a) => ['attending', 'checked_in'].includes(a.status)).length,
    };
  };

  const isEmpty = guests.length === 0 && events.length === 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">歡迎回來</h1>
          <p className="page-subtitle">{settings.organizationName} · {today}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <p className="text-muted text-xs mb-1">{s.label}</p>
            <p className={`font-display text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <button onClick={() => navigate('guests')} className="btn-primary">＋ 新增嘉賓</button>
        <button onClick={() => navigate('events')} className="btn-secondary">＋ 新增活動</button>
        <button onClick={() => navigate('guests')} className="btn-secondary">↑ 匯入嘉賓</button>
        <button onClick={() => navigate('export')} className="btn-secondary">↓ 匯出名單</button>
      </div>

      {isEmpty ? (
        <EmptyState
          icon="◈"
          title="尚無資料"
          description="開始建立嘉賓資料庫與活動，或啟用示範資料快速體驗系統功能。"
          action={<button onClick={() => navigate('guests')} className="btn-primary">建立第一位嘉賓</button>}
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="card p-6">
            <h2 className="section-title mb-4">即將舉行活動</h2>
            {upcoming.length === 0 ? (
              <p className="text-muted text-sm">暫無即將舉行的活動</p>
            ) : (
              <div className="space-y-3">
                {upcoming.slice(0, 5).map((ev) => {
                  const st = getEventStats(ev.id);
                  return (
                    <button key={ev.id} onClick={() => navigate('invitations', ev.id)} className="w-full text-left p-4 rounded-xl bg-bg hover:bg-card-hover border border-border transition-all">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-medium text-primary">{ev.name}</p>
                          <p className="text-sm text-muted mt-1">{formatDate(ev.date)} · {ev.venue}</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent">{EVENT_TYPES[ev.eventType]}</span>
                      </div>
                      <div className="flex gap-4 mt-3 text-xs text-secondary">
                        <span>擬邀 {st.total}</span>
                        <span>已發函 {st.invited}</span>
                        <span>待回覆 {st.pending}</span>
                        <span className="text-success">出席 {st.attending}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="section-title mb-4">最近活動</h2>
            {recent.length === 0 ? (
              <p className="text-muted text-sm">暫無活動記錄</p>
            ) : (
              <div className="space-y-3">
                {recent.map((ev) => (
                  <button key={ev.id} onClick={() => navigate('events')} className="w-full text-left p-4 rounded-xl bg-bg hover:bg-card-hover border border-border transition-all">
                    <p className="font-medium text-primary">{ev.name}</p>
                    <p className="text-sm text-muted mt-1">{formatDate(ev.date)} · {EVENT_TYPES[ev.eventType]}</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
