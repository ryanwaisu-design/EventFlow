import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  Undo2,
  Redo2,
  Save,
  Search,
  Lock,
  Hash,
  FileSpreadsheet,
  Printer,
  Info,
  RotateCcw,
  ArrowLeft,
  Users,
  Mic2,
  ChevronDown,
  Plus,
  AlignHorizontalSpaceBetween,
  LayoutGrid,
  Wine,
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useApp } from '../context/AppContext';
import { toSeatingGuests } from '../seating/adapters/guestAdapter';
import { useSeatingWorkspaceStore } from '../seating/store/seatingWorkspaceStore';
import { useHistoryStore } from '../seating/store/historyStore';
import SeatingChart from '../seating/components/seating/SeatingChart';
import VipLoungeCanvas from '../seating/components/seating/VipLoungeCanvas';
import PanZoomCanvas, { scrollHighlightIntoView } from '../seating/components/PanZoomCanvas';
import { snapCenterToCursor } from '../seating/utils/dndModifiers';
import { useUnsavedGuard } from '../seating/hooks/useUnsavedGuard';
import {
  buildSeatingContext,
  canAssignGuestToSeat,
  canSwapSeats,
  getGuestQuotaStatus,
  getGuestQuotaTags,
  formatGuestQuotaSummary,
  guestQuotaListItemClasses,
  getUnassignedGuests,
  getAssignedGuests,
  buildGuestSeatIndex,
  getSeatOccupancyStats,
  guestIsVipEligible,
  participantGuests,
  isAudienceSeat,
  isStageSeat,
  isVipSeat,
  quotaDenyMessage,
} from '../seating/utils/guestSeats';
import { buildSeatingView } from '../seating/utils/seatingView';
import { exportSeatingLayoutExcel, exportSeatingListExcel, exportSeatingPdf } from '../seating/utils/exportSeating';
import { canPlaceRowAisleBreaks, isSeatEligibleForAisleBreak } from '../seating/utils/rowAisle';
import { longTableSeatLabel } from '../seating/utils/rankOrder';
import { validateRenumber, validateRenumberSwap } from '../seating/utils/seatRenumber';
import {
  getTableDisplayNumberByKey,
  validateTableRenumber,
  validateTableRenumberSwap,
} from '../seating/utils/tableNumber';

export default function SeatingDashboard({ event, onBackToSetup }) {
  const { commitSeatingPlan, showToast, guests: appGuests, attendance } = useApp();
  const { confirmLeave } = useUnsavedGuard(true);

  const plan = useSeatingWorkspaceStore((s) => s.plan);
  const guests = useSeatingWorkspaceStore((s) => s.guests);
  const isDirty = useSeatingWorkspaceStore((s) => {
    s.plan;
    s.savedSnapshot;
    return s.hasUnsavedChanges();
  });

  const {
    assignGuest,
    swapSeats,
    toggleLock,
    setCustomNumber,
    setCustomTableNumber,
    resetAssignments,
    setShowTooltip,
    saveSnapshot,
    setStep,
    setCurrentSubEvent,
    addSubEvent,
    toggleRowAisleBreak,
    addVipSeat,
    addVipTable,
    addVipChair,
    removeVipItem,
    moveVipItem,
    alignVipItems,
    setGuestVipEligible,
  } = useSeatingWorkspaceStore();

  const { push, undo, redo, canUndo, canRedo, clear: clearHistory } = useHistoryStore();

  const [seatingMode, setSeatingMode] = useState('audience');
  const [toolbarMode, setToolbarMode] = useState('normal');
  const [aislePickSeatId, setAislePickSeatId] = useState(null);
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [selectedSeatId, setSelectedSeatId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightGuestIds, setHighlightGuestIds] = useState([]);
  const [dragGuestName, setDragGuestName] = useState(null);
  const [toast, setToast] = useState(null);
  const [quotaMessage, setQuotaMessage] = useState(null);
  const [renumberSwapFrom, setRenumberSwapFrom] = useState(null);
  const [showRenumberModal, setShowRenumberModal] = useState(null);
  const [renumberValue, setRenumberValue] = useState('');
  const [renumberTableSwapFrom, setRenumberTableSwapFrom] = useState(null);
  const [showTableRenumberModal, setShowTableRenumberModal] = useState(null);
  const [renumberTableValue, setRenumberTableValue] = useState('');
  const [showRenumberGuide, setShowRenumberGuide] = useState(false);
  const [assignedGuestsOpen, setAssignedGuestsOpen] = useState(false);
  const [unassignedGuestsOpen, setUnassignedGuestsOpen] = useState(true);
  const [sidebarGuestSearch, setSidebarGuestSearch] = useState('');
  const [lockedCount, setLockedCount] = useState(0);
  const [chartReady, setChartReady] = useState(false);
  const [dndReady, setDndReady] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const seatingCtx = useMemo(
    () => (plan && guests ? buildSeatingContext(guests, plan) : null),
    [guests, plan],
  );

  const seatingView = useMemo(
    () => (plan && guests ? buildSeatingView(event, plan, guests) : null),
    [event, plan, guests],
  );

  const canEditAisleBreaks = useMemo(
    () => !!(plan?.venueConfig && canPlaceRowAisleBreaks(plan.venueConfig)),
    [plan?.venueConfig],
  );

  useEffect(() => {
    setChartReady(false);
    setDndReady(false);
    let timer;
    const frame = requestAnimationFrame(() => {
      setChartReady(true);
      timer = setTimeout(() => setDndReady(true), 250);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [event?.id, plan?.updatedAt]);

  useEffect(() => {
    if (!plan?.assignments) return;
    setLockedCount(Object.values(plan.assignments).filter((a) => a.locked).length);
  }, [plan]);

  useEffect(() => {
    const handler = (e) => {
      if (useSeatingWorkspaceStore.getState().hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => {
    clearHistory();
    const current = useSeatingWorkspaceStore.getState().plan;
    if (current?.step !== 'dashboard') {
      setStep('dashboard');
    }
  }, [event?.id, clearHistory, setStep]);

  const participantGuestKey = plan?.participantGuestIds?.join(',') ?? '';

  useEffect(() => {
    if (!plan) return;
    const attendanceByGuestId = Object.fromEntries(
      (attendance || [])
        .filter((a) => a.eventId === plan.eventId)
        .map((a) => [a.guestId, a]),
    );
    const seatingGuests = toSeatingGuests(appGuests, plan.participantGuestIds, attendanceByGuestId);
    const prev = useSeatingWorkspaceStore.getState().guests;
    const unchanged =
      prev.length === seatingGuests.length &&
      prev.every((g, i) =>
        g.id === seatingGuests[i]?.id
        && g.organization === seatingGuests[i]?.organization
        && g.title === seatingGuests[i]?.title
        && (g.jobLevel || '') === (seatingGuests[i]?.jobLevel || ''),
      );
    if (!unchanged) {
      useSeatingWorkspaceStore.setState({ guests: seatingGuests });
    }
    setSelectedGuestId(null);
    setSelectedSeatId(null);
    setHighlightGuestIds([]);
  }, [plan?.currentSubEventId, participantGuestKey, appGuests, attendance, plan?.eventId]);

  const makeSnapshot = useCallback(() => {
    if (!plan) return null;
    return {
      guests,
      assignments: plan.assignments,
      seats: plan.seats,
      customTableNumbers: plan.customTableNumbers,
      participations: plan.participations,
    };
  }, [guests, plan]);

  const recordHistory = useCallback(() => {
    const snap = makeSnapshot();
    if (snap) push(snap);
  }, [makeSnapshot, push]);

  const applyUndo = () => {
    const snap = makeSnapshot();
    if (!snap || !plan) return;
    const prev = undo(snap);
    if (prev) {
      useSeatingWorkspaceStore.setState({
        plan: {
          ...plan,
          assignments: prev.assignments,
          seats: prev.seats,
          customTableNumbers: prev.customTableNumbers,
          participations: prev.participations ?? plan.participations,
        },
        guests: prev.guests,
      });
      setSelectedGuestId(null);
    }
  };

  const applyRedo = () => {
    const snap = makeSnapshot();
    if (!snap || !plan) return;
    const next = redo(snap);
    if (next) {
      useSeatingWorkspaceStore.setState({
        plan: {
          ...plan,
          assignments: next.assignments,
          seats: next.seats,
          customTableNumbers: next.customTableNumbers,
          participations: next.participations ?? plan.participations,
        },
        guests: next.guests,
      });
      setSelectedGuestId(null);
    }
  };

  const seatIndex = useMemo(
    () => (plan ? buildGuestSeatIndex(plan.assignments, plan.seats) : buildGuestSeatIndex({}, [])),
    [plan?.assignments, plan?.seats],
  );

  const unassigned = useMemo(
    () => (seatingCtx ? getUnassignedGuests(seatingCtx, seatingMode, seatIndex) : []),
    [seatingCtx, seatingMode, seatIndex],
  );

  /** VIP 模式：已出席但尚未勾選可進入休息室的嘉賓（可在此直接勾選） */
  const vipNotEligible = useMemo(() => {
    if (!seatingCtx || seatingMode !== 'vip') return [];
    return participantGuests(seatingCtx).filter((g) => !guestIsVipEligible(seatingCtx, g.id));
  }, [seatingCtx, seatingMode]);

  const assigned = useMemo(
    () => (assignedGuestsOpen && seatingCtx ? getAssignedGuests(seatingCtx, seatingMode, seatIndex) : []),
    [assignedGuestsOpen, seatingCtx, seatingMode, seatIndex],
  );

  const assignedCount = useMemo(
    () => (seatingCtx ? getAssignedGuests(seatingCtx, seatingMode, seatIndex).length : 0),
    [seatingCtx, seatingMode, seatIndex],
  );

  const seatStats = useMemo(
    () => (plan ? getSeatOccupancyStats(seatingMode, plan.assignments ?? {}, plan.seats ?? []) : { assigned: 0, total: 0 }),
    [plan, seatingMode],
  );

  const hasVipLounge = useMemo(
    () => Boolean(plan?.vipLounge?.enabled),
    [plan?.vipLounge?.enabled],
  );

  const hasStageSeating = useMemo(
    () => plan?.seats?.some((s) => s.zone === 'stage') ?? false,
    [plan?.seats],
  );

  const guestQuotaByGuestId = useMemo(() => {
    if (!seatingCtx) return new Map();
    const map = new Map();
    for (const g of participantGuests(seatingCtx)) {
      const quota = getGuestQuotaStatus(seatingCtx, g, seatIndex);
      const summary = formatGuestQuotaSummary(quota, seatingMode);
      if (summary) map.set(g.id, summary);
    }
    return map;
  }, [seatingCtx, seatIndex, seatingMode]);

  const selectedGuestQuotaSummary = useMemo(() => {
    if (!selectedGuestId || !seatingCtx) return null;
    const guest = guests.find((g) => g.id === selectedGuestId);
    if (!guest) return null;
    const quota = getGuestQuotaStatus(seatingCtx, guest, seatIndex);
    return formatGuestQuotaSummary(quota, seatingMode);
  }, [selectedGuestId, seatingCtx, guests, seatIndex, seatingMode]);

  if (!plan || !seatingCtx || !seatingView) {
    return (
      <div className="seating-module dashboard-page p-6">
        <p className="text-sm text-muted">正在載入排位圖…</p>
      </div>
    );
  }

  const participationSeat = (guestId, mode) => {
    const p = plan.participations[guestId];
    if (!p) return null;
    return mode === 'stage' ? p.stageSeat : mode === 'vip' ? p.vipSeat : p.audienceSeat;
  };

  const isDragDisabled =
    toolbarMode === 'lock' ||
    toolbarMode === 'renumber' ||
    toolbarMode === 'aisle' ||
    toolbarMode === 'layout';

  const showQuotaMessage = (msg) => {
    setQuotaMessage(msg);
    setTimeout(() => setQuotaMessage(null), 2800);
  };

  const handleBack = () => {
    if (!confirmLeave()) return;
    setStep('setup');
    onBackToSetup();
  };

  const handleSeatClick = (seatId) => {
    const seat = plan.seats.find((s) => s.id === seatId);
    const assignment = plan.assignments[seatId];
    if (!seat || !assignment) return;

    if (toolbarMode === 'aisle') {
      if (!isSeatEligibleForAisleBreak(seat, plan.venueConfig)) {
        showQuotaMessage('此座位不可設定走道');
        return;
      }
      if (!aislePickSeatId) {
        setAislePickSeatId(seatId);
        return;
      }
      if (aislePickSeatId === seatId) {
        setAislePickSeatId(null);
        return;
      }
      recordHistory();
      const result = toggleRowAisleBreak(aislePickSeatId, seatId);
      setAislePickSeatId(null);
      if (result === 'invalid') {
        showQuotaMessage('請點選同一排、相鄰的兩個座位（例如 4 號與 5 號之間，就點 4 和 5）');
        return;
      }
      setToast(result === 'added' ? '已加入走道' : '已移除走道');
      return;
    }

    if (toolbarMode === 'lock') {
      recordHistory();
      toggleLock(seatId);
      return;
    }

    if (toolbarMode === 'renumber') {
      setRenumberTableSwapFrom(null);
      if (renumberSwapFrom) {
        if (renumberSwapFrom === seatId) {
          setRenumberSwapFrom(null);
          return;
        }
        const err = validateRenumberSwap(plan, renumberSwapFrom, seatId);
        if (err) {
          showQuotaMessage(err);
          setRenumberSwapFrom(null);
          return;
        }
        recordHistory();
        setCustomNumber(renumberSwapFrom, undefined, seatId);
        setRenumberSwapFrom(null);
        setToast('座位編號已互換');
        return;
      }
      setShowRenumberModal(seatId);
      const seatObj = plan.seats.find((s) => s.id === seatId);
      setRenumberValue(
        seatObj?.side !== undefined
          ? longTableSeatLabel(seatObj)
          : String(seatObj?.customNumber ?? seatObj?.displayNumber ?? ''),
      );
      return;
    }

    if (assignment.locked) return;
    const isStage = seatingMode === 'stage';
    const isVip = seatingMode === 'vip';
    if (isStage && !isStageSeat(seat)) return;
    if (isVip && !isVipSeat(seat)) return;
    if (!isStage && !isVip && !isAudienceSeat(seat)) return;

    if (selectedGuestId) {
      const guest = guests.find((g) => g.id === selectedGuestId);
      if (!canAssignGuestToSeat(seatingCtx, seatId, selectedGuestId)) {
        if (guest) {
          const zone = isStage ? 'stage' : isVip ? 'vip' : 'floor';
          showQuotaMessage(
            quotaDenyMessage(
              guest,
              zone,
              seatingCtx.participations[guest.id],
            ),
          );
        }
        return;
      }
      recordHistory();
      if (assignGuest(seatId, selectedGuestId)) {
        setSelectedGuestId(null);
        setSelectedSeatId(seatId);
      }
      return;
    }

    if (assignment.guestId) {
      if (selectedSeatId && selectedSeatId !== seatId) {
        if (canSwapSeats(seatingCtx, selectedSeatId, seatId)) {
          recordHistory();
          swapSeats(selectedSeatId, seatId);
          setSelectedSeatId(seatId);
        }
        return;
      }
      setSelectedGuestId(assignment.guestId);
      setSelectedSeatId(seatId);
    } else if (selectedSeatId && plan.assignments[selectedSeatId]?.guestId) {
      if (canSwapSeats(seatingCtx, selectedSeatId, seatId)) {
        recordHistory();
        swapSeats(selectedSeatId, seatId);
      }
      setSelectedSeatId(seatId);
    } else {
      setSelectedSeatId(seatId);
    }
  };

  const handleTableClick = (tableKey) => {
    if (toolbarMode !== 'renumber') return;
    setRenumberSwapFrom(null);
    if (renumberTableSwapFrom) {
      if (renumberTableSwapFrom === tableKey) {
        setRenumberTableSwapFrom(null);
        return;
      }
      const err = validateTableRenumberSwap(plan, renumberTableSwapFrom, tableKey);
      if (err) {
        showQuotaMessage(err);
        setRenumberTableSwapFrom(null);
        return;
      }
      recordHistory();
      setCustomTableNumber(renumberTableSwapFrom, undefined, tableKey);
      setRenumberTableSwapFrom(null);
      setToast('桌號已互換');
      return;
    }
    setShowTableRenumberModal(tableKey);
    setRenumberTableValue(String(getTableDisplayNumberByKey(plan, tableKey)));
  };

  const handleSave = () => {
    const current = useSeatingWorkspaceStore.getState().plan;
    if (!current) return;
    saveSnapshot();
    commitSeatingPlan(current, { writeback: true });
    setToast('進度已成功儲存！');
  };

  const sidebarSearch = sidebarGuestSearch.trim().toLowerCase();
  const filterSidebarGuest = (g) => {
    if (!sidebarSearch) return true;
    return (
      g.name.toLowerCase().includes(sidebarSearch) ||
      g.organization.toLowerCase().includes(sidebarSearch) ||
      g.title.toLowerCase().includes(sidebarSearch) ||
      (g.jobLevel || '').toLowerCase().includes(sidebarSearch)
    );
  };

  const visibleUnassigned = unassigned.filter(filterSidebarGuest);
  const visibleAssigned = assigned.filter(filterSidebarGuest);

  const renderGuestQuotaMeta = (guest) => {
    const quota = getGuestQuotaStatus(seatingCtx, guest, seatIndex);
    const tags = getGuestQuotaTags(quota, seatingMode);
    const meta = [guest.organization, guest.title, guest.jobLevel].filter(Boolean).join(' · ') || '—';
    return tags.length > 0 ? `${meta} · ${tags.join(' · ')}` : meta;
  };

  const subEvents = plan?.subEvents ?? [];
  const subEventMeta = {
    name: subEvents.length > 1 ? `${event.name} — ${plan.name}` : event.name,
    date: plan?.date || event.date,
    venue: plan?.location || event.venue,
    startTime: plan?.time || event.startTime,
    updatedAt: plan?.updatedAt,
  };

  const handleSubEventSwitch = (subId) => {
    setCurrentSubEvent(subId);
    clearHistory();
    setSelectedGuestId(null);
    setSelectedSeatId(null);
    setHighlightGuestIds([]);
  };

  return (
    <div className="seating-module dashboard-page">
      {subEvents.length > 0 && (
        <div className="setup-sub-event-tabs mb-3 no-print" role="tablist">
          {subEvents.map((sub, index) => (
            <button
              key={sub.id}
              type="button"
              role="tab"
              className={`setup-sub-event-tab${sub.id === plan.currentSubEventId ? ' active' : ''}`}
              onClick={() => handleSubEventSwitch(sub.id)}
            >
              <span className="setup-sub-event-tab-label">
                {sub.name?.trim() || `子活動 ${index + 1}`}
              </span>
            </button>
          ))}
          <button
            type="button"
            className="setup-sub-event-tab setup-sub-event-tab-add"
            title="新增子活動"
            onClick={() => addSubEvent({ name: `子活動 ${subEvents.length + 1}` })}
          >
            <Plus size={14} />
            <span className="setup-sub-event-tab-label">新增</span>
          </button>
        </div>
      )}
      <div className="dashboard-toolbar no-print">
        {quotaMessage && <div className="quota-toast">{quotaMessage}</div>}
        <div className="toolbar-left">
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleBack}>
            <ArrowLeft size={16} /> 返回設定
          </button>
          <h1>{event.name}{plan.name && plan.name !== event.name ? ` — ${plan.name}` : subEvents.length > 1 ? ` — ${plan.name}` : ''}</h1>
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="搜尋嘉賓姓名…"
              value={searchQuery}
              onChange={(e) => {
                const q = e.target.value;
                setSearchQuery(q);
                if (!q.trim()) {
                  setHighlightGuestIds([]);
                  return;
                }
                const matches = participantGuests(seatingCtx).filter((g) =>
                  g.name.toLowerCase().includes(q.toLowerCase()),
                );
                setHighlightGuestIds(matches.map((g) => g.id));
                if (matches[0]) {
                  const seatId = participationSeat(matches[0].id, seatingMode);
                  if (seatId) setTimeout(() => scrollHighlightIntoView(`[data-seat-id="${seatId}"]`), 100);
                }
              }}
            />
          </div>
        </div>
        <div className="toolbar-actions">
          <label className="toggle-label">
            <input type="checkbox" checked={plan.showTooltip} onChange={(e) => setShowTooltip(e.target.checked)} />
            <Info size={14} /> 資訊卡
          </label>
          <button type="button" className="btn btn-secondary btn-sm btn-icon-only" disabled={!canUndo()} onClick={applyUndo} title="復原">
            <Undo2 size={16} />
          </button>
          <button type="button" className="btn btn-secondary btn-sm btn-icon-only" disabled={!canRedo()} onClick={applyRedo} title="重做">
            <Redo2 size={16} />
          </button>
          <button
            type="button"
            className={`btn btn-sm btn-icon-only ${toolbarMode === 'lock' ? 'btn-lock-active' : 'btn-secondary'}`}
            onClick={() => {
              setToolbarMode((m) => (m === 'lock' ? 'normal' : 'lock'));
              setSelectedGuestId(null);
              setAislePickSeatId(null);
            }}
            title={`鎖定座位${lockedCount > 0 ? ` (${lockedCount})` : ''}`}
          >
            <Lock size={16} />
          </button>
          <button
            type="button"
            className={`btn btn-sm ${toolbarMode === 'renumber' ? 'btn-renumber-active' : 'btn-secondary'}`}
            onClick={() => setShowRenumberGuide(true)}
          >
            <Hash size={16} />
            <span>改編號</span>
          </button>
          {canEditAisleBreaks && (
            <button
              type="button"
              className={`btn btn-sm ${toolbarMode === 'aisle' ? 'btn-aisle-active' : 'btn-secondary'}`}
              onClick={() => {
                setToolbarMode((m) => {
                  const next = m === 'aisle' ? 'normal' : 'aisle';
                  if (next === 'aisle') {
                    setSelectedGuestId(null);
                    setSelectedSeatId(null);
                    setAislePickSeatId(null);
                  }
                  return next;
                });
              }}
              title="在平面圖上點選相鄰兩座位以加入或移除走道"
            >
              <AlignHorizontalSpaceBetween size={16} />
              <span>走道</span>
            </button>
          )}
          {hasVipLounge && (
            <button
              type="button"
              className={`btn btn-sm ${toolbarMode === 'layout' ? 'btn-aisle-active' : 'btn-secondary'}`}
              onClick={() => {
                setSeatingMode('vip');
                setToolbarMode((m) => {
                  const next = m === 'layout' ? 'normal' : 'layout';
                  if (next === 'layout') {
                    setSelectedGuestId(null);
                    setSelectedSeatId(null);
                    setAislePickSeatId(null);
                  }
                  return next;
                });
              }}
              title="拖曳調整 VIP 休息室座位與茶几"
            >
              <LayoutGrid size={16} />
              <span>編輯布局</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (confirm('確定要清空所有未鎖定的排位嗎？')) {
                recordHistory();
                resetAssignments();
                setSelectedGuestId(null);
                setSelectedSeatId(null);
              }
            }}
          >
            <RotateCcw size={16} />
            <span>清空</span>
          </button>
          <button type="button" className={`btn btn-sm btn-save ${isDirty ? 'btn-unsaved' : 'btn-primary'}`} onClick={handleSave}>
            <Save size={16} />
            <span>{isDirty ? '未儲存' : '儲存'}</span>
          </button>
          <button
            type="button"
            className="btn btn-export btn-sm"
            title="可編輯主檔：全部座位／已排／未排（下載後可自行修改，不會匯回系統）"
            onClick={() => exportSeatingListExcel(subEventMeta, plan, guests)}
          >
            <FileSpreadsheet size={16} />
            <span>排位名單</span>
          </button>
          <button
            type="button"
            className="btn btn-export btn-sm"
            title="視覺參考圖：盡量接近畫面（圓桌等非 1:1）；編輯請用排位名單"
            onClick={() => exportSeatingLayoutExcel(subEventMeta, plan, guests)}
          >
            <FileSpreadsheet size={16} />
            <span>排位圖 Excel</span>
          </button>
          <button
            type="button"
            className="btn btn-print btn-sm"
            title="截取目前畫面上的排位圖"
            onClick={async () => {
              setToast('正在匯出 PDF…');
              try {
                await exportSeatingPdf('seating-chart-export', subEventMeta, plan, guests);
                setToast('排位圖 PDF 已匯出');
              } catch {
                showToast('PDF 匯出失敗', 'error');
              }
            }}
          >
            <Printer size={16} />
            <span>排位圖 PDF</span>
          </button>
        </div>
      </div>

      {toolbarMode === 'layout' && (
        <div className="renumber-mode-banner aisle-mode-banner no-print">
          <span>編輯布局：拖曳座位或茶几調整位置；可新增或刪除項目</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setToolbarMode('normal')}
          >
            完成
          </button>
        </div>
      )}

      {toolbarMode === 'aisle' && (
        <div className="renumber-mode-banner aisle-mode-banner no-print">
          <span>
            走道模式：先點走道左側座位，再點右側座位（例如 4 與 5 之間，就依序點 4、5）；再次點同一對可移除走道
            {aislePickSeatId ? ' — 請點選第二個座位' : ''}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setToolbarMode('normal');
              setAislePickSeatId(null);
            }}
          >
            完成
          </button>
        </div>
      )}

      {toolbarMode === 'renumber' && (
        <div className="renumber-mode-banner no-print">
          <span>改編號模式中</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setToolbarMode('normal');
              setRenumberSwapFrom(null);
              setRenumberTableSwapFrom(null);
              setShowRenumberModal(null);
              setShowTableRenumberModal(null);
            }}
          >
            完成
          </button>
        </div>
      )}

      <div className="dashboard-body">
        <aside className="guest-panel no-print">
          {(hasStageSeating || hasVipLounge) && (
            <div className="mode-tabs">
              <button type="button" className={`mode-tab ${seatingMode === 'audience' ? 'active' : ''}`} onClick={() => { setSeatingMode('audience'); setToolbarMode('normal'); setSelectedGuestId(null); }}>
                <Users size={14} /> 台下排位
              </button>
              {hasStageSeating && (
                <button type="button" className={`mode-tab ${seatingMode === 'stage' ? 'active' : ''}`} onClick={() => { setSeatingMode('stage'); setToolbarMode('normal'); setSelectedGuestId(null); }}>
                  <Mic2 size={14} /> 台上排位
                </button>
              )}
              {hasVipLounge && (
                <button type="button" className={`mode-tab ${seatingMode === 'vip' ? 'active' : ''}`} onClick={() => { setSeatingMode('vip'); setToolbarMode('normal'); setSelectedGuestId(null); }}>
                  <Wine size={14} /> VIP 休息室
                </button>
              )}
            </div>
          )}

          <div className="guest-panel-scroll">
            <button
              type="button"
              className="guest-section-toggle guest-section-toggle--lead"
              onClick={() => setUnassignedGuestsOpen((o) => !o)}
              aria-expanded={unassignedGuestsOpen}
            >
              <ChevronDown size={16} className={`guest-section-chevron${unassignedGuestsOpen ? ' open' : ''}`} />
              <span>未排位嘉賓 ({unassigned.length})</span>
            </button>
            {unassignedGuestsOpen && (
              <>
                <input
                  type="search"
                  className="guest-list-search"
                  placeholder="搜尋嘉賓…"
                  value={sidebarGuestSearch}
                  onChange={(e) => setSidebarGuestSearch(e.target.value)}
                />
                <ul className="guest-list">
                  {visibleUnassigned.map((g) => {
                    const quota = getGuestQuotaStatus(seatingCtx, g, seatIndex);
                    return (
                      <li
                        key={g.id}
                        className={guestQuotaListItemClasses(quota, seatingMode, [
                          selectedGuestId === g.id ? 'selected' : '',
                          highlightGuestIds.includes(g.id) ? 'highlighted' : '',
                        ])}
                        onClick={() => toolbarMode === 'normal' && setSelectedGuestId(g.id)}
                      >
                        <strong>{g.name}</strong>
                        <span>{renderGuestQuotaMeta(g)}</span>
                      </li>
                    );
                  })}
                </ul>
                {unassigned.length === 0 && seatingMode === 'vip' && vipNotEligible.length > 0 && (
                  <p className="guest-list-empty-hint">
                    尚未勾選可進入 VIP 休息室的嘉賓。請在下方勾選，或到設定頁「嘉賓子活動出席」勾選 VIP。
                  </p>
                )}
                {unassigned.length === 0 && seatingMode !== 'vip' && (
                  <p className="guest-list-empty-hint">所有嘉賓皆已排位</p>
                )}
                {unassigned.length === 0 && seatingMode === 'vip' && vipNotEligible.length === 0 && (
                  <p className="guest-list-empty-hint">所有 VIP 嘉賓皆已排位</p>
                )}
                {unassigned.length > 0 && visibleUnassigned.length === 0 && (
                  <p className="guest-list-empty-hint">沒有符合搜尋的未排位嘉賓</p>
                )}
              </>
            )}

            {seatingMode === 'vip' && vipNotEligible.length > 0 && (
              <div className="guest-section vip-eligible-section">
                <p className="guest-section-caption">勾選可進入 VIP 休息室</p>
                <ul className="guest-list">
                  {vipNotEligible.map((g) => (
                    <li key={g.id} className="vip-eligible-row">
                      <label className="vip-eligible-label">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={(e) => {
                            if (!plan?.currentSubEventId || !e.target.checked) return;
                            recordHistory();
                            setGuestVipEligible(g.id, plan.currentSubEventId, true);
                          }}
                          aria-label={`允許 ${g.name} 進入 VIP 休息室`}
                        />
                        <strong>{g.name}</strong>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="guest-section assigned-section">
              <button
                type="button"
                className="guest-section-toggle"
                onClick={() => setAssignedGuestsOpen((o) => !o)}
                aria-expanded={assignedGuestsOpen}
              >
                <ChevronDown size={16} className={`guest-section-chevron${assignedGuestsOpen ? ' open' : ''}`} />
                <span>已排位嘉賓 ({assignedCount})</span>
              </button>
              {assignedGuestsOpen && (
                assignedCount === 0 ? (
                  <p className="guest-list-empty-hint">暫無已排位嘉賓</p>
                ) : (
                  <ul className="guest-list assigned-section-list">
                    {visibleAssigned.map((g) => {
                      const quota = getGuestQuotaStatus(seatingCtx, g, seatIndex);
                      return (
                        <li
                          key={g.id}
                          className={guestQuotaListItemClasses(quota, seatingMode, ['assigned-guest'])}
                          onClick={() => toolbarMode === 'normal' && setSelectedGuestId(g.id)}
                        >
                          <strong>
                            {g.name}
                            {quota.floor.full && seatingMode === 'audience' && (
                              <em className="quota-full-badge">已排滿</em>
                            )}
                            {quota.stage.full && seatingMode === 'stage' && (
                              <em className="quota-full-badge">已排滿</em>
                            )}
                            {quota.vip.full && seatingMode === 'vip' && (
                              <em className="quota-full-badge">已排滿</em>
                            )}
                          </strong>
                          <span>{renderGuestQuotaMeta(g)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )
              )}
            </div>
          </div>
        </aside>

        <div className="chart-panel">
          <div className="chart-panel-header no-print">
            <div className="chart-seat-stats">
              <span className="chart-seat-stats-mode">
                {seatingMode === 'stage' ? '台上' : seatingMode === 'vip' ? 'VIP' : '台下'}
              </span>
              <span className="chart-seat-stats-value">
                <strong>{seatStats.assigned}</strong>
                <span className="chart-seat-stats-sep">/</span>
                <span>{seatStats.total}</span>
              </span>
              <span className="chart-seat-stats-label">已排位</span>
            </div>
            {selectedGuestId && selectedGuestQuotaSummary && (
              <div className="chart-guest-quota">
                <strong>{guests.find((g) => g.id === selectedGuestId)?.name}</strong>
                <span>{selectedGuestQuotaSummary}</span>
              </div>
            )}
          </div>
          {chartReady ? (
            <DndContext
              sensors={sensors}
              onDragStart={(e) => {
                if (isDragDisabled) return;
                const guestId = e.active.data.current?.guestId;
                if (guestId) setDragGuestName(guests.find((g) => g.id === guestId)?.name ?? null);
              }}
              onDragEnd={(e) => {
                setDragGuestName(null);
                if (isDragDisabled) return;
                const fromSeatId = e.active.data.current?.seatId;
                const toSeatId = e.over?.data.current?.seatId;
                if (fromSeatId && toSeatId && fromSeatId !== toSeatId && canSwapSeats(seatingCtx, fromSeatId, toSeatId)) {
                  recordHistory();
                  swapSeats(fromSeatId, toSeatId);
                }
              }}
              onDragCancel={() => setDragGuestName(null)}
            >
              <PanZoomCanvas>
                <div className="seating-chart" id="seating-chart-export">
                  {seatingMode === 'vip' && hasVipLounge ? (
                    <div className="seating-zone vip-zone">
                      <h3 className="zone-label">
                        VIP 休息室 {toolbarMode === 'layout' && <em className="mode-badge">編輯布局</em>}
                        {seatingMode === 'vip' && toolbarMode === 'normal' && <em className="mode-badge">編輯中</em>}
                      </h3>
                      <VipLoungeCanvas
                        items={plan.vipLounge?.items ?? []}
                        seats={plan.seats}
                        assignments={plan.assignments}
                        guests={guests}
                        showTooltip={plan.showTooltip}
                        layoutMode={toolbarMode === 'layout'}
                        toolbarMode={toolbarMode}
                        selectedSeatId={selectedSeatId}
                        highlightGuestIds={highlightGuestIds}
                        guestQuotaByGuestId={guestQuotaByGuestId}
                        dragDisabled={isDragDisabled}
                        dndEnabled={dndReady && toolbarMode === 'normal'}
                        onSeatClick={handleSeatClick}
                        onRemoveGuest={(seatId, e) => {
                          e.stopPropagation();
                          if (toolbarMode !== 'normal') return;
                          const assignment = plan.assignments[seatId];
                          if (!assignment?.guestId || assignment.locked) return;
                          recordHistory();
                          assignGuest(seatId, null);
                        }}
                        onMoveItem={moveVipItem}
                        onRemoveItem={removeVipItem}
                        onAddSeat={addVipSeat}
                        onAddTable={addVipTable}
                        onAddChair={addVipChair}
                        onAlignItems={alignVipItems}
                      />
                    </div>
                  ) : (
                    <SeatingChart
                      view={seatingView}
                      plan={plan}
                      selectedSeatId={selectedSeatId}
                      highlightGuestIds={highlightGuestIds}
                      seatingMode={seatingMode}
                      toolbarMode={toolbarMode}
                      dragDisabled={isDragDisabled}
                      dndEnabled={dndReady && toolbarMode === 'normal'}
                      guestQuotaByGuestId={guestQuotaByGuestId}
                      aislePickSeatId={aislePickSeatId}
                      onSeatClick={handleSeatClick}
                      onTableClick={handleTableClick}
                      onRemoveGuest={(seatId, e) => {
                        e.stopPropagation();
                        if (toolbarMode !== 'normal') return;
                        const assignment = plan.assignments[seatId];
                        if (!assignment?.guestId || assignment.locked) return;
                        recordHistory();
                        assignGuest(seatId, null);
                      }}
                    />
                  )}
                </div>
              </PanZoomCanvas>
              <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
                {dragGuestName ? <div className="drag-overlay">{dragGuestName}</div> : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <PanZoomCanvas>
              <div className="chart-loading"><p>載入排位圖…</p></div>
            </PanZoomCanvas>
          )}
        </div>
      </div>

      {showRenumberGuide && (
        <Modal
          open
          onClose={() => setShowRenumberGuide(false)}
          title="改編號"
        >
          <p className="text-sm text-muted mb-4">
            進入改編號模式後，請在排位圖上操作：
          </p>
          <ul className="text-sm space-y-2 mb-6 list-disc pl-5 text-primary">
            <li>點擊座位可修改座位編號</li>
            <li>點擊枱號可修改桌號</li>
            <li>在彈出視窗中可選擇「與他位互換」或「與他桌互換」</li>
          </ul>
          <div className="flex flex-wrap gap-2 justify-end">
            <button type="button" className="btn-secondary" onClick={() => setShowRenumberGuide(false)}>
              取消
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setToolbarMode('renumber');
                setRenumberSwapFrom(null);
                setRenumberTableSwapFrom(null);
                setSelectedGuestId(null);
                setShowRenumberGuide(false);
                setToast('改編號模式：點擊座位或枱號進行修改');
              }}
            >
              開始改編號
            </button>
          </div>
        </Modal>
      )}

      {showRenumberModal && (
        <Modal open onClose={() => setShowRenumberModal(null)} title="修改座位編號">
          <label className="block text-sm font-medium mb-2">
            座位編號
            <input
              className="w-full mt-1"
              value={renumberValue}
              onChange={(e) => setRenumberValue(e.target.value)}
              autoFocus
            />
          </label>
          <div className="flex flex-wrap gap-2 justify-end mt-6">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setRenumberTableSwapFrom(null);
                setRenumberSwapFrom(showRenumberModal);
                setShowRenumberModal(null);
                setToast('請點擊另一座位以互換編號');
              }}
            >
              與他位互換
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowRenumberModal(null)}>
              取消
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const err = validateRenumber(plan, showRenumberModal, renumberValue);
                if (err) { showQuotaMessage(err); return; }
                recordHistory();
                setCustomNumber(showRenumberModal, renumberValue);
                setShowRenumberModal(null);
              }}
            >
              確認
            </button>
          </div>
        </Modal>
      )}

      {showTableRenumberModal && (
        <Modal open onClose={() => setShowTableRenumberModal(null)} title="修改桌號">
          <label className="block text-sm font-medium mb-2">
            桌號
            <input
              className="w-full mt-1"
              value={renumberTableValue}
              onChange={(e) => setRenumberTableValue(e.target.value)}
              autoFocus
            />
          </label>
          <div className="flex flex-wrap gap-2 justify-end mt-6">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setRenumberSwapFrom(null);
                setRenumberTableSwapFrom(showTableRenumberModal);
                setShowTableRenumberModal(null);
                setToast('請點擊另一枱以互換桌號');
              }}
            >
              與他桌互換
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowTableRenumberModal(null)}>
              取消
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const err = validateTableRenumber(plan, showTableRenumberModal, renumberTableValue);
                if (err) { showQuotaMessage(err); return; }
                recordHistory();
                setCustomTableNumber(showTableRenumberModal, renumberTableValue);
                setShowTableRenumberModal(null);
              }}
            >
              確認
            </button>
          </div>
        </Modal>
      )}

      {toast && <p className="import-notice import-notice--success">{toast}</p>}
    </div>
  );
}
