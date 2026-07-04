import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  exportAttendanceExcel,
  exportGuestDatabaseExcel,
  exportLabelMergeExcel,
  exportRecognitionWord,
  EXPORT_FILTERS,
} from '../utils/export';
import { exportBackup } from '../data/storage';
import { downloadText } from '../utils/helpers';
import { FormField, EventSelect } from '../components/ui/FormFields';

const EXPORT_ITEMS = [
  { key: 'all', type: 'attendance' },
  { key: 'draft', type: 'attendance' },
  { key: 'pending_invite', type: 'attendance' },
  { key: 'invited', type: 'attendance' },
  { key: 'pending_reply', type: 'attendance' },
  { key: 'attending', type: 'attendance' },
  { key: 'declined', type: 'attendance' },
  { key: 'checked_in', type: 'attendance' },
];

export default function ExportCenter() {
  const { events, guests, attendance, seatingPlans, settings, showToast } = useApp();
  const [eventId, setEventId] = useState(events[0]?.id || '');

  const event = events.find((e) => e.id === eventId);
  const prefix = settings.exportPrefix || 'EventFlow';

  const handleAttendanceExport = (key) => {
    if (!event) { showToast('請先選擇活動', 'warning'); return; }
    const cfg = EXPORT_FILTERS[key];
    if (!cfg) return;
    try {
      exportAttendanceExcel(event, guests, attendance, cfg.filter, cfg.label, prefix);
      showToast(`${cfg.label}已匯出`, 'success');
    } catch (e) {
      showToast(e.message || '匯出失敗', 'error');
    }
  };

  const handleLabelExport = () => {
    if (!event) { showToast('請先選擇活動', 'warning'); return; }
    try {
      exportLabelMergeExcel(event, guests, attendance, prefix);
      showToast('標籤合併列印檔案已匯出', 'success');
    } catch (e) {
      showToast(e.message || '匯出失敗', 'error');
    }
  };

  const handleWordExport = async () => {
    if (!event) { showToast('請先選擇活動', 'warning'); return; }
    try {
      showToast('正在產生 Word 檔案…', 'info');
      await exportRecognitionWord(event, guests, attendance);
      showToast('認人名單已匯出', 'success');
    } catch (e) {
      showToast(e.message || '匯出失敗', 'error');
    }
  };

  const handleGuestExport = () => {
    try {
      exportGuestDatabaseExcel(guests, prefix);
      showToast('嘉賓資料庫已匯出', 'success');
    } catch (e) {
      showToast(e.message || '匯出失敗', 'error');
    }
  };

  const handleJsonBackup = () => {
    const json = exportBackup({ guests, events, attendance, seatingPlans, settings });
    downloadText(json, `${prefix}_備份_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    showToast('備份已下載', 'success');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">匯出中心</h1>
          <p className="page-subtitle">匯出各類名單、認人表與資料備份</p>
        </div>
      </div>

      <div className="mb-8 max-w-md">
        <FormField label="選擇活動（活動相關匯出）">
          <EventSelect events={events} value={eventId} onChange={setEventId} allowEmpty emptyLabel="請選擇活動" />
        </FormField>
        {event && <p className="text-sm text-muted mt-1">{event.name} · {event.date}</p>}
      </div>

      <section className="mb-8">
        <h2 className="section-title mb-4">活動名單匯出（Excel）</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {EXPORT_ITEMS.map(({ key }) => (
            <button key={key} onClick={() => handleAttendanceExport(key)} className="card p-4 text-left hover:border-accent/40 transition-all group">
              <p className="text-primary font-medium group-hover:text-accent transition-colors">{EXPORT_FILTERS[key].label}</p>
              <p className="text-xs text-muted mt-1">.xlsx 格式</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="section-title mb-4">其他匯出</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button onClick={handleLabelExport} className="card p-4 text-left hover:border-accent/40 transition-all">
            <p className="text-primary font-medium">標籤合併列印</p>
            <p className="text-xs text-muted mt-1">Excel 格式，適合郵寄標籤</p>
          </button>
          <button onClick={handleWordExport} className="card p-4 text-left hover:border-accent/40 transition-all">
            <p className="text-primary font-medium">Word 認人名單</p>
            <p className="text-xs text-muted mt-1">每行 3 位嘉賓，含相片</p>
          </button>
          <button onClick={handleGuestExport} className="card p-4 text-left hover:border-accent/40 transition-all">
            <p className="text-primary font-medium">完整嘉賓資料庫</p>
            <p className="text-xs text-muted mt-1">匯出所有嘉賓資料</p>
          </button>
          <button onClick={handleJsonBackup} className="card p-4 text-left hover:border-accent/40 transition-all">
            <p className="text-primary font-medium">JSON 完整備份</p>
            <p className="text-xs text-muted mt-1">包含所有系統資料</p>
          </button>
        </div>
      </section>
    </div>
  );
}
