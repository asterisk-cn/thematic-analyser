const pad = (n: number) => String(n).padStart(2, '0');

export function fmtTime(s: number | null | undefined, withTenths = false): string {
  if (s == null || !Number.isFinite(s)) return '--:--';
  const neg = s < 0;
  const a = Math.abs(s);
  const h = Math.floor(a / 3600);
  const m = Math.floor((a % 3600) / 60);
  const sec = Math.floor(a % 60);
  let out = h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  if (withTenths) out += '.' + Math.floor((a % 1) * 10);
  return (neg ? '-' : '') + out;
}

/** "01:02:03.4" / "02:03" / "00:00:01,000" / "12.5" / 12.5 → 秒 */
export function parseTime(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(',', '.');
  if (/^-?\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  const m = t.match(/^(-)?(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (!m) return null;
  const val = Number(m[2] ?? 0) * 3600 + Number(m[3]) * 60 + parseFloat(m[4]);
  return m[1] ? -val : val;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
