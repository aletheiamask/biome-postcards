// ค่าคงที่ของระบบ และค่าที่แอดมินปรับได้ (เก็บใน world DP bpc:cfg ผ่าน /bpc:settings)
import { readJson, writeJson } from "./util/storage.js";

export const CHECK_INTERVAL_TICKS = 20; // ความถี่ของลูปค้นพบ
export const CHECK_COHORTS = 3; // แบ่งผู้เล่นเป็นกลุ่ม ทุกคนถูกเช็คทุก 20 × 3 = 60 tick
export const MIN_MOVE_BLOCKS = 8; // ขยับน้อยกว่านี้ไม่เช็คใหม่
export const ALBUM_LIMIT = 64; // โปสการ์ดสูงสุดในอัลบั้ม
export const MYSTERY_LIMIT = 32; // การ์ดลึกลับสูงสุดต่อผู้เล่น

export const DEFAULTS = Object.freeze({
  creative: true, // ผู้เล่นโหมดสร้างสรรค์ได้โปสการ์ด
  mystery: true, // การ์ดลึกลับสำหรับไบโอมที่ไม่รู้จัก
  seasonal: true, // การ์ดเทศกาล
  foil: true, // แสตมป์ฟอยล์
  ownerLock: false, // เฉพาะคนแขวนถอดโปสการ์ดจากบอร์ดได้
  toast: true, // การ์ดแจ้งเตือนแบบเคลื่อนไหว (ปิด = title ธรรมดาของเกม)
});
const CFG_KEY = "bpc:cfg";
let current = { ...DEFAULTS };

export const settings = () => current;

export function loadSettings(world) {
  const saved = readJson(world, CFG_KEY, {});
  current = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (typeof saved?.[k] === "boolean") current[k] = saved[k];
}

export function saveSettings(world, patch) {
  for (const k of Object.keys(DEFAULTS)) if (typeof patch[k] === "boolean") current[k] = patch[k];
  return writeJson(world, CFG_KEY, current);
}
