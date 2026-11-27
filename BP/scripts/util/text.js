// ตัวช่วยสร้าง RawMessage ข้อความในเกมทุกชิ้นต้องผ่าน lang key
const part = (a) => (a !== null && typeof a === "object" ? a : { text: String(a) });

/** ส่วน translate หนึ่งชิ้น อาร์กิวเมนต์เป็นข้อความหรือส่วน RawMessage อื่นก็ได้ */
export function tr(key, ...args) {
  if (!args.length) return { translate: key };
  if (args.some((a) => a !== null && typeof a === "object")) return { translate: key, with: { rawtext: args.map(part) } };
  return { translate: key, with: args.map(String) };
}

/** รวมหลายส่วนเป็น RawMessage (สตริงธรรมดาใช้ได้เฉพาะตัวคั่นอย่างขึ้นบรรทัดใหม่) */
export const raw = (...parts) => ({ rawtext: parts.map(part) });

export const msg = (key, ...args) => raw(tr(key, ...args));
