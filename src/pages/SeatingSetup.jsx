import { useMemo, useState, useTransition } from 'react';
import { ArrowRight, Users, LayoutGrid, Armchair, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toSeatingGuests } from '../seating/adapters/guestAdapter';
import {
  analyzeEnterDashboard,
  planStats,
  removedGuestMessage,
  venueResetMessage,
} from '../seating/utils/enterDashboard';
import { normalizeBanquetTables, defaultVenueConfig } from '../seating/types';
import { useSeatingWorkspaceStore } from '../seating/store/seatingWorkspaceStore';
import SubEventSetupPanel from '../components/seating/SubEventSetupPanel';
import GuestSubEventMatrix from '../components/seating/GuestSubEventMatrix';
import EmptyState from '../components/ui/EmptyState';
import { FormField, Input, Select } from '../components/ui/FormFields';
import VipLoungeCanvas from '../seating/components/seating/VipLoungeCanvas';

const VENUE_TYPES = [
  { id: 'banquet', label: '宴會', desc: '主桌 + 圓桌 / 長桌' },
  { id: 'theater', label: '活動 / 會議', desc: '劇院式排列' },
  { id: 'stage', label: '舞台 / 合影', desc: '僅台上座位' },
];

function ConfigSection({ title, description, children }) {
  return (
    <div className="rounded-xl border border-border bg-bg/40 p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function CheckRow({ checked, onChange, label, children }) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2.5 cursor-pointer text-sm text-primary">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30"
        />
        {label}
      </label>
      {checked && children}
    </div>
  );
}

function LongTableSideFields({
  label,
  topEnabled,
  bottomEnabled,
  topSeats,
  bottomSeats,
  sideLeftEnabled,
  sideRightEnabled,
  sideLeftSeats,
  sideRightSeats,
  onChange,
}) {
  return (
    <ConfigSection
      title={`${label} — 長桌座位`}
      description="上/下排為枱面上下方；左/右側為枱面兩側（沿枱長方向）"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <CheckRow
          checked={topEnabled}
          onChange={(v) => onChange({ topEnabled: v, bottomEnabled, topSeats, bottomSeats, sideLeftEnabled, sideRightEnabled, sideLeftSeats, sideRightSeats })}
          label="上排有座位"
        >
          <FormField label="上排座位數" className="mb-0">
            <Input
              type="number"
              min={1}
              value={topSeats}
              onChange={(e) => onChange({ topEnabled, bottomEnabled, topSeats: Number(e.target.value), bottomSeats, sideLeftEnabled, sideRightEnabled, sideLeftSeats, sideRightSeats })}
            />
          </FormField>
        </CheckRow>
        <CheckRow
          checked={bottomEnabled}
          onChange={(v) => onChange({ topEnabled, bottomEnabled: v, topSeats, bottomSeats, sideLeftEnabled, sideRightEnabled, sideLeftSeats, sideRightSeats })}
          label="下排有座位"
        >
          <FormField label="下排座位數" className="mb-0">
            <Input
              type="number"
              min={1}
              value={bottomSeats}
              onChange={(e) => onChange({ topEnabled, bottomEnabled, topSeats, bottomSeats: Number(e.target.value), sideLeftEnabled, sideRightEnabled, sideLeftSeats, sideRightSeats })}
            />
          </FormField>
        </CheckRow>
        <CheckRow
          checked={sideLeftEnabled}
          onChange={(v) => onChange({ topEnabled, bottomEnabled, topSeats, bottomSeats, sideLeftEnabled: v, sideRightEnabled, sideLeftSeats, sideRightSeats })}
          label="左側有座位"
        >
          <FormField label="左側座位數" className="mb-0">
            <Input
              type="number"
              min={1}
              value={sideLeftSeats}
              onChange={(e) => onChange({ topEnabled, bottomEnabled, topSeats, bottomSeats, sideLeftEnabled, sideRightEnabled, sideLeftSeats: Number(e.target.value), sideRightSeats })}
            />
          </FormField>
        </CheckRow>
        <CheckRow
          checked={sideRightEnabled}
          onChange={(v) => onChange({ topEnabled, bottomEnabled, topSeats, bottomSeats, sideLeftEnabled, sideRightEnabled: v, sideLeftSeats, sideRightSeats })}
          label="右側有座位"
        >
          <FormField label="右側座位數" className="mb-0">
            <Input
              type="number"
              min={1}
              value={sideRightSeats}
              onChange={(e) => onChange({ topEnabled, bottomEnabled, topSeats, bottomSeats, sideLeftEnabled, sideRightEnabled, sideLeftSeats, sideRightSeats: Number(e.target.value) })}
            />
          </FormField>
        </CheckRow>
      </div>
    </ConfigSection>
  );
}

function RowAisleConfigFields({ config, onChange, rowCount = 0, zone = 'floor', showSegments = true }) {
  const overrideKey = zone === 'stage' ? 'stageRowOverrides' : 'rowOverrides';
  const overrides = config[overrideKey] ?? {};
  const gapField = zone === 'floor' && config.type === 'banquet' ? 'tableAisleGap' : 'rowAisleGap';
  const defaultGap = config[gapField] ?? config.rowAisleGap ?? 1;

  const patchRowOverride = (row, patch) => {
    onChange({
      ...config,
      [overrideKey]: {
        ...overrides,
        [row]: { ...overrides[row], ...patch },
      },
    });
  };

  return (
    <ConfigSection
      title={zone === 'stage' ? '台上走道與分段' : config.type === 'banquet' ? '枱間走道' : '走道與分段'}
      description={
        config.type === 'banquet' && zone === 'floor'
          ? '平面圖與匯出排位圖中，枱與枱之間的空格（0 = 不留走道）。分段由每排桌數決定。'
          : '每段座位數決定走道間斷（0 = 不分段）；或在排位平面圖按「走道」後點選相鄰兩座位（例如 4 與 5）直接插入。匯出時每單位走道 = 1 欄空格。'
      }
    >
      <div className={`grid gap-4 mb-3${showSegments ? ' sm:grid-cols-2' : ''}`}>
        <FormField label="預設走道寬度" className="mb-0">
          <Input
            type="number"
            min={0}
            max={5}
            value={defaultGap}
            onChange={(e) => {
              const value = Math.max(0, Math.min(5, Number(e.target.value) || 0));
              onChange({
                ...config,
                rowAisleGap: value,
                ...(config.type === 'banquet' ? { tableAisleGap: value } : {}),
              });
            }}
          />
        </FormField>
        {showSegments && (
          <FormField label="預設每段座位數（0 = 不分段）" className="mb-0">
            <Input
              type="number"
              min={0}
              max={99}
              value={config.rowSeatsPerSegment ?? 0}
              onChange={(e) => {
                const rowSeatsPerSegment = Math.max(0, Math.min(99, Number(e.target.value) || 0));
                onChange({ ...config, rowSeatsPerSegment });
              }}
            />
          </FormField>
        )}
      </div>
      {rowCount > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: rowCount }, (_, i) => (
            <div key={i} className="space-y-2">
              <FormField label={`第 ${i + 1} 排走道`} className="mb-0">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  value={overrides[i]?.rowAisleGap ?? overrides[i]?.tableAisleGap ?? defaultGap}
                  onChange={(e) => {
                    const rowAisleGap = Math.max(0, Math.min(5, Number(e.target.value) || 0));
                    const patch =
                      config.type === 'banquet' && zone === 'floor'
                        ? { tableAisleGap: rowAisleGap, rowAisleGap }
                        : { rowAisleGap };
                    patchRowOverride(i, patch);
                  }}
                />
              </FormField>
              {showSegments && (
                <FormField label={`第 ${i + 1} 排每段座位（0 = 不分段）`} className="mb-0">
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={overrides[i]?.rowSeatsPerSegment ?? config.rowSeatsPerSegment ?? 0}
                    onChange={(e) => {
                      patchRowOverride(i, {
                        rowSeatsPerSegment: Math.max(0, Math.min(99, Number(e.target.value) || 0)),
                      });
                    }}
                  />
                </FormField>
              )}
            </div>
          ))}
        </div>
      )}
    </ConfigSection>
  );
}

function StageOptions({ config, onChange }) {
  return (
    <ConfigSection title="台上排位" description="可選獨立台上嘉賓座位區">
      <CheckRow
        checked={config.hasStage}
        onChange={(v) => onChange({ ...config, hasStage: v })}
        label="設有獨立台上排位"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="台上排數" className="mb-0">
            <Input
              type="number"
              min={0}
              value={config.stageRowCount}
              onChange={(e) => onChange({ ...config, stageRowCount: Number(e.target.value) })}
            />
          </FormField>
          <FormField label="每排座位數" className="mb-0">
            <Input
              type="number"
              min={1}
              value={config.stageSeatsPerRow}
              onChange={(e) => onChange({ ...config, stageSeatsPerRow: Number(e.target.value) })}
            />
          </FormField>
        </div>
        {config.hasStage && config.stageRowCount > 0 && (
          <div className="mt-4">
            <RowAisleConfigFields
              config={config}
              onChange={onChange}
              rowCount={config.stageRowCount}
              zone="stage"
            />
          </div>
        )}
      </CheckRow>
    </ConfigSection>
  );
}

export default function SeatingSetup({ event, plan, guests, onEnterDashboard }) {
  const { syncSeatingParticipants, showToast, attendance } = useApp();
  const {
    setVenueType,
    updateVenueConfig,
    regenerateSeats,
    setStep,
    saveSnapshot,
    getPlan,
    replacePlan,
    setVipLoungeEnabled,
    addVipSeat,
    addVipTable,
    addVipChair,
    removeVipItem,
    moveVipItem,
    alignVipItems,
  } = useSeatingWorkspaceStore();
  const [isEntering, startTransition] = useTransition();
  const [guestMatrixOpen, setGuestMatrixOpen] = useState(true);

  const attendingGuestCount = useMemo(() => {
    const ids = new Set(
      attendance
        .filter((a) => a.eventId === event.id && ['attending', 'checked_in'].includes(a.status))
        .map((a) => a.guestId),
    );
    return ids.size;
  }, [attendance, event.id]);

  const seatingGuests = useMemo(() => {
    const attendanceByGuestId = Object.fromEntries(
      (attendance || [])
        .filter((a) => a.eventId === event.id)
        .map((a) => [a.guestId, a]),
    );
    return toSeatingGuests(guests, plan.participantGuestIds, attendanceByGuestId);
  }, [guests, plan.participantGuestIds, attendance, event.id]);
  const stats = useMemo(() => planStats(plan), [plan]);

  const handleSyncParticipants = () => {
    const synced = syncSeatingParticipants(event.id);
    replacePlan(synced);
    showToast('已將出席名單同步至當前子活動', 'success');
  };

  const enterDashboard = () => {
    const current = getPlan();
    if (!current) return;

    const analysis = analyzeEnterDashboard(current, seatingGuests, current.savedSnapshot);

    const go = () => {
      startTransition(() => {
        setStep('dashboard');
        saveSnapshot();
        onEnterDashboard();
      });
    };

    if (analysis.venueChanged) {
      if (!confirm(venueResetMessage())) return;
      regenerateSeats(true);
      go();
      return;
    }

    if (analysis.removedSeatedGuestNames.length > 0) {
      if (!confirm(removedGuestMessage(analysis.removedSeatedGuestNames))) return;
    }

    if (analysis.emptyLayout) {
      regenerateSeats(false);
    }

    go();
  };

  const renderBanquetForm = (c) => {
    const totalTables = c.tablesPerRow.reduce((a, b) => a + b, 0);
    const headEnabled = c.mainTableSeats > 0 || c.headTableShape === 'long';

    return (
      <div className="space-y-5">
        <ConfigSection title="主桌" description="VIP 或主禮嘉賓區域">
          <CheckRow
            checked={headEnabled}
            onChange={(v) =>
              updateVenueConfig({
                ...c,
                mainTableSeats: v ? Math.max(c.mainTableSeats, 10) : 0,
              })
            }
            label="啟用主桌"
          >
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField label="主桌形狀" className="mb-0">
                <Select
                  value={c.headTableShape}
                  onChange={(e) => updateVenueConfig({ ...c, headTableShape: e.target.value })}
                >
                  <option value="round">圓桌</option>
                  <option value="long">長桌</option>
                </Select>
              </FormField>
              {c.headTableShape === 'round' && (
                <FormField label="主桌座位數" className="mb-0">
                  <Input
                    type="number"
                    min={1}
                    value={c.mainTableSeats}
                    onChange={(e) => updateVenueConfig({ ...c, mainTableSeats: Number(e.target.value) })}
                  />
                </FormField>
              )}
            </div>
          </CheckRow>
          {headEnabled && c.headTableShape === 'long' && (
            <LongTableSideFields
              label="主桌"
              topEnabled={c.headLongLeftEnabled}
              bottomEnabled={c.headLongRightEnabled}
              topSeats={c.headLongLeftSeats}
              bottomSeats={c.headLongRightSeats}
              sideLeftEnabled={c.headLongSideLeftEnabled}
              sideRightEnabled={c.headLongSideRightEnabled}
              sideLeftSeats={c.headLongSideLeftSeats}
              sideRightSeats={c.headLongSideRightSeats}
              onChange={(next) =>
                updateVenueConfig({
                  ...c,
                  headLongLeftEnabled: next.topEnabled,
                  headLongRightEnabled: next.bottomEnabled,
                  headLongLeftSeats: next.topSeats,
                  headLongRightSeats: next.bottomSeats,
                  headLongSideLeftEnabled: next.sideLeftEnabled,
                  headLongSideRightEnabled: next.sideRightEnabled,
                  headLongSideLeftSeats: next.sideLeftSeats,
                  headLongSideRightSeats: next.sideRightSeats,
                })
              }
            />
          )}
        </ConfigSection>

        <ConfigSection title="客桌" description="台下嘉賓座位區">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="客桌形狀" className="mb-0">
              <Select
                value={c.guestTableShape}
                onChange={(e) => updateVenueConfig({ ...c, guestTableShape: e.target.value })}
              >
                <option value="round">圓桌</option>
                <option value="long">長桌</option>
              </Select>
            </FormField>
            {c.guestTableShape === 'round' && (
              <FormField label="每桌座位數" className="mb-0">
                <Input
                  type="number"
                  min={1}
                  value={c.seatsPerTable}
                  onChange={(e) => updateVenueConfig({ ...c, seatsPerTable: Number(e.target.value) })}
                />
              </FormField>
            )}
            <FormField label="桌排數" className="mb-0">
              <Input
                type="number"
                min={0}
                value={c.floorRowCount}
                onChange={(e) => {
                  const floorRowCount = Number(e.target.value);
                  updateVenueConfig(normalizeBanquetTables({ ...c, floorRowCount }));
                }}
              />
            </FormField>
          </div>
          {c.guestTableShape === 'long' && (
            <LongTableSideFields
              label="客桌"
              topEnabled={c.guestLongLeftEnabled}
              bottomEnabled={c.guestLongRightEnabled}
              topSeats={c.guestLongLeftSeats}
              bottomSeats={c.guestLongRightSeats}
              sideLeftEnabled={c.guestLongSideLeftEnabled}
              sideRightEnabled={c.guestLongSideRightEnabled}
              sideLeftSeats={c.guestLongSideLeftSeats}
              sideRightSeats={c.guestLongSideRightSeats}
              onChange={(next) =>
                updateVenueConfig({
                  ...c,
                  guestLongLeftEnabled: next.topEnabled,
                  guestLongRightEnabled: next.bottomEnabled,
                  guestLongLeftSeats: next.topSeats,
                  guestLongRightSeats: next.bottomSeats,
                  guestLongSideLeftEnabled: next.sideLeftEnabled,
                  guestLongSideRightEnabled: next.sideRightEnabled,
                  guestLongSideLeftSeats: next.sideLeftSeats,
                  guestLongSideRightSeats: next.sideRightSeats,
                })
              }
            />
          )}
        </ConfigSection>

        {c.floorRowCount > 0 && (
          <ConfigSection title="每排桌數" description={`台下共 ${totalTables} 桌（不含主桌）`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: c.floorRowCount }, (_, i) => (
                <FormField key={i} label={`第 ${i + 1} 排`} className="mb-0">
                  <Input
                    type="number"
                    min={0}
                    value={c.tablesPerRow[i] ?? 0}
                    onChange={(e) => {
                      const tablesPerRow = [...c.tablesPerRow];
                      tablesPerRow[i] = Number(e.target.value);
                      updateVenueConfig(normalizeBanquetTables({ ...c, tablesPerRow }));
                    }}
                  />
                </FormField>
              ))}
            </div>
          </ConfigSection>
        )}

        {c.floorRowCount > 0 && (
          <RowAisleConfigFields
            config={c}
            onChange={updateVenueConfig}
            rowCount={c.floorRowCount}
            zone="floor"
            showSegments={false}
          />
        )}

        <StageOptions config={c} onChange={(next) => updateVenueConfig(next)} />
      </div>
    );
  };

  const renderVenueForm = () => {
    const config = plan.venueConfig ?? defaultVenueConfig(plan.venueType ?? 'banquet');
    if (config.type === 'banquet') return renderBanquetForm(config);

    if (config.type === 'theater') {
      return (
        <div className="space-y-5">
          <ConfigSection title="劇院式座位">
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField label="總排數" className="mb-0">
                <Input
                  type="number"
                  min={1}
                  value={config.rowCount}
                  onChange={(e) => updateVenueConfig({ ...config, rowCount: Number(e.target.value) })}
                />
              </FormField>
              <FormField label="每排座位數" className="mb-0">
                <Input
                  type="number"
                  min={1}
                  value={config.seatsPerRow}
                  onChange={(e) => updateVenueConfig({ ...config, seatsPerRow: Number(e.target.value) })}
                />
              </FormField>
            </div>
          </ConfigSection>
          <RowAisleConfigFields
            config={config}
            onChange={updateVenueConfig}
            rowCount={config.rowCount}
            zone="floor"
          />
          <StageOptions config={config} onChange={(next) => updateVenueConfig(next)} />
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <ConfigSection title="舞台 / 合影座位" description="不另設台下區域">
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="總排數" className="mb-0">
              <Input
                type="number"
                min={1}
                value={config.stageRowCount}
                onChange={(e) => updateVenueConfig({ ...config, stageRowCount: Number(e.target.value) })}
              />
            </FormField>
            <FormField label="每排座位數" className="mb-0">
              <Input
                type="number"
                min={1}
                value={config.stageSeatsPerRow}
                onChange={(e) => updateVenueConfig({ ...config, stageSeatsPerRow: Number(e.target.value) })}
              />
            </FormField>
          </div>
        </ConfigSection>
        <RowAisleConfigFields
          config={config}
          onChange={updateVenueConfig}
          rowCount={config.stageRowCount}
          zone="stage"
        />
      </div>
    );
  };

  const canEnter = stats.participantCount > 0 && !isEntering;

  return (
    <div className="space-y-6">
      <SubEventSetupPanel />

      {/* 活動摘要 */}
      <div className="card p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-display font-bold text-primary">{event.name}</h2>
            <p className="text-sm text-muted mt-1">
              {event.date} · {event.venue}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary inline-flex items-center justify-center gap-2 shrink-0"
            onClick={enterDashboard}
            disabled={!canEnter}
          >
            {isEntering ? '進入中…' : '完成設定，進入排位'}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center text-info">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-muted">可排位嘉賓</p>
            <p className="text-2xl font-display font-bold text-primary">{stats.participantCount}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <Armchair size={20} />
          </div>
          <div>
            <p className="text-xs text-muted">座位總數</p>
            <p className="text-2xl font-display font-bold text-primary">{plan.seats.length}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
            <LayoutGrid size={20} />
          </div>
          <div>
            <p className="text-xs text-muted">已排位</p>
            <p className="text-2xl font-display font-bold text-primary">{stats.assignedCount}</p>
          </div>
        </div>
      </div>

      {/* 出席嘉賓 — 各子活動參與 */}
      <div className="card p-5 sm:p-6">
        <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-3${guestMatrixOpen ? ' mb-4' : ''}`}>
          <button
            type="button"
            className="setup-section-toggle flex-1 text-left"
            onClick={() => setGuestMatrixOpen((open) => !open)}
            aria-expanded={guestMatrixOpen}
          >
            <ChevronDown
              size={18}
              className={`setup-section-chevron shrink-0${guestMatrixOpen ? ' open' : ''}`}
            />
            <div>
              <h3 className="section-title">嘉賓子活動出席</h3>
              <p className="text-sm text-muted mt-1">
                {guestMatrixOpen
                  ? '勾選嘉賓將出席哪些子活動，並設定出席人數；若子活動已開 VIP 休息室，再勾選「VIP 休息室」後才可排入'
                  : attendingGuestCount > 0
                    ? `已收起 · 共 ${attendingGuestCount} 位出席嘉賓`
                    : '已收起 · 請先在「邀請與出席」確認嘉賓出席'}
              </p>
            </div>
          </button>
          <button
            type="button"
            className="btn-secondary text-sm shrink-0"
            onClick={handleSyncParticipants}
          >
            同步至當前子活動
          </button>
        </div>
        {guestMatrixOpen && (
          <GuestSubEventMatrix eventId={event.id} guests={guests} />
        )}
      </div>

      {/* 場地配置 */}
      <div className="card p-5 sm:p-6">
        <h3 className="section-title mb-1">場地與座位配置</h3>
        <p className="text-sm text-muted mb-5">
          為目前子活動「<strong className="text-primary">{plan.name}</strong>」選擇場型；若已有排位再變更配置，進入排位時會提示是否重置。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6">
          {VENUE_TYPES.map(({ id, label, desc }) => (
            <button
              key={id}
              type="button"
              onClick={() => setVenueType(id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                plan.venueType === id
                  ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                  : 'border-border bg-bg/30 hover:border-accent/40 hover:bg-card-hover'
              }`}
            >
              <p className={`font-medium text-sm ${plan.venueType === id ? 'text-accent' : 'text-primary'}`}>
                {label}
              </p>
              <p className="text-xs text-muted mt-0.5">{desc}</p>
            </button>
          ))}
        </div>

        {renderVenueForm()}
      </div>

      <div className="card p-5 sm:p-6">
        <ConfigSection
          title="VIP 休息室"
          description="可選獨立休息區；每子活動各自布置。勾選嘉賓矩陣中的 VIP 欄後，方可排入休息室座位。"
        >
          <CheckRow
            checked={Boolean(plan.vipLounge?.enabled)}
            onChange={(v) => setVipLoungeEnabled(v)}
            label="此子活動需要 VIP 休息室"
          >
            {plan.vipLounge?.enabled && (
              <VipLoungeCanvas
                items={plan.vipLounge?.items ?? []}
                seats={plan.seats}
                assignments={plan.assignments}
                guests={seatingGuests}
                showTooltip={false}
                layoutMode
                toolbarMode="layout"
                selectedSeatId={null}
                highlightGuestIds={[]}
                dragDisabled={false}
                dndEnabled={false}
                onSeatClick={() => {}}
                onMoveItem={moveVipItem}
                onRemoveItem={removeVipItem}
                onAddSeat={addVipSeat}
                onAddTable={addVipTable}
                onAddChair={addVipChair}
                onAlignItems={alignVipItems}
              />
            )}
          </CheckRow>
        </ConfigSection>
      </div>

      {/* 底部操作 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 pb-4">
        <p className="text-sm text-muted text-center sm:text-left">
          {stats.participantCount === 0
            ? '請先同步出席嘉賓'
            : `共 ${plan.seats.length} 個座位，${stats.participantCount} 位嘉賓待排位`}
        </p>
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2 w-full sm:w-auto justify-center"
          onClick={enterDashboard}
          disabled={!canEnter}
        >
          {isEntering ? '進入中…' : '完成設定，進入排位'}
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
