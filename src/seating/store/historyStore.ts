import { create } from 'zustand';
import type { Guest, GuestParticipation, Seat, SeatAssignment } from '../types';

export interface HistorySnapshot {
  guests: Guest[];
  assignments: Record<string, SeatAssignment>;
  seats: Seat[];
  customTableNumbers?: Record<string, string | number>;
  participations?: Record<string, GuestParticipation>;
}

interface HistoryStore {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  push: (snapshot: HistorySnapshot) => void;
  undo: (current: HistorySnapshot) => HistorySnapshot | null;
  redo: (current: HistorySnapshot) => HistorySnapshot | null;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const MAX = 20;
const clone = <T>(v: T): T => structuredClone(v);

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],

  push: (snapshot) => {
    set((s) => ({
      past: [...s.past.slice(-MAX + 1), clone(snapshot)],
      future: [],
    }));
  },

  undo: (current) => {
    const { past } = get();
    if (past.length === 0) return null;
    const prev = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [clone(current), ...get().future],
    });
    return prev;
  },

  redo: (current) => {
    const { future } = get();
    if (future.length === 0) return null;
    const next = future[0];
    set({
      future: future.slice(1),
      past: [...get().past, clone(current)],
    });
    return next;
  },

  clear: () => set({ past: [], future: [] }),
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
