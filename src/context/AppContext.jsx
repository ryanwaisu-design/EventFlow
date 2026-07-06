import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { loadAllData, saveAllData } from '../data/storage';
import { generateId, nowISO } from '../utils/helpers';
import { addCustomGuestCategory, getGuestCategories, removeCustomGuestCategory } from '../utils/guestCategories';
import { createEmptyPlan, normalizePlan, syncParticipantsFromAttendance, preparePlanForStorage } from '../seating/adapters/planAdapter';
import { migratePlanToSubEvents } from '../seating/adapters/planSubEvent';
import { writebackSeatingToAttendance } from '../seating/adapters/writebackAdapter';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [data, setData] = useState(() => loadAllData());
  const [toasts, setToasts] = useState([]);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');

  const persist = useCallback((next) => {
    setData((prev) => {
      const updated = typeof next === 'function' ? next(prev) : { ...prev, ...next };
      saveAllData(updated);
      return updated;
    });
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const navigate = useCallback((page, eventId) => {
    setCurrentPage(page);
    if (eventId !== undefined) setSelectedEventId(eventId);
    setSidebarOpen(false);
  }, []);

  const addGuest = useCallback((guest) => {
    const newGuest = { ...guest, id: generateId(), createdAt: nowISO(), updatedAt: nowISO() };
    persist((prev) => ({ ...prev, guests: [...prev.guests, newGuest] }));
    showToast('嘉賓已新增', 'success');
    return newGuest;
  }, [persist, showToast]);

  const updateGuest = useCallback((id, updates) => {
    persist((prev) => ({
      ...prev,
      guests: prev.guests.map((g) => (g.id === id ? { ...g, ...updates, updatedAt: nowISO() } : g)),
    }));
    showToast('嘉賓資料已更新', 'success');
  }, [persist, showToast]);

  const deleteGuest = useCallback((id) => {
    persist((prev) => ({
      ...prev,
      guests: prev.guests.filter((g) => g.id !== id),
      attendance: prev.attendance.filter((a) => a.guestId !== id),
    }));
    showToast('嘉賓已刪除', 'success');
  }, [persist, showToast]);

  const deleteGuests = useCallback((ids) => {
    const idSet = new Set(Array.isArray(ids) ? ids : [ids]);
    if (!idSet.size) return;
    persist((prev) => ({
      ...prev,
      guests: prev.guests.filter((g) => !idSet.has(g.id)),
      attendance: prev.attendance.filter((a) => !idSet.has(a.guestId)),
    }));
    showToast(`已刪除 ${idSet.size} 位嘉賓`, 'success');
  }, [persist, showToast]);

  const importGuests = useCallback((newGuests) => {
    persist((prev) => ({ ...prev, guests: [...prev.guests, ...newGuests] }));
    showToast(`已匯入 ${newGuests.length} 位嘉賓`, 'success');
  }, [persist, showToast]);

  const addEvent = useCallback((event) => {
    const newEvent = { ...event, id: generateId(), createdAt: nowISO(), updatedAt: nowISO() };
    persist((prev) => ({ ...prev, events: [...prev.events, newEvent] }));
    showToast('活動已建立', 'success');
    return newEvent;
  }, [persist, showToast]);

  const updateEvent = useCallback((id, updates) => {
    persist((prev) => ({
      ...prev,
      events: prev.events.map((e) => (e.id === id ? { ...e, ...updates, updatedAt: nowISO() } : e)),
    }));
    showToast('活動已更新', 'success');
  }, [persist, showToast]);

  const deleteEvent = useCallback((id) => {
    persist((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== id),
      attendance: prev.attendance.filter((a) => a.eventId !== id),
      seatingPlans: (prev.seatingPlans || []).filter((p) => p.eventId !== id),
    }));
    showToast('活動已刪除', 'success');
  }, [persist, showToast]);

  const duplicateEvent = useCallback((id) => {
    const original = data.events.find((e) => e.id === id);
    if (!original) return;
    const newId = generateId();
    const copy = { ...original, id: newId, name: `${original.name}（副本）`, createdAt: nowISO(), updatedAt: nowISO() };
    const relatedAttendance = data.attendance
      .filter((a) => a.eventId === id)
      .map((a) => ({ ...a, eventId: newId, status: 'draft', invitedDate: '', respondedDate: '', checkedInAt: '' }));
    persist((prev) => ({ ...prev, events: [...prev.events, copy], attendance: [...prev.attendance, ...relatedAttendance] }));
    showToast('活動已複製', 'success');
    return copy;
  }, [data.events, data.attendance, persist, showToast]);

  const addGuestsToEvent = useCallback((eventId, guestIds, { silent = false } = {}) => {
    const event = data.events.find((e) => e.id === eventId);
    if (!event) return 0;
    const existing = new Set(data.attendance.filter((a) => a.eventId === eventId).map((a) => a.guestId));
    const newRecords = guestIds
      .filter((gid) => !existing.has(gid))
      .map((guestId) => ({
        eventId, guestId,
        status: event.isRsvpRequired ? 'pending_invite' : 'draft',
        invitedDate: '', respondedDate: '', checkedInAt: '',
        tableNo: '', seatNo: '', companionCount: 0,
        dietaryNotes: '', vipNotes: '', internalNotes: '',
      }));
    if (!newRecords.length) {
      if (!silent) showToast('所選嘉賓已在活動中', 'warning');
      return 0;
    }
    persist((prev) => ({ ...prev, attendance: [...prev.attendance, ...newRecords] }));
    if (!silent) showToast(`已添加 ${newRecords.length} 位嘉賓`, 'success');
    return newRecords.length;
  }, [data.events, data.attendance, persist, showToast]);

  const updateAttendance = useCallback((eventId, guestId, updates) => {
    persist((prev) => ({
      ...prev,
      attendance: prev.attendance.map((a) =>
        a.eventId === eventId && a.guestId === guestId ? { ...a, ...updates } : a
      ),
    }));
  }, [persist]);

  const bulkUpdateAttendance = useCallback((eventId, guestIds, updates) => {
    const idSet = new Set(guestIds);
    persist((prev) => ({
      ...prev,
      attendance: prev.attendance.map((a) =>
        a.eventId === eventId && idSet.has(a.guestId) ? { ...a, ...updates } : a
      ),
    }));
    showToast(`已批量更新 ${guestIds.length} 位嘉賓`, 'success');
  }, [persist, showToast]);

  const removeFromEvent = useCallback((eventId, guestIds) => {
    const idSet = new Set(guestIds);
    persist((prev) => ({
      ...prev,
      attendance: prev.attendance.filter((a) => !(a.eventId === eventId && idSet.has(a.guestId))),
    }));
    showToast('已移除所選嘉賓', 'success');
  }, [persist, showToast]);

  const bulkMarkInvited = useCallback((eventId, guestIds) => {
    const event = data.events.find((e) => e.id === eventId);
    const today = nowISO().split('T')[0];
    bulkUpdateAttendance(eventId, guestIds, { status: event?.isRsvpRequired ? 'pending_reply' : 'invited', invitedDate: today });
  }, [data.events, bulkUpdateAttendance]);

  const bulkMarkAttending = useCallback((eventId, guestIds) => {
    bulkUpdateAttendance(eventId, guestIds, { status: 'attending', respondedDate: nowISO().split('T')[0] });
  }, [bulkUpdateAttendance]);

  const bulkMarkDeclined = useCallback((eventId, guestIds) => {
    bulkUpdateAttendance(eventId, guestIds, { status: 'declined', respondedDate: nowISO().split('T')[0] });
  }, [bulkUpdateAttendance]);

  const checkInGuest = useCallback((eventId, guestId) => {
    updateAttendance(eventId, guestId, { status: 'checked_in', checkedInAt: nowISO() });
    showToast('簽到成功', 'success');
  }, [updateAttendance, showToast]);

  const updateSettings = useCallback((updates) => {
    persist((prev) => ({ ...prev, settings: { ...prev.settings, ...updates } }));
    showToast('設定已儲存', 'success');
  }, [persist, showToast]);

  const addGuestCategory = useCallback((label) => {
    let key = null;
    let isNew = false;
    persist((prev) => {
      const before = prev.settings?.customGuestCategories || {};
      const result = addCustomGuestCategory(prev.settings, label);
      if (!result) return prev;
      key = result.key;
      const after = result.settings?.customGuestCategories || {};
      isNew = Boolean(after[key] && !before[key]);
      if (result.settings !== prev.settings) {
        return { ...prev, settings: result.settings };
      }
      return prev;
    });
    if (key && isNew) {
      showToast(`已新增類別「${label.trim()}」`, 'success');
    }
    return key;
  }, [persist, showToast]);

  const deleteGuestCategory = useCallback((key) => {
    persist((prev) => {
      const result = removeCustomGuestCategory(prev.settings, key);
      if (result.error) return prev;
      return { ...prev, settings: result.settings };
    });
    showToast('已刪除自訂類別', 'success');
  }, [persist, showToast]);

  const guestCategories = useMemo(() => getGuestCategories(data.settings), [data.settings]);

  const restoreBackup = useCallback((backup) => {
    persist(backup);
    showToast('資料已還原', 'success');
  }, [persist, showToast]);

  const getGuestById = useCallback((id) => data.guests.find((g) => g.id === id), [data.guests]);
  const getEventById = useCallback((id) => data.events.find((e) => e.id === id), [data.events]);
  const getEventAttendance = useCallback((eventId) => data.attendance.filter((a) => a.eventId === eventId), [data.attendance]);

  const getSeatingPlan = useCallback((eventId) => {
    const plans = data.seatingPlans || [];
    const plan = plans.find((p) => p.eventId === eventId) ?? null;
    if (!plan) return null;
    const event = data.events.find((e) => e.id === eventId);
    return migratePlanToSubEvents(plan, event);
  }, [data.seatingPlans, data.events]);

  const ensureSeatingPlan = useCallback((eventId) => {
    const existing = (data.seatingPlans || []).find((p) => p.eventId === eventId);
    const event = data.events.find((e) => e.id === eventId);
    if (existing) return migratePlanToSubEvents(existing, event);
    return createEmptyPlan(eventId, event);
  }, [data.seatingPlans, data.events]);

  const upsertSeatingPlan = useCallback((plan) => {
    const event = data.events.find((e) => e.id === plan.eventId);
    const normalized = preparePlanForStorage(migratePlanToSubEvents(plan, event));
    persist((prev) => {
      const plans = prev.seatingPlans || [];
      const idx = plans.findIndex((p) => p.eventId === normalized.eventId);
      const next = idx >= 0
        ? plans.map((p, i) => (i === idx ? normalized : p))
        : [...plans, normalized];
      return { ...prev, seatingPlans: next };
    });
    return normalized;
  }, [persist, data.events]);

  const syncSeatingParticipants = useCallback((eventId) => {
    const plan = ensureSeatingPlan(eventId);
    const records = data.attendance.filter((a) => a.eventId === eventId);
    const synced = syncParticipantsFromAttendance(plan, records);
    return upsertSeatingPlan(synced);
  }, [data.attendance, ensureSeatingPlan, upsertSeatingPlan]);

  const commitSeatingPlan = useCallback((plan, { writeback = true } = {}) => {
    const saved = upsertSeatingPlan(plan);
    if (writeback) {
      persist((prev) => ({
        ...prev,
        attendance: writebackSeatingToAttendance(saved, prev.attendance),
      }));
      showToast('排位已儲存並寫回出席記錄', 'success');
    }
    return saved;
  }, [persist, upsertSeatingPlan, showToast]);

  return (
    <AppContext.Provider value={{
      ...data, toasts, currentPage, sidebarOpen, selectedEventId,
      setSidebarOpen, setSelectedEventId, navigate, showToast, persist,
      addGuest, updateGuest, deleteGuest, deleteGuests, importGuests,
      addEvent, updateEvent, deleteEvent, duplicateEvent,
      addGuestsToEvent, updateAttendance, bulkUpdateAttendance, removeFromEvent,
      bulkMarkInvited, bulkMarkAttending, bulkMarkDeclined, checkInGuest,
      updateSettings, restoreBackup, getGuestById, getEventById, getEventAttendance,
      guestCategories, addGuestCategory, deleteGuestCategory,
      getSeatingPlan, ensureSeatingPlan, upsertSeatingPlan, syncSeatingParticipants, commitSeatingPlan,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
