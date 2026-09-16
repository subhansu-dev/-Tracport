import { Inspection } from '../types';

const STORAGE_KEY = 'tracport_inspections_v1';
const QUEUE_KEY = 'tracport_offline_queue_v1';

// Seed sample inspections if completely empty
const DEFAULT_INSPECTIONS: Inspection[] = [
  {
    id: 'insp_sample_1',
    location: 'Building A, Floor 3, Room 302',
    gpsCoords: {
      latitude: 28.6139,
      longitude: 77.2090,
      accuracy: 12,
      address: 'Central Corridor, Terminal Zone'
    },
    peopleCount: '3',
    people: ['Rajesh Kumar', 'Anita Sharma', 'Vikram Patel'],
    images: [],
    description: 'Routine structural inspection completed. All fire exits clear and electrical panels secure. Air circulation vents checked and operational.',
    rating: 5,
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    isSynced: true
  },
  {
    id: 'insp_sample_2',
    location: 'Warehouse Dock 4 — South Ramp',
    gpsCoords: {
      latitude: 28.6145,
      longitude: 77.2105,
      accuracy: 8,
      address: 'Dock 4 Logistics Bay'
    },
    peopleCount: '2',
    people: ['Manish Singh', 'Devendra Rao'],
    images: [],
    description: 'Cargo loading dock check. Hydraulic lift seals intact; pallet staging markings refreshed. Minor paint scuffs noted near bay 2.',
    rating: 4,
    createdAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    isSynced: true
  }
];

export function getLocalInspections(): Inspection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_INSPECTIONS));
      return DEFAULT_INSPECTIONS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading from localStorage', e);
    return DEFAULT_INSPECTIONS;
  }
}

export function setLocalInspections(items: Inspection[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Error writing to localStorage', e);
  }
}

export function getOfflineQueue(): Inspection[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setOfflineQueue(queue: Inspection[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Error saving queue to localStorage', e);
  }
}

export async function fetchAllInspections(): Promise<{ inspections: Inspection[]; fromServer: boolean }> {
  try {
    const response = await fetch('/api/inspections', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (response.ok) {
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        // Any item fetched from the server database is confirmed synced
        const serverItems: Inspection[] = result.data.map((item: any) => ({
          ...item,
          isSynced: true,
        }));

        const local = getLocalInspections();
        const serverIdSet = new Set(serverItems.map((s) => s.id));

        // Preserve any local reports that are still saved offline and NOT yet in server
        const unsyncedOffline = local.filter((l) => !l.isSynced && !serverIdSet.has(l.id));

        const merged: Inspection[] = [...unsyncedOffline, ...serverItems];
        setLocalInspections(merged);
        setOfflineQueue(unsyncedOffline);

        return { inspections: merged, fromServer: true };
      }
    }
  } catch (err) {
    console.warn('Backend server unreachable, falling back to local storage:', err);
  }

  // If server is unreachable, ensure local items reflect queue
  const local = getLocalInspections();
  return { inspections: local, fromServer: false };
}

export async function saveInspectionReport(
  inspection: Omit<Inspection, 'id' | 'createdAt'> & { isSynced?: boolean }
): Promise<{ inspection: Inspection; savedOnline: boolean }> {
  // If user explicitly chose Save Offline or device is currently offline
  const isExplicitOffline = inspection.isSynced === false;
  const isActuallyOnline = navigator.onLine && !isExplicitOffline;

  const newInspection: Inspection = {
    ...inspection,
    id: `insp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    isSynced: isActuallyOnline,
  };

  // 1. Save into client localStorage
  const current = getLocalInspections();
  const updated = [newInspection, ...current.filter(i => i.id !== newInspection.id)];
  setLocalInspections(updated);

  // 2. If saving offline, add to offline queue
  if (!isActuallyOnline) {
    const queue = getOfflineQueue();
    if (!queue.some(q => q.id === newInspection.id)) {
      queue.push(newInspection);
      setOfflineQueue(queue);
    }
    return { inspection: newInspection, savedOnline: false };
  }

  // 3. If online and submitting report, post to server API
  try {
    const res = await fetch('/api/inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newInspection),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const syncedItem: Inspection = { ...json.data, isSynced: true };
        setLocalInspections([syncedItem, ...current.filter(i => i.id !== syncedItem.id)]);
        return { inspection: syncedItem, savedOnline: true };
      }
    }
    throw new Error('Server returned non-200');
  } catch (err) {
    console.warn('Server save failed, enqueuing for later sync:', err);
    newInspection.isSynced = false;
    const queue = getOfflineQueue();
    if (!queue.some(q => q.id === newInspection.id)) {
      queue.push(newInspection);
      setOfflineQueue(queue);
    }
    return { inspection: newInspection, savedOnline: false };
  }
}

export async function submitSingleOfflineReport(inspectionId: string): Promise<boolean> {
  const current = getLocalInspections();
  const target = current.find(i => i.id === inspectionId);
  if (!target) return false;

  try {
    const res = await fetch('/api/inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...target, isSynced: true }),
    });

    if (res.ok) {
      // Remove from offline queue
      const queue = getOfflineQueue().filter(q => q.id !== inspectionId);
      setOfflineQueue(queue);

      // Update local storage to synced
      const updated = current.map(i => (i.id === inspectionId ? { ...i, isSynced: true } : i));
      setLocalInspections(updated);
      return true;
    }
  } catch (err) {
    console.error('Failed to submit single report to server:', err);
  }
  return false;
}

export async function deleteInspectionReport(id: string): Promise<boolean> {
  // Update local
  const current = getLocalInspections();
  const filtered = current.filter(i => i.id !== id);
  setLocalInspections(filtered);

  // Also remove from offline queue if present
  const queue = getOfflineQueue();
  setOfflineQueue(queue.filter(q => q.id !== id));

  // If online, remove from server
  if (navigator.onLine) {
    try {
      await fetch(`/api/inspections/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Failed to delete on server:', e);
    }
  }

  return true;
}

export async function syncPendingQueue(): Promise<number> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  const remaining: Inspection[] = [];
  const syncedIds: string[] = [];

  for (const item of queue) {
    try {
      const res = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, isSynced: true }),
      });
      if (res.ok) {
        syncedIds.push(item.id);
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  setOfflineQueue(remaining);

  // Mark items as synced in local list
  if (syncedIds.length > 0) {
    const syncedSet = new Set(syncedIds);
    const list = getLocalInspections().map(i => {
      if (syncedSet.has(i.id)) {
        return { ...i, isSynced: true };
      }
      return i;
    });
    setLocalInspections(list);
  }

  return syncedIds.length;
}
