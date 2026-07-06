import { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ATTENDANCE_STATUS } from '../data/constants';
import { getPrimaryAffiliation, todayISO } from '../utils/helpers';
import { readInvitationExcel, resolveInvitationGuests } from '../utils/invitationImport';
import GuestAvatar from '../components/ui/GuestAvatar';
import CategoryTag from '../components/ui/CategoryTag';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { FormField, Input, Select, Textarea, EventSelect, CategoryFilterSelect } from '../components/ui/FormFields';

export default function Invitations() {
  const {
    events, guests, attendance, selectedEventId, setSelectedEventId,
    addGuestsToEvent, updateAttendance, removeFromEvent,
    bulkMarkInvited, bulkMarkAttending, bulkMarkDeclined, getGuestById,
    navigate, showToast, guestCategories,
  } = useApp();

  const importFileRef = useRef(null);
  const [importResult, setImportResult] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [selected, setSelected] = useState(new Set());
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [addSearch, setAddSearch] = useState('');
  const [addSelected, setAddSelected] = useState(new Set());

  const eventId = selectedEventId || events[0]?.id || '';
  const event = events.find((e) => e.id === eventId);
  const records = useMemo(() => {
    return attendance
      .filter((a) => a.eventId === eventId)
      .map((a) => ({ ...a, guest: getGuestById(a.guestId) }))
      .filter((r) => r.guest);
  }, [attendance, eventId, getGuestById]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = records.filter((r) => {
      const aff = getPrimaryAffiliation(r.guest);
      const matchQ = !q || r.guest.name?.toLowerCase().includes(q) || aff.organization?.toLowerCase().includes(q);
      const matchS = !statusFilter || r.status === statusFilter;
      const matchC = !categoryFilter || r.guest.category === categoryFilter;
      return matchQ && matchS && matchC;
    });
    list.sort((a, b) => {
      if (sortBy === 'category') return (a.guest.category || '').localeCompare(b.guest.category || '', 'zh-Hant');
      if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '');
      if (sortBy === 'org') return getPrimaryAffiliation(a.guest).organization.localeCompare(getPrimaryAffiliation(b.guest).organization, 'zh-Hant');
      return (a.guest.name || '').localeCompare(b.guest.name || '', 'zh-Hant');
    });
    return list;
  }, [records, search, statusFilter, categoryFilter, sortBy]);

  const existingGuestIds = new Set(records.map((r) => r.guestId));
  const availableGuests = guests.filter((g) => {
    if (existingGuestIds.has(g.id)) return false;
    const aff = getPrimaryAffiliation(g);
    const q = addSearch.toLowerCase();
    return !q || g.name?.toLowerCase().includes(q) || aff.organization?.toLowerCase().includes(q);
  });

  const toggleSelect = (guestId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(guestId)) next.delete(guestId); else next.add(guestId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.guestId)));
  };

  const selectedIds = [...selected];

  const handleBulk = (action) => {
    if (!selectedIds.length) return;
    if (action === 'invite') bulkMarkInvited(eventId, selectedIds);
    else if (action === 'attending') bulkMarkAttending(eventId, selectedIds);
    else if (action === 'declined') bulkMarkDeclined(eventId, selectedIds);
    else if (action === 'remove') removeFromEvent(eventId, selectedIds);
    setSelected(new Set());
  };

  const handleAddGuests = () => {
    addGuestsToEvent(eventId, [...addSelected]);
    setAddSelected(new Set());
    setAddModal(false);
  };

  const toggleAddSelect = (id) => {
    setAddSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleImportInvitationList = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !eventId) return;
    try {
      const invitationRows = await readInvitationExcel(file);
      if (!invitationRows.length) {
        showToast('找不到有效嘉賓（請確認 Excel 有「姓名」欄位）', 'warning');
        return;
      }

      const existingGuestIds = new Set(
        attendance.filter((a) => a.eventId === eventId).map((a) => a.guestId),
      );
      const { toAdd, notFound, alreadyInEvent, ambiguous } = resolveInvitationGuests(
        invitationRows,
        guests,
        existingGuestIds,
      );

      if (toAdd.length) {
        addGuestsToEvent(eventId, toAdd.map((r) => r.guestId), { silent: true });
      }

      setImportResult({ toAdd, notFound, alreadyInEvent, ambiguous, total: invitationRows.length });

      if (!toAdd.length && !notFound.length && !ambiguous.length && alreadyInEvent.length) {
        showToast('名單中嘉賓均已在活動中', 'info');
      } else if (toAdd.length && !notFound.length && !ambiguous.length) {
        showToast(`已匯入 ${toAdd.length} 位擬邀請嘉賓`, 'success');
      } else if (toAdd.length) {
        showToast(`已匯入 ${toAdd.length} 位，請查看未匹配名單`, 'warning');
      } else if (notFound.length || ambiguous.length) {
        showToast('無法自動加入任何嘉賓，請查看匯入結果', 'warning');
      }
    } catch {
      showToast('匯入失敗，請確認檔案為有效的 Excel 格式', 'error');
    }
    e.target.value = '';
  };

  if (!events.length) {
    return (
      <div className="page-container">
        <EmptyState icon="✉" title="尚無活動" description="請先建立活動，再管理嘉賓邀請" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">邀請與出席</h1>
          <p className="page-subtitle">管理活動嘉賓邀請狀態與出席記錄</p>
        </div>
      </div>

      <div className="mb-6 max-w-md">
        <FormField label="選擇活動">
          <EventSelect events={events} value={eventId} onChange={setSelectedEventId} />
        </FormField>
      </div>

      {event && (
        <div className="card p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-primary">{event.name}</p>
            <p className="text-sm text-muted">{event.date} · {event.venue}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => importFileRef.current?.click()} className="btn-secondary">
              ↑ 匯入擬邀請名單
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportInvitationList}
            />
            <button onClick={() => setAddModal(true)} className="btn-primary">＋ 添加嘉賓</button>
            <button onClick={() => navigate('seating', eventId)} className="btn-secondary">⊞ 活動排位</button>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <input className="input flex-1" placeholder="搜尋姓名或單位..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="lg:w-36">
          <option value="">全部狀態</option>
          {Object.entries(ATTENDANCE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <CategoryFilterSelect
          categories={guestCategories}
          value={categoryFilter}
          onChange={setCategoryFilter}
          className="lg:w-36"
        />
        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="lg:w-32">
          <option value="name">按姓名</option>
          <option value="category">按類別</option>
          <option value="org">按單位</option>
          <option value="status">按狀態</option>
        </Select>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-card rounded-xl border border-border">
          <span className="text-sm text-secondary self-center">已選 {selectedIds.length} 位</span>
          <button onClick={() => handleBulk('invite')} className="btn-secondary text-sm py-1.5">批量發函</button>
          <button onClick={() => handleBulk('attending')} className="btn-secondary text-sm py-1.5">批量出席</button>
          <button onClick={() => handleBulk('declined')} className="btn-secondary text-sm py-1.5">批量缺席</button>
          <button onClick={() => handleBulk('remove')} className="btn-danger text-sm py-1.5">批量移除</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon="✉" title="尚無邀請記錄" description="從嘉賓資料庫添加擬邀請嘉賓" action={<button onClick={() => setAddModal(true)} className="btn-primary">添加嘉賓</button>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="p-3 w-10"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                  <th className="p-3">嘉賓</th>
                  <th className="p-3 hidden md:table-cell">單位</th>
                  <th className="p-3">狀態</th>
                  <th className="p-3 hidden lg:table-cell">桌號</th>
                  <th className="p-3 w-20">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const aff = getPrimaryAffiliation(r.guest);
                  return (
                    <tr key={r.guestId} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                      <td className="p-3"><input type="checkbox" checked={selected.has(r.guestId)} onChange={() => toggleSelect(r.guestId)} /></td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <GuestAvatar guest={r.guest} size="sm" />
                          <div>
                            <p className="text-primary font-medium">{r.guest.name}</p>
                            <CategoryTag category={r.guest.category} small />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell text-secondary">{aff.organization}</td>
                      <td className="p-3"><StatusBadge status={r.status} /></td>
                      <td className="p-3 hidden lg:table-cell text-muted">{r.tableNo || '—'}</td>
                      <td className="p-3">
                        <button onClick={() => setEditModal(r)} className="text-accent hover:text-accent-hover text-sm">編輯</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={addModal} onClose={() => setAddModal(false)} title="添加嘉賓" wide>
        <input className="input mb-4" placeholder="搜尋嘉賓..." value={addSearch} onChange={(e) => setAddSearch(e.target.value)} />
        <div className="max-h-80 overflow-y-auto space-y-2 mb-4">
          {availableGuests.map((g) => {
            const aff = getPrimaryAffiliation(g);
            return (
              <label key={g.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-card-hover cursor-pointer">
                <input type="checkbox" checked={addSelected.has(g.id)} onChange={() => toggleAddSelect(g.id)} />
                <GuestAvatar guest={g} size="sm" />
                <div>
                  <p className="text-primary">{g.name}</p>
                  <p className="text-xs text-muted">{aff.organization}</p>
                </div>
              </label>
            );
          })}
          {availableGuests.length === 0 && <p className="text-muted text-center py-4">沒有可添加的嘉賓</p>}
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={() => setAddModal(false)} className="btn-secondary">取消</button>
          <button onClick={handleAddGuests} disabled={!addSelected.size} className="btn-primary disabled:opacity-50">添加 {addSelected.size} 位</button>
        </div>
      </Modal>

      {editModal && (
        <AttendanceEditModal
          record={editModal}
          eventId={eventId}
          onClose={() => setEditModal(null)}
          updateAttendance={updateAttendance}
        />
      )}

      {importResult && (
        <InvitationImportResultModal
          result={importResult}
          onClose={() => setImportResult(null)}
          onGoToGuests={() => { setImportResult(null); navigate('guests'); }}
        />
      )}
    </div>
  );
}

function InvitationImportResultModal({ result, onClose, onGoToGuests }) {
  const { toAdd, notFound, alreadyInEvent, ambiguous, total } = result;
  const hasIssues = notFound.length > 0 || ambiguous.length > 0;

  return (
    <Modal open onClose={onClose} title="匯入擬邀請名單結果" wide>
      <div className="space-y-4 text-sm">
        <p className="text-secondary">
          共讀取 <strong className="text-primary">{total}</strong> 位嘉賓
        </p>

        {toAdd.length > 0 && (
          <div className="p-3 rounded-xl bg-success/10 border border-success/20">
            <p className="font-medium text-success">已加入活動：{toAdd.length} 位</p>
            <ul className="mt-2 max-h-32 overflow-y-auto text-secondary space-y-0.5">
              {toAdd.map((r) => (
                <li key={r.guestId}>{r.name}{r.organization ? ` · ${r.organization}` : ''}</li>
              ))}
            </ul>
          </div>
        )}

        {alreadyInEvent.length > 0 && (
          <div className="p-3 rounded-xl bg-bg border border-border">
            <p className="font-medium text-primary">已在活動中（略過）：{alreadyInEvent.length} 位</p>
            <ul className="mt-2 max-h-24 overflow-y-auto text-muted space-y-0.5">
              {alreadyInEvent.map((r) => (
                <li key={`${r.guestId}-${r.name}`}>{r.name}</li>
              ))}
            </ul>
          </div>
        )}

        {notFound.length > 0 && (
          <div className="p-3 rounded-xl bg-warning/10 border border-warning/30">
            <p className="font-medium text-warning">資料庫中找不到：{notFound.length} 位</p>
            <p className="text-xs text-muted mt-1 mb-2">
              請先在「嘉賓資料庫」新增或匯入以下嘉賓，再重新匯入名單。
            </p>
            <ul className="max-h-40 overflow-y-auto text-secondary space-y-0.5">
              {notFound.map((r) => (
                <li key={r.name}>
                  <strong>{r.name}</strong>
                  {r.organization ? ` · ${r.organization}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {ambiguous.length > 0 && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/20">
            <p className="font-medium text-danger">姓名重複，無法自動匹配：{ambiguous.length} 位</p>
            <p className="text-xs text-muted mt-1 mb-2">請在 Excel 加上「所屬單位」欄，或手動添加嘉賓。</p>
            <ul className="max-h-32 overflow-y-auto text-secondary space-y-0.5">
              {ambiguous.map((r) => (
                <li key={r.name}>
                  {r.name}{r.organization ? ` · ${r.organization}` : ''}（{r.matchCount} 位同名）
                </li>
              ))}
            </ul>
          </div>
        )}

        {!hasIssues && toAdd.length === 0 && alreadyInEvent.length > 0 && (
          <p className="text-muted">名單中的嘉賓均已在目前活動中。</p>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-3 mt-6">
        {notFound.length > 0 && (
          <button type="button" onClick={onGoToGuests} className="btn-secondary">
            前往嘉賓資料庫
          </button>
        )}
        <button type="button" onClick={onClose} className="btn-primary">關閉</button>
      </div>
    </Modal>
  );
}

function AttendanceEditModal({ record, eventId, onClose, updateAttendance }) {
  const [form, setForm] = useState({ ...record });

  const handleSave = () => {
    const { guest, ...updates } = form;
    updateAttendance(eventId, record.guestId, updates);
    onClose();
  };

  const setStatus = (status) => {
    const updates = { status };
    const today = todayISO();
    if (['pending_reply', 'invited'].includes(status) && !form.invitedDate) updates.invitedDate = today;
    if (['attending', 'declined'].includes(status) && !form.respondedDate) updates.respondedDate = today;
    if (status === 'checked_in' && !form.checkedInAt) updates.checkedInAt = new Date().toISOString();
    setForm((f) => ({ ...f, ...updates }));
  };

  return (
    <Modal open onClose={onClose} title={`編輯 — ${record.guest?.name}`} wide>
      <div className="grid sm:grid-cols-2 gap-4">
        <FormField label="出席狀態">
          <Select value={form.status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(ATTENDANCE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </FormField>
        <FormField label="發函日期"><Input type="date" value={form.invitedDate?.split('T')[0] || ''} onChange={(e) => setForm({ ...form, invitedDate: e.target.value })} /></FormField>
        <FormField label="回覆日期"><Input type="date" value={form.respondedDate?.split('T')[0] || ''} onChange={(e) => setForm({ ...form, respondedDate: e.target.value })} /></FormField>
        <FormField label="桌號"><Input value={form.tableNo} onChange={(e) => setForm({ ...form, tableNo: e.target.value })} /></FormField>
        <FormField label="座位"><Input value={form.seatNo} onChange={(e) => setForm({ ...form, seatNo: e.target.value })} /></FormField>
        <FormField label="陪同人數"><Input type="number" min="0" value={form.companionCount} onChange={(e) => setForm({ ...form, companionCount: parseInt(e.target.value) || 0 })} /></FormField>
      </div>
      <FormField label="飲食備註"><Textarea value={form.dietaryNotes} onChange={(e) => setForm({ ...form, dietaryNotes: e.target.value })} /></FormField>
      <FormField label="VIP 備註"><Textarea value={form.vipNotes} onChange={(e) => setForm({ ...form, vipNotes: e.target.value })} /></FormField>
      <FormField label="內部備註"><Textarea value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} /></FormField>
      <div className="flex justify-end gap-3 mt-4">
        <button onClick={onClose} className="btn-secondary">取消</button>
        <button onClick={handleSave} className="btn-primary">儲存</button>
      </div>
    </Modal>
  );
}
