/** A temporary editor; committed stops stay intact until confirmation. */
export class RouteDraft {
  stops: number[];
  side: 'start' | 'end' = 'end';
  constructor(readonly original: readonly number[] = [], readonly extending = false) {
    this.stops = [...original];
  }
  get changed() { return this.stops.join(',') !== this.original.join(','); }
  get endpoint() { return this.side === 'start' ? this.stops[0] : this.stops.at(-1); }
  add(id: number): 'added' | 'endpoint' | 'existing' {
    if (this.stops.includes(id)) {
      if (this.extending && (id === this.stops[0] || id === this.stops.at(-1))) {
        this.side = id === this.stops[0] ? 'start' : 'end';
        return 'endpoint';
      }
      return 'existing';
    }
    this.side === 'start' ? this.stops.unshift(id) : this.stops.push(id);
    return 'added';
  }
  remove(index: number) {
    if (index < 0 || index >= this.stops.length) return;
    if (!this.extending || !this.original.includes(this.stops[index])) this.stops.splice(index, 1);
  }
  undo() { this.remove(this.side === 'start' ? 0 : this.stops.length - 1); }
  clear() { this.stops = this.extending ? [...this.original] : []; }
}
