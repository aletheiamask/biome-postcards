// อ่านเขียน JSON ใน dynamic property อย่างปลอดภัย (target = world, player หรือ entity)
import { warnOnce } from "./log.js";

export function readJson(target, key, fallback) {
  const raw = target.getDynamicProperty(key);
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    try {
      target.setDynamicProperty(`${key}_bak`, raw); // เก็บของเสียไว้ตรวจ แล้วเริ่มข้อมูลใหม่
    } catch {
      /* สำรองไม่ได้ก็ยังต้องทำงานต่อ */
    }
    warnOnce(`bad-json:${key}`, e);
    return fallback;
  }
}

export function writeJson(target, key, value) {
  try {
    target.setDynamicProperty(key, JSON.stringify(value));
    return true;
  } catch (e) {
    warnOnce(`write:${key}`, e);
    return false;
  }
}

export function removeKey(target, key) {
  try {
    target.setDynamicProperty(key, undefined);
  } catch (e) {
    warnOnce(`remove:${key}`, e);
  }
}
