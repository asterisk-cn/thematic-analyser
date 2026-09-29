/**
 * 複数の <video>/<audio> を 1 本のグローバルタイムラインで同時再生するエンジン。
 *
 * - グローバル時刻 t におけるメディアのローカル時刻 = t - offset
 * - 再生中は「範囲内で再生できている最初の要素」をマスタークロックとし、
 *   他の要素はドリフトが閾値を超えたらシークで追従させる
 * - メディアが無くても仮想クロックで進む（トランスクリプトだけを追いかける用途）
 */

interface Entry {
  el: HTMLMediaElement;
  offset: number;
}

export interface EngineSnap {
  time: number;
  playing: boolean;
  duration: number;
  rate: number;
}

const DRIFT = 0.25;

class SyncEngine {
  private entries = new Map<string, Entry>();
  private playing = false;
  private rate = 1;
  private anchorTime = 0;
  private anchorWall = 0;
  private extent = 0;
  private raf = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastStep = 0;

  /** UI から参照するリアクティブなスナップショット */
  snap = $state.raw<EngineSnap>({ time: 0, playing: false, duration: 0, rate: 1 });

  private now() {
    return performance.now() / 1000;
  }
  private clock() {
    return this.playing ? this.anchorTime + (this.now() - this.anchorWall) * this.rate : this.anchorTime;
  }
  private reanchor(t: number) {
    this.anchorTime = t;
    this.anchorWall = this.now();
  }
  private emit() {
    this.snap = { time: this.clock(), playing: this.playing, duration: this.duration(), rate: this.rate };
  }

  duration() {
    let d = this.extent;
    for (const { el, offset } of this.entries.values()) {
      if (Number.isFinite(el.duration)) d = Math.max(d, offset + el.duration);
    }
    return d;
  }

  register(id: string, el: HTMLMediaElement, offset: number) {
    const entry: Entry = { el, offset };
    this.entries.set(id, entry);
    el.playbackRate = this.rate;
    const onMeta = () => {
      this.syncEntry(entry, this.clock(), true);
      this.emit();
    };
    el.addEventListener('loadedmetadata', onMeta);
    if (el.readyState >= 1) onMeta();
    return () => {
      el.removeEventListener('loadedmetadata', onMeta);
      el.pause();
      this.entries.delete(id);
      this.emit();
    };
  }

  setOffset(id: string, offset: number) {
    const e = this.entries.get(id);
    if (!e || e.offset === offset) return;
    e.offset = offset;
    this.syncEntry(e, this.clock(), true);
    this.emit();
  }

  /** メディア以外（トランスクリプト）の長さ */
  setExtent(x: number) {
    this.extent = Math.max(0, x);
    this.emit();
  }

  play() {
    if (this.playing) return;
    const d = this.duration();
    let t = this.clock();
    if (d > 0 && t >= d - 0.05) t = 0;
    this.reanchor(t);
    this.playing = true;
    for (const e of this.entries.values()) this.syncEntry(e, t, true);
    this.startLoop();
    this.emit();
  }

  pause() {
    const t = this.clock();
    this.playing = false;
    this.reanchor(t);
    this.stopLoop();
    for (const { el } of this.entries.values()) el.pause();
    this.emit();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t: number) {
    const d = this.duration();
    const nt = Math.max(0, d > 0 ? Math.min(t, d) : t);
    this.reanchor(nt);
    for (const e of this.entries.values()) this.syncEntry(e, nt, true);
    this.emit();
  }

  nudge(dt: number) {
    this.seek(this.clock() + dt);
  }

  setRate(r: number) {
    this.reanchor(this.clock());
    this.rate = r;
    for (const { el } of this.entries.values()) el.playbackRate = r;
    this.emit();
  }

  private syncEntry(e: Entry, t: number, force: boolean) {
    const { el, offset } = e;
    const local = t - offset;
    const dur = el.duration;
    const known = Number.isFinite(dur);
    const inRange = local >= 0 && (!known || local < dur);
    if (!inRange) {
      if (!el.paused) el.pause();
      if (force && el.readyState >= 1) el.currentTime = local < 0 ? 0 : known ? dur : 0;
      return;
    }
    if (force || Math.abs(el.currentTime - local) > DRIFT) el.currentTime = local;
    if (el.playbackRate !== this.rate) el.playbackRate = this.rate;
    if (this.playing && el.paused) el.play().catch(() => {});
    if (!this.playing && !el.paused) el.pause();
  }

  private startLoop() {
    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
    this.raf = requestAnimationFrame(this.loop);
    // タブが裏にあると rAF が止まるので、その間はタイマーで同期を続ける
    this.timer = setInterval(() => {
      if (this.now() - this.lastStep > 0.2) this.step();
    }, 250);
  }

  private stopLoop() {
    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
  }

  private loop = () => {
    if (!this.playing) return;
    this.step();
    if (this.playing) this.raf = requestAnimationFrame(this.loop);
  };

  private step() {
    if (!this.playing) return;
    this.lastStep = this.now();
    let t = this.clock();

    let master: Entry | null = null;
    for (const e of this.entries.values()) {
      if (!e.el.paused && !e.el.seeking && e.el.readyState >= 3) {
        master = e;
        break;
      }
    }
    if (master) {
      const tm = master.el.currentTime + master.offset;
      if (Math.abs(tm - t) < 0.5) {
        this.reanchor(tm);
        t = tm;
      }
    }
    for (const e of this.entries.values()) if (e !== master) this.syncEntry(e, t, false);

    const d = this.duration();
    if (d > 0 && t >= d) {
      this.reanchor(d);
      this.pause();
      return;
    }
    this.emit();
  }
}

export const engine = new SyncEngine();
