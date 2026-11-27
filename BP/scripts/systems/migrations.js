// แปลงข้อมูล schema เก่าเป็นปัจจุบัน โมดูลบริสุทธิ์ ห้าม import @minecraft/server
// กฎ: ห้ามลด schema ถ้าข้อมูลใหม่กว่าแอดออน ให้คืนสถานะ "newer" แล้วผู้เรียกหยุดเขียน

export const CURRENT = 1;

// ขั้นอัปเกรดทีละเวอร์ชัน: STEPS[n] รับข้อมูล v = n แล้วคืนข้อมูล v = n + 1
// v1.0 เพิ่มแค่ฟิลด์ foil/st ที่ไม่มีค่าเริ่มต้น จึงยังเป็น schema 1
const COLLECTION_STEPS = {};
const ALBUM_STEPS = {};

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** ไล่อัปเกรดทีละเวอร์ชันจนถึง target คืน null ถ้าขาดขั้น */
export function upgrade(data, steps, target = CURRENT) {
  let cur = data;
  while (cur.v < target) {
    const step = steps[cur.v];
    if (!step) return null;
    cur = step(cur);
  }
  return cur;
}

function migrate(raw, steps, fresh, valid) {
  if (raw === null || raw === undefined) return { data: fresh(), status: "new" };
  if (!isObject(raw) || !Number.isInteger(raw.v) || raw.v < 1 || !valid(raw)) return { data: fresh(), status: "reset" };
  if (raw.v > CURRENT) return { data: raw, status: "newer" };
  if (raw.v === CURRENT) return { data: raw, status: "ok" };
  const up = upgrade(raw, steps);
  return up ? { data: up, status: "upgraded" } : { data: fresh(), status: "reset" };
}

/**
 * ความคืบหน้าของผู้เล่น (bpc:col)
 * @returns {{data: {v: number, cards: Record<string, object>}, status: "new"|"ok"|"upgraded"|"newer"|"reset"}}
 */
export function migrateCollection(raw) {
  return migrate(raw, COLLECTION_STEPS, () => ({ v: CURRENT, cards: {} }), (r) => isObject(r.cards));
}

/**
 * โปสการ์ดที่ฝากในอัลบั้ม (bpc:album)
 * @returns {{data: {v: number, items: object[]}, status: "new"|"ok"|"upgraded"|"newer"|"reset"}}
 */
export function migrateAlbum(raw) {
  return migrate(raw, ALBUM_STEPS, () => ({ v: CURRENT, items: [] }), (r) => Array.isArray(r.items));
}

/** ธงของผู้เล่น (bpc:flags) ไม่มีเลข schema ฟิลด์ที่ไม่รู้จักถูกทิ้ง */
export function migrateFlags(raw) {
  const r = isObject(raw) ? raw : {};
  return {
    album: Boolean(r.album), // ได้อัลบั้มเล่มแรกแล้ว
    welcome: Boolean(r.welcome), // เห็นข้อความต้อนรับแล้ว
    sets: Array.isArray(r.sets) ? r.sets.filter((s) => typeof s === "string") : [], // ชุดที่รับรางวัลแล้ว
    grand: Boolean(r.grand), // รับ Traveler's Globe แล้ว
  };
}
