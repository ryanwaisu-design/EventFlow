import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getPrimaryAffiliation } from '../utils/helpers';
import { exportRecognitionWord } from '../utils/export';
import {
  findGuestsWithStalePhotoSource,
  formatStalePhotoSourceMessage,
} from '../utils/photoSource';
import GuestAvatar from '../components/ui/GuestAvatar';
import CategoryTag from '../components/ui/CategoryTag';
import EmptyState from '../components/ui/EmptyState';
import ActionDialog from '../components/ui/ActionDialog';
import { FormField, EventSelect, Input } from '../components/ui/FormFields';

const QUICK_FILTERS = [
  { key: '', label: '全部' },
  { key: 'vip', label: 'VIP' },
  { key: 'government', label: '政府' },
  { key: 'media', label: '媒體' },
  { key: 'business', label: '商業' },
];

export default function Recognition() {
  const { events, guests, attendance, selectedEventId, setSelectedEventId, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [printMode, setPrintMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [stalePhotoDialog, setStalePhotoDialog] = useState(null);

  const eventId = selectedEventId || events[0]?.id || '';
  const event = events.find((e) => e.id === eventId);
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
      const aff = getPrimaryAffiliation(r.guest);
      const matchQ = !q || r.guest.name?.toLowerCase().includes(q) || aff.organization?.toLowerCase().includes(q);
      const matchC = !categoryFilter || r.guest.category === categoryFilter;
      return matchQ && matchC;
    });
  }, [records, search, categoryFilter]);

  useEffect(() => {
    setSelected(new Set());
  }, [eventId]);

  const selectedIds = useMemo(() => [...selected], [selected]);

  const toggleSelect = (guestId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(guestId)) next.delete(guestId);
      else next.add(guestId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.guestId)));
    }
  };

  const runRecognitionExport = async (guestIds) => {
    showToast('正在產生 Word 檔案…', 'info');
    await exportRecognitionWord(event, guests, attendance, { guestIds });
    showToast(`已匯出 ${guestIds.length} 位嘉賓的認人名單`, 'success');
  };

  const handleExportWord = async () => {
    if (!event) { showToast('請選擇活動', 'warning'); return; }
    if (selectedIds.length === 0) {
      showToast('請先勾選要匯出的嘉賓', 'warning');
      return;
    }
    try {
      const stale = findGuestsWithStalePhotoSource(guests, { guestIds: selectedIds });
      if (stale.length) {
        setStalePhotoDialog({ guestIds: selectedIds, stale });
        return;
      }
      await runRecognitionExport(selectedIds);
    } catch (e) {
      showToast(e.message || '匯出失敗', 'error');
    }
  };

  const handlePrint = () => {
    setPrintMode(true);
    setTimeout(() => { window.print(); setPrintMode(false); }, 100);
  };

  if (!events.length) {
    return <div className="page-container"><EmptyState icon="👁" title="尚無活動" description="請先建立活動" /></div>;
  }

  return (
    <div className={`page-container ${printMode ? 'print-mode' : ''}`}>
      {!printMode && (
        <>
          <div className="page-header no-print">
            <div>
              <h1 className="page-title">現場認人名單</h1>
              <p className="page-subtitle">協助接待、司儀及工作人員快速認出重要嘉賓</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handlePrint} className="btn-secondary">列印</button>
              <button
                onClick={handleExportWord}
                className="btn-primary"
                disabled={selectedIds.length === 0}
              >
                匯出 Word{selectedIds.length > 0 ? `（${selectedIds.length}）` : ''}
              </button>
            </div>
          </div>

          <div className="mb-6 max-w-md no-print">
            <FormField label="選擇活動">
              <EventSelect events={events} value={eventId} onChange={setSelectedEventId} />
            </FormField>
          </div>

          <div className="flex flex-wrap gap-2 mb-4 no-print">
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setCategoryFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                  categoryFilter === f.key ? 'bg-accent/20 border-accent text-accent' : 'border-border text-secondary hover:border-accent/50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Input className="mb-4 no-print" placeholder="搜尋姓名或單位..." value={search} onChange={(e) => setSearch(e.target.value)} />

          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
              <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-accent"
                  checked={selected.size === filtered.length}
                  onChange={toggleAll}
                />
                全選目前列表（{filtered.length}）
              </label>
              {selectedIds.length > 0 && (
                <span className="text-sm text-accent">已選 {selectedIds.length} 位</span>
              )}
            </div>
          )}
        </>
      )}

      {printMode && event && (
        <div className="print-header mb-6 text-center">
          <h1 className="text-2xl font-bold">認人名單 — {event.name}</h1>
          <p className="text-gray-600">{event.date} · {event.venue}</p>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon="👁" title="沒有確認出席的嘉賓" description="請先在邀請與出席頁面確認嘉賓出席狀態" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((r) => {
            const aff = getPrimaryAffiliation(r.guest);
            const isSelected = selected.has(r.guestId);
            return (
              <div
                key={r.guestId}
                className={`card p-5 text-center recognition-card relative cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-accent border-accent/50' : ''
                }`}
                onClick={() => toggleSelect(r.guestId)}
              >
                <label
                  className="absolute top-3 left-3 no-print"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-accent"
                    checked={isSelected}
                    onChange={() => toggleSelect(r.guestId)}
                  />
                </label>
                <div className="flex justify-center mb-3">
                  <GuestAvatar guest={r.guest} size="xl" />
                </div>
                <h3 className="text-xl font-bold text-primary">{r.guest.name}</h3>
                <div className="mt-2 flex justify-center"><CategoryTag category={r.guest.category} /></div>
                <p className="text-sm text-secondary mt-3">{aff.organization}</p>
                <p className="text-sm text-muted">{aff.title}</p>
                {(r.tableNo || r.seatNo) && (
                  <p className="text-sm text-accent mt-2 font-medium">桌 {r.tableNo || '—'} / 座 {r.seatNo || '—'}</p>
                )}
                {r.vipNotes && <p className="text-xs text-warning mt-2">{r.vipNotes}</p>}
              </div>
            );
          })}
        </div>
      )}

      <ActionDialog
        open={!!stalePhotoDialog}
        onClose={() => setStalePhotoDialog(null)}
        title="相片來源日期提醒"
        message={stalePhotoDialog ? formatStalePhotoSourceMessage(stalePhotoDialog.stale) : ''}
        actions={[
          {
            label: '仍要匯出',
            variant: 'primary',
            onClick: async () => {
              if (!stalePhotoDialog) return;
              try {
                await runRecognitionExport(stalePhotoDialog.guestIds);
              } catch (e) {
                showToast(e.message || '匯出失敗', 'error');
              }
            },
          },
          { label: '取消', variant: 'secondary', onClick: () => {} },
        ]}
      />
    </div>
  );
}
