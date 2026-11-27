// log กลางของแอดออน คำเตือนซ้ำถูกกรองด้วยคีย์ เพื่อไม่ให้ Content Log ท่วม
const warned = new Set();

export function warnOnce(key, err) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[bpc] ${key}: ${err?.stack ?? err}`);
}

export const info = (text) => console.log(`[bpc] ${text}`);
