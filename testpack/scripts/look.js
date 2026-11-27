// ชุดตรวจด้วยตากับผู้เล่นจริง (tools/look.mjs, testpack=look) ใช้ API stable + server-ui
// ทุกชุดแค่ "สั่งให้แสดง" แล้วจบทันที ผลของฟอร์มรายงานตามมาเป็น NOTE เมื่อ promise จบ
import { world } from "@minecraft/server";
import { ActionFormData, MessageBox, MessageFormData, ModalFormData, uiManager } from "@minecraft/server-ui";
import { fail, note } from "./lib.js";

const S = "§";
const MARK = `${S}b${S}p${S}c`;
const player = () => {
  const p = world.getAllPlayers()[0];
  if (!p) throw new Error("no player in the world");
  return p;
};
const report = (name, promise) =>
  promise.then(
    (r) => note(name, `resolved canceled=${r.canceled} reason=${r.cancelationReason ?? "-"} selection=${r.selection ?? "-"}`),
    (e) => fail(name, `rejected ${e}`),
  );
const T = (key, ...w) => (w.length ? { translate: key, with: w.map(String) } : { translate: key });
const raw = (...parts) => ({ rawtext: parts });

// ฟอร์มทดลอง: เพิ่มความซับซ้อนทีละขั้นเพื่อหาว่า client ไม่รับอะไร
const VARIANTS = {
  0: () => new ActionFormData().title("Lab 0 plain").body("plain strings, no icons").button("One").button("Two"),
  1: () => new ActionFormData().title(raw(T("bpc.ui.album.title"))).body(raw(T("bpc.ui.withdraw.body"))).button(raw(T("bpc.ui.album.view"))).button(raw(T("bpc.ui.back"))),
  2: () =>
    new ActionFormData()
      .title(raw(T("bpc.ui.album.title")))
      .body(raw(T("bpc.ui.album.body", 0, 31), { text: "\n" }, T("bpc.ui.album.body2", 0, 0, 0)))
      .button(raw(T("bpc.ui.album.deposit", 3)))
      .button(raw(T("bpc.ui.album.withdraw", 0))),
  3: () =>
    new ActionFormData()
      .title(raw(T("bpc.ui.album.title")))
      .body(raw(T("bpc.ui.album.body", 0, 31), { text: "\n" }, T("bpc.ui.album.body2", 0, 0, 0)))
      .button(raw(T("bpc.ui.album.view")), "textures/items/postcards/plains")
      .button(raw(T("bpc.ui.album.deposit", 3)), "textures/items/album")
      .button(raw(T("bpc.ui.album.withdraw", 0)), "textures/items/album")
      .button(raw(T("bpc.ui.album.sets")), "textures/blocks/decor/traveler_globe")
      .button(raw(T("bpc.ui.album.copy")), "textures/items/blank_postcard"),
  4: () => new ActionFormData().title("Lab 4 icons").body("plain strings with icons").button("One", "textures/items/postcards/plains").button("Two", "textures/items/album"),
  6: () => new MessageFormData().title(raw(T("bpc.card.plains"))).body(raw(T("bpc.ui.copy.confirm"))).button1(raw(T("bpc.ui.copy.yes"))).button2(raw(T("bpc.ui.cancel"))),
  7: () => new ModalFormData().title(raw(T("bpc.ui.settings.title"))).toggle(raw(T("bpc.ui.settings.creative")), { defaultValue: true }).toggle(raw(T("bpc.ui.settings.foil")), { defaultValue: false }),
};

async function formlab([which = "0"]) {
  const p = player();
  if (which === "5") {
    // สองฟอร์มใน tick เดียวกัน
    report("formlab 5a", new ActionFormData().title("Lab 5 A").body("first of two in one tick").button("A").show(p));
    report("formlab 5b", new ActionFormData().title("Lab 5 B").body("second of two in one tick").button("B").show(p));
    return;
  }
  const make = VARIANTS[which];
  if (!make) return fail("formlab", `no variant ${which}`);
  report(`formlab ${which}`, make().show(p));
}

async function closeforms() {
  uiManager.closeAllForms(player());
  note("closeforms", "done");
}

const THAI = "ภาษาไทย: สวัสดี ทุ่งหญ้าบนเขา ป่าไผ่ ที่นี่ น้ำ ผู้เล่น ก่อนหน้า เก็บโปสการ์ด";
const THAI2 = "อัลบั้มโปสการ์ด สะสมแล้ว 12/31 ดินแดนหิมะ ยอดน้ำแข็ง ถ้ำเขียวชอุ่ม ฝากทั้งหมด";

async function thai([where = "chat"]) {
  const p = player();
  if (where === "chat") {
    p.sendMessage(THAI);
    p.sendMessage(`${S}e${THAI2}`);
  } else if (where === "title") {
    p.onScreenDisplay.setTitle("ดงซากุระ", { subtitle: "สะสมแล้ว 12 / 31", fadeInDuration: 0, stayDuration: 200, fadeOutDuration: 0 });
    p.onScreenDisplay.setActionBar(THAI);
  } else if (where === "form") {
    report("thai form", new ActionFormData().title("อัลบั้มโปสการ์ด").body(`${THAI}\n${THAI2}`).button("ดูคอลเลกชัน", "textures/items/postcards/plains").button("ฝากทั้งหมด (ในกระเป๋า 3 ใบ)").button("ชุดสะสม").show(p));
  } else if (where === "box") {
    new MessageBox(p, "อัลบั้มโปสการ์ด").body(`${THAI}\n${THAI2}`).button1("ตกลง").button2("ยกเลิก").show().then(
      (r) => note("thai box", `closed ${r.closeReason} selection=${r.selection ?? "-"}`),
      (e) => fail("thai box", String(e)),
    );
  } else fail("thai", `unknown target ${where}`);
}

// title สำหรับหน้าทดลอง UI: รหัสสี § ต่อท้ายข้อความจะไม่แสดงผลใน title ปกติของเกม
const TITLES = {
  lab1: [`banana${MARK}${S}n${S}0${S}6`, "sub one"],
  lab2: ["plain hello", "no marker"],
  lab3: [`plains${MARK}`, "texture test"],
  lab4: [`${MARK}${S}n${S}0${S}6Cherry Grove`, "marker first"],
};
async function title([which = "lab1", stay = "200"]) {
  const t = TITLES[which];
  if (!t) return fail("title", `unknown ${which}`);
  player().onScreenDisplay.setTitle(t[0], { subtitle: t[1], fadeInDuration: 0, stayDuration: Number(stay), fadeOutDuration: 0 });
  note("title", `${which} sent`);
}

export const suites = { formlab, closeforms, thai, title };
