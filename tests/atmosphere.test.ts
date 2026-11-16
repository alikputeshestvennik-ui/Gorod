import { describe, expect, it } from 'vitest';
import { daylight } from '../src/render/atmosphere';
import { readSettings, writeSettings, SETTINGS_KEY } from '../src/core/settings';
import { MapCamera } from '../src/render/camera';

describe('визуальное время', () => {
  it('стартует утром, повторяется через сутки и плавно проходит рассвет', () => {
    expect(daylight(0, 'auto')).toBe(1);
    expect(daylight(16 * 60, 'auto')).toBe(0);
    expect(daylight(24 * 60, 'auto')).toBe(daylight(0, 'auto'));
    const dawn = daylight(22 * 60, 'auto');
    expect(dawn).toBeGreaterThan(0); expect(dawn).toBeLessThan(1);
    expect(daylight(22 * 60 + 1, 'auto') - dawn).toBeLessThan(0.03);
  });
  it('фиксированное освещение не зависит от времени города', () => {
    for (const minute of [0, 360, 1200, 700000]) { expect(daylight(minute, 'day')).toBe(1); expect(daylight(minute, 'night')).toBe(0); }
  });
});
describe('настройки отдельно от прогресса', () => {
  it('переживает повреждение данных и запрет хранилища', () => {
    expect(readSettings({ getItem: () => '{broken' }).sound).toBe(false);
    expect(readSettings({ getItem: () => { throw Error(); } }).quality).toBe('medium');
    expect(readSettings({ getItem: () => JSON.stringify({ version: 1, quality: 'ultra', time: 'noon', sound: 'yes' }) })).toEqual({ version: 1, quality: 'medium', time: 'auto', sound: false });
  });
  it('сохраняет только свои настройки, включая выключенный звук', () => {
    const values = new Map([['gorodskoy-marshrut:stage2:v2', 'city']]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const settings = { version: 1, quality: 'low', time: 'night', sound: false } as const;
    expect(writeSettings(settings, storage)).toBe(true); expect(values.has(SETTINGS_KEY)).toBe(true);
    expect(readSettings(storage)).toEqual(settings); expect(values.get('gorodskoy-marshrut:stage2:v2')).toBe('city');
    expect(writeSettings(settings, { setItem: () => { throw Error(); } })).toBe(false);
  });
});
describe('камера', () => {
  const create = () => {
    const canvas = new EventTarget() as HTMLCanvasElement;
    canvas.setPointerCapture = () => {}; canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 844 }) as DOMRect;
    const controls = new MapCamera(canvas); controls.resize(390, 844);
    return { controls, canvas };
  };
  const pointer = (canvas: HTMLCanvasElement, type: string, id: number, x: number, y: number) => canvas.dispatchEvent(Object.assign(new Event(type), { pointerId: id, clientX: x, clientY: y }));
  it('плавно ограничивает масштаб и возвращает весь город', () => {
    const { controls } = create(); controls.changeZoom(100); controls.update(1); expect(controls.zoom).toBeCloseTo(3.5, 3);
    controls.changeZoom(0.001); controls.update(1); expect(controls.zoom).toBeCloseTo(0.7, 3);
    controls.rotate(1); controls.update(1); expect(controls.camera.position.x).toBeGreaterThan(10);
    controls.recenter(); controls.update(1); expect(controls.zoom).toBeCloseTo(1, 3); expect(controls.camera.position.x).toBeCloseTo(5.5, 2);
  });
  it('отменённый жест и два пальца не добавляют остановки в черновик', () => {
    const { controls, canvas } = create(); const stops: number[] = []; controls.building = true; controls.onStop = id => stops.push(id);
    pointer(canvas, 'pointerdown', 1, 195, 422); pointer(canvas, 'pointercancel', 1, 195, 422);
    pointer(canvas, 'pointerdown', 1, 170, 400); pointer(canvas, 'pointerdown', 2, 220, 440);
    pointer(canvas, 'pointermove', 1, 130, 380); pointer(canvas, 'pointermove', 2, 240, 460);
    pointer(canvas, 'pointerup', 1, 130, 380); pointer(canvas, 'pointerup', 2, 240, 460);
    controls.update(1); expect(stops).toEqual([]); expect(controls.zoom).toBeGreaterThan(1);
    expect(Number.isFinite(controls.camera.position.x)).toBe(true);
  });
});
