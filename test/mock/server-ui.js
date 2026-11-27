// ตัวแทนของ @minecraft/server-ui สำหรับเทสต์
// ui.queue = คำตอบที่ผู้เล่นจะกดตามลำดับ (object หรือฟังก์ชันที่รับข้อมูลฟอร์ม) คิวหมด = ผู้เล่นปิดฟอร์ม
// ui.shown = ฟอร์มที่ถูกแสดงทั้งหมด

export const ui = {
  queue: [],
  shown: [],
  closed: [], // ผู้เล่นที่ถูก uiManager.closeAllForms
  reset() {
    this.queue.length = 0;
    this.shown.length = 0;
    this.closed.length = 0;
  },
};

export const uiManager = {
  closeAllForms(player) {
    ui.closed.push(player);
  },
};

const CLOSED = { canceled: true, cancelationReason: "UserClosed" };

class Form {
  constructor(kind) {
    this.data = { kind, buttons: [], toggles: [] };
  }
  title(text) {
    this.data.title = text;
    return this;
  }
  body(text) {
    this.data.body = text;
    return this;
  }
  show(player) {
    ui.shown.push({ ...this.data, player });
    const next = ui.queue.shift();
    if (next === undefined) return Promise.resolve(CLOSED);
    return Promise.resolve(typeof next === "function" ? next(this.data) : next);
  }
}

export class ActionFormData extends Form {
  constructor() {
    super("action");
  }
  button(text, icon) {
    this.data.buttons.push({ text, icon });
    return this;
  }
}

export class MessageFormData extends Form {
  constructor() {
    super("message");
  }
  button1(text) {
    this.data.buttons[0] = { text };
    return this;
  }
  button2(text) {
    this.data.buttons[1] = { text };
    return this;
  }
}

export class ModalFormData extends Form {
  constructor() {
    super("modal");
  }
  toggle(label, options) {
    this.data.toggles.push({ label, options });
    return this;
  }
  submitButton() {
    return this;
  }
}

/** lang key ทั้งหมดใน RawMessage (ไล่ลึกถึงอาร์กิวเมนต์) */
export function keysOf(message) {
  const out = [];
  const walk = (m) => {
    if (!m || typeof m !== "object") return;
    if (Array.isArray(m)) return m.forEach(walk);
    if (m.translate) out.push(m.translate);
    walk(m.rawtext);
    walk(m.with);
  };
  walk(message);
  return out;
}

/** คำตอบ: กดปุ่มที่มี lang key นี้ */
export const press = (key) => (form) => {
  const index = form.buttons.findIndex((b) => keysOf(b.text).includes(key));
  if (index < 0) throw new Error(`no button with key ${key} in form ${JSON.stringify(form.title)}`);
  return { canceled: false, selection: index };
};

/** คำตอบ: กดปุ่มลำดับที่ n */
export const pressIndex = (n) => ({ canceled: false, selection: n });
