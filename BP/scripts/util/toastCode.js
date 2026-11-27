// รหัสของการ์ดแจ้งเตือนที่ต่อท้ายข้อความ title
// ทุกตัวเป็นรหัสสี § จึงไม่แสดงผลใน title ปกติของเกม แต่ JSON UI ของแพ็ก (RP/ui/bpc_toast.json สร้างจาก tools/ui.mjs)
// อ่านรหัสนี้เพื่อเลือกธีมและภาพ ถ้า UI ของเราไม่ถูกโหลด ผู้เล่นจะเห็น title แบบเดิมที่ไม่มีอะไรแปลกปลอม
// โมดูลบริสุทธิ์: ห้าม import @minecraft/server (tools/ui.mjs และเทสต์ใช้ร่วมกัน)
const S = "§";

/** ตัวบอกว่า title นี้เป็นการ์ดของเรา */
export const MARK = `${S}b${S}p${S}c`;

/** ธีมของการ์ด ลำดับคือเลขในรหัส ห้ามสลับลำดับ (เพิ่มต่อท้ายได้ ไม่เกิน 10) */
export const THEMES = ["forests", "cold", "dry", "wet", "fields", "underground", "otherworld", "mystery", "festival", "reward"];

/** เลขภาพที่ไม่ใช่การ์ด (ภาพของการ์ด = เลข board ของการ์ดนั้น ซึ่งไม่เกิน 79) ชุดสะสมลำดับที่ i ใช้ SET_BASE + i */
export const PIC = Object.freeze({ album: 80, globe: 81, more: 82 });
export const PIC_SET_BASE = 90;

const digits = (n, len) => String(n).padStart(len, "0").replace(/\d/g, (d) => S + d);

/** รหัสธีม เช่น §t§3 (ธีมที่ไม่รู้จักใช้ mystery) */
export function themeCode(theme) {
  const i = THEMES.indexOf(theme);
  return `${S}t${digits(i < 0 ? THEMES.indexOf("mystery") : i, 1)}`;
}

/** รหัสภาพ เช่น §n§0§6 */
export const picCode = (pic) => `${S}n${digits(Math.min(99, Math.max(0, Math.trunc(pic) || 0)), 2)}`;

/** รหัสทั้งหมดที่ต่อท้าย title: ตัวบอก + ธีม + ภาพ */
export const toastCode = (theme, pic) => MARK + themeCode(theme) + picCode(pic);
