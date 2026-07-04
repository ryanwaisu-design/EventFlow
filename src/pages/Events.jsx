import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { EVENT_TYPES } from '../data/constants';
import { formatDate } from '../utils/helpers';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { FormField, Input, Select, Textarea } from '../components/ui/FormFields';

const emptyEvent = (defaultOwner) => ({
  name: '', date: '', startTime: '', endTime: '',
  venue: '', address: '', eventType: 'other',
  organizer: '', owner: defaultOwner || '', isRsvpRequired: true, notes: '',
});

export default function Events() {
  const { events, attendance, settings, addEvent, updateEvent, deleteEvent, duplicateEvent, navigate } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyEvent(settings.defaultOwner));
  const [deleteId, setDeleteId] = useState(null);

  const getStats = (eventId) => {
    const att = attendance.filter((a) => a.eventId === eventId);
    return {
      total: att.length,
      invited: att.filter((a) => a.invitedDate).length,
      pendingReply: att.filter((a) => a.status === 'pending_reply').length,
      attending: att.filter((a) => ['attending', 'checked_in'].includes(a.status)).length,
      declined: att.filter((a) => a.status === 'declined').length,
    };
  };

  const openAdd = () => { setEditing(null); setForm(emptyEvent(settings.defaultOwner)); setModalOpen(true); };
  const openEdit = (ev) => { setEditing(ev); setForm({ ...ev }); setModalOpen(true); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.date) return;
    if (editing) updateEvent(editing.id, form);
    else addEvent(form);
    setModalOpen(false);
  };

  const sorted = [...events].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">活動管理</h1>
          <p className="page-subtitle">建立與管理公關活動</p>
        </div>
        <button onClick={openAdd} className="btn-primary">＋ 新增活動</button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon="◇" title="尚無活動" description="建立第一個活動，開始管理嘉賓邀請流程" action={<button onClick={openAdd} className="btn-primary">新增活動</button>} />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {sorted.map((ev) => {
            const st = getStats(ev.id);
            const isPast = new Date(ev.date) < new Date(new Date().toDateString());
            return (
              <div key={ev.id} className="card p-5 hover:border-accent/30 transition-all">
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div>
                    <h3 className="font-semibold text-primary text-lg">{ev.name}</h3>
                    <p className="text-sm text-muted mt-1">{formatDate(ev.date)} {ev.startTime && `· ${ev.startTime}`}</p>
                    <p className="text-sm text-secondary mt-1">{ev.venue}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${isPast ? 'bg-muted/20 text-muted' : 'bg-success/20 text-success'}`}>
                    {isPast ? '已結束' : '即將舉行'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent">{EVENT_TYPES[ev.eventType]}</span>
                  {ev.isRsvpRequired && <span className="text-xs px-2 py-1 rounded-full bg-info/20 text-info">需 RSVP</span>}
                </div>
                <div className="grid grid-cols-5 gap-2 text-center text-xs mb-4">
                  <div><p className="text-muted">擬邀</p><p className="font-display text-lg text-primary">{st.total}</p></div>
                  <div><p className="text-muted">已發函</p><p className="font-display text-lg text-info">{st.invited}</p></div>
                  <div><p className="text-muted">待回覆</p><p className="font-display text-lg text-warning">{st.pendingReply}</p></div>
                  <div><p className="text-muted">出席</p><p className="font-display text-lg text-success">{st.attending}</p></div>
                  <div><p className="text-muted">缺席</p><p className="font-display text-lg text-danger">{st.declined}</p></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => navigate('invitations', ev.id)} className="btn-primary text-sm py-2">邀請管理</button>
                  <button onClick={() => openEdit(ev)} className="btn-secondary text-sm py-2">編輯</button>
                  <button onClick={() => duplicateEvent(ev.id)} className="btn-secondary text-sm py-2">複製</button>
                  <button onClick={() => setDeleteId(ev.id)} className="btn-danger text-sm py-2">刪除</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '編輯活動' : '新增活動'} wide>
        <form onSubmit={handleSubmit}>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="活動名稱" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></FormField>
            <FormField label="活動日期" required><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></FormField>
            <FormField label="開始時間"><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></FormField>
            <FormField label="結束時間"><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></FormField>
            <FormField label="活動類型">
              <Select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}>
                {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </FormField>
            <FormField label="主辦單位"><Input value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} /></FormField>
            <FormField label="地點"><Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></FormField>
            <FormField label="負責人"><Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></FormField>
          </div>
          <FormField label="地址"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></FormField>
          <FormField label="備註"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormField>
          <label className="flex items-center gap-2 mb-6 cursor-pointer">
            <input type="checkbox" checked={form.isRsvpRequired} onChange={(e) => setForm({ ...form, isRsvpRequired: e.target.checked })} className="w-4 h-4 accent-accent" />
            <span className="text-sm text-secondary">需要 RSVP 回覆</span>
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">取消</button>
            <button type="submit" className="btn-primary">儲存</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteEvent(deleteId)} title="確認刪除活動" message="刪除活動將同時移除所有邀請記錄，此操作無法復原。" confirmLabel="刪除" danger />
    </div>
  );
}
