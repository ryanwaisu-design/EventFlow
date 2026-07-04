import type { Guest } from '../types';

export function buildGuestMap(guests: Guest[]): Map<string, Guest> {
  return new Map(guests.map((g) => [g.id, g]));
}

export function getGuestFromMap(map: Map<string, Guest>, id: string | null): Guest | null {
  if (!id) return null;
  return map.get(id) ?? null;
}
