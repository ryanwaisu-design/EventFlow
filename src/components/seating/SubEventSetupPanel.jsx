import { useState } from 'react';
import { ArrowDown, ArrowUp, Clock, Plus, Trash2 } from 'lucide-react';
import { useSeatingWorkspaceStore } from '../../seating/store/seatingWorkspaceStore';
import { FormField, Input, Select } from '../ui/FormFields';

export default function SubEventSetupPanel() {
  const plan = useSeatingWorkspaceStore((s) => s.plan);
  const {
    setCurrentSubEvent,
    addSubEvent,
    updateSubEventMeta,
    deleteSubEvent,
    reorderSubEvent,
    sortSubEventsBySchedule,
    copySubEventVenue,
  } = useSeatingWorkspaceStore();

  const [copyFromId, setCopyFromId] = useState('');

  if (!plan) return null;

  if (!plan.subEvents?.length) {
    return (
      <div className="card p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="section-title">子活動</h3>
          <p className="text-sm text-muted mt-1">
            同一活動可拆分多個環節（例如晚宴、論壇），各自獨立排位與場地配置
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => addSubEvent({ name: '主活動' })}
        >
          <Plus size={14} className="inline mr-1" />
          建立子活動
        </button>
      </div>
    );
  }

  const subEvents = plan.subEvents;
  const activeId = plan.currentSubEventId ?? subEvents[0]?.id;
  const activeIndex = subEvents.findIndex((s) => s.id === activeId);
  const otherSubs = subEvents.filter((s) => s.id !== activeId);

  const assignedCount = Object.values(plan.assignments).filter((a) => a.guestId).length;

  return (
    <div className="card p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="section-title">子活動</h3>
          <p className="text-sm text-muted mt-1">
            同一活動可拆分多個環節（例如晚宴、論壇），各自獨立排位與場地配置
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {subEvents.length >= 2 && (
            <button type="button" className="btn-secondary text-sm" onClick={() => sortSubEventsBySchedule()}>
              <Clock size={14} className="inline mr-1" />
              依時間排序
            </button>
          )}
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() =>
              addSubEvent({ name: `子活動 ${subEvents.length + 1}` })
            }
          >
            <Plus size={14} className="inline mr-1" />
            新增子活動
          </button>
        </div>
      </div>

      <div className="setup-sub-event-tabs" role="tablist">
        {subEvents.map((sub, index) => (
          <button
            key={sub.id}
            type="button"
            role="tab"
            className={`setup-sub-event-tab${sub.id === activeId ? ' active' : ''}`}
            onClick={() => setCurrentSubEvent(sub.id)}
          >
            <span className="setup-sub-event-tab-label">
              {sub.name?.trim() || `子活動 ${index + 1}`}
            </span>
          </button>
        ))}
      </div>

      <div className="sub-event-panel space-y-4">
        <div className="sub-event-panel-toolbar flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            {plan.seats.length} 個座位
            {plan.participantGuestIds.length > 0 && ` · ${plan.participantGuestIds.length} 位出席`}
            {assignedCount > 0 && ` · ${assignedCount} 人已排位`}
          </p>
          <div className="flex items-center gap-2">
            {subEvents.length >= 2 && (
              <div className="sub-event-sort-btns flex gap-1">
                <button
                  type="button"
                  className="btn-secondary text-sm px-2 py-1"
                  disabled={activeIndex <= 0}
                  onClick={() => reorderSubEvent(activeIndex, 'up')}
                  title="上移"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm px-2 py-1"
                  disabled={activeIndex >= subEvents.length - 1}
                  onClick={() => reorderSubEvent(activeIndex, 'down')}
                  title="下移"
                >
                  <ArrowDown size={14} />
                </button>
              </div>
            )}
            {subEvents.length > 1 && (
              <button
                type="button"
                className="btn-danger text-sm"
                onClick={() => {
                  if (confirm(`確定要刪除「${plan.name}」嗎？此子活動的排位將一併刪除。`)) {
                    deleteSubEvent(activeId);
                  }
                }}
              >
                <Trash2 size={14} className="inline mr-1" />
                刪除
              </button>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormField label="子活動名稱" required>
            <Input
              value={plan.name}
              onChange={(e) => updateSubEventMeta({ name: e.target.value })}
            />
          </FormField>
          <FormField label="日期">
            <Input
              type="date"
              value={plan.date}
              onChange={(e) => updateSubEventMeta({ date: e.target.value })}
            />
          </FormField>
          <FormField label="時間">
            <Input
              type="time"
              value={plan.time}
              onChange={(e) => updateSubEventMeta({ time: e.target.value })}
            />
          </FormField>
          <FormField label="地點">
            <Input
              value={plan.location}
              onChange={(e) => updateSubEventMeta({ location: e.target.value })}
            />
          </FormField>
        </div>

        {otherSubs.length > 0 && (
          <div className="copy-venue-row flex flex-wrap items-end gap-3 p-3 rounded-lg bg-bg/50 border border-border">
            <FormField label="複製場地配置自" className="mb-0 flex-1 min-w-[160px]">
              <Select value={copyFromId} onChange={(e) => setCopyFromId(e.target.value)}>
                <option value="">請選擇子活動</option>
                {otherSubs.map((s) => (
                  <option key={s.id} value={s.id}>{s.name || '子活動'}</option>
                ))}
              </Select>
            </FormField>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={!copyFromId}
              onClick={() => {
                if (assignedCount > 0 && !confirm('複製場地配置可能影響現有排位，確定繼續？')) return;
                if (copySubEventVenue(copyFromId)) setCopyFromId('');
              }}
            >
              複製場地
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
