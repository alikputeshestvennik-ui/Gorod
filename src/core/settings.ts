export type Quality = 'low' | 'medium' | 'high';
export type TimeOfDay = 'auto' | 'day' | 'night';
export interface Settings { version: 1; quality: Quality; time: TimeOfDay; sound: boolean }
export const SETTINGS_KEY = 'gorodskoy-marshrut:settings:v1';
export function readSettings(storage: Pick<Storage, 'getItem'>): Settings {
  const defaults: Settings = { version: 1, quality: 'medium', time: 'auto', sound: false };
  try {
    const value = JSON.parse(storage.getItem(SETTINGS_KEY) ?? 'null');
    if (value?.version !== 1) return defaults;
    return { version: 1, quality: ['low', 'medium', 'high'].includes(value.quality) ? value.quality : 'medium', time: ['auto', 'day', 'night'].includes(value.time) ? value.time : 'auto', sound: typeof value.sound === 'boolean' ? value.sound : false };
  } catch { return defaults; }
}
export function writeSettings(settings: Settings, storage: Pick<Storage, 'setItem'>): boolean {
  try { storage.setItem(SETTINGS_KEY, JSON.stringify(settings)); return true; } catch { return false; }
}
