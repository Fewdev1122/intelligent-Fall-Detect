export function toMs(t) {
  if (!t) return null;
  if (typeof t?.toMillis === "function") return t.toMillis();
  if (typeof t === "number") return t;
  return null;
}

export function fmtTime(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}

export function msToMMSS(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}