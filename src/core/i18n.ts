import ru from '../../data/i18n/ru.json';
export type TextKey = keyof typeof ru;
export function t(key: string, args: Record<string, string | number> = {}): string {
  let text: string = ru[key as TextKey] ?? key;
  for (const [name, value] of Object.entries(args)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}
export const number = (value: number) => Math.floor(value).toLocaleString('ru-RU');
