import { expect, it } from 'vitest';
import { Tutorial, TUTORIAL_KEY } from '../src/core/tutorial';
it('обучение проходит действиями, переживает перезапуск и не меняет город', () => {
  const memory = new Map([['city', 'untouched']]);
  const storage = {getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>{memory.set(k,v);}};
  const guide = new Tutorial(storage); expect(guide.step).toBe('welcome');
  guide.next(); guide.next(); guide.signal('built'); expect(guide.step).toBe('demand');
  guide.signal('demand'); guide.signal('planned'); expect(guide.step).toBe('build');
  expect(new Tutorial(storage).step).toBe('plan'); guide.signal('built'); guide.signal('layers'); guide.signal('finance');
  expect(guide.step).toBe('extend'); guide.signal('extending'); expect(new Tutorial(storage).step).toBe('extend');
  guide.signal('cancel'); expect(guide.step).toBe('extend'); guide.signal('extending'); guide.signal('extended'); guide.next();
  expect(new Tutorial(storage).active).toBe(false); expect(memory.get('city')).toBe('untouched');
  memory.set(TUTORIAL_KEY, '{broken'); expect(new Tutorial(storage).step).toBe('welcome');
});
it('заблокированное хранилище не мешает завершить обучение', () => {
  const guide = new Tutorial({getItem:()=>{throw Error();},setItem:()=>{throw Error();}});
  guide.move('done'); expect(guide.active).toBe(false);
});
