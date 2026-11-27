// JSON UI ของแอดออน (สร้างโดย tools/build.mjs ลง RP/ui ห้ามแก้ไฟล์ที่สร้างด้วยมือ)
// toastUi() = การ์ดแจ้งเตือนแบบปุ่ม Marketplace ที่มุมขวาบน
// labUi()   = หน้าทดลอง: พิมพ์ผลของสิ่งที่ยังไม่แน่ใจเกี่ยวกับ JSON UI ลงบนจอ ใช้กับ tools/look.mjs sync --lab เท่านั้น
import { MARK, PIC, PIC_SET_BASE, THEMES, picCode, themeCode } from "../BP/scripts/util/toastCode.js";

export { MARK };
/** ขนาดของแถบเฟรมที่ art/toast.px.js วาด (tools/art.mjs ตรวจขนาดไฟล์ด้วยค่าชุดเดียวกัน) */
export const TOAST_ART = Object.freeze({ frameW: 80, frameH: 16, frames: 8, fps: 8 });

const TITLE = "#hud_title_text_string";
const SUB = "#hud_subtitle_text_string";
const global = (name, extra = {}) => ({ binding_name: name, binding_type: "global", ...extra });
const view = (expr, target) => ({ binding_type: "view", source_property_name: expr, target_property_name: target });
// เติมคำนำหน้าให้ข้อความเป็นสตริงเสมอ: title ที่เป็นตัวเลขล้วน (เช่นนับถอยหลังของแอดออนอื่น) จะไม่ถูกคิดเป็นตัวเลข
const TEXT = `('bpc:' + ${TITLE})`;
const lacks = (code) => `((${TEXT} - '${code}') = ${TEXT})`;
const has = (code) => `(not ${lacks(code)})`;
const label = (extra) => ({ type: "label", size: ["default", 10], color: [1, 1, 1], shadow: true, localize: false, ...extra });

/** ภาพเล็กทางซ้ายของการ์ด: [เลขภาพ, เท็กซ์เจอร์ 16×16] เลขของการ์ด = board, ที่เหลือดู util/toastCode.js */
export function toastPics(T) {
  const pics = [...T.CARDS, ...T.BONUS_CARDS].map((c) => [c.board, `textures/items/postcards/${c.id}`]);
  pics.push([PIC.album, "textures/items/album"], [PIC.globe, `textures/blocks/decor/${T.GRAND_REWARD.id}`], [PIC.more, "textures/items/blank_postcard"]);
  T.SETS.forEach((s, i) => pics.push([PIC_SET_BASE + i, `textures/blocks/decor/${s.reward}`]));
  const seen = new Set();
  for (const [n] of pics) {
    if (!Number.isInteger(n) || n < 0 || n > 99 || seen.has(n)) throw new Error(`เลขภาพของการ์ดแจ้งเตือนซ้ำหรืออยู่นอกช่วง 0–99: ${n}`);
    seen.add(n);
  }
  return pics;
}

/**
 * การ์ดแจ้งเตือน
 * - สคริปต์ส่ง title ที่ต่อท้ายด้วยรหัส § (util/toastCode.js) และส่งข้อความป้ายมุมเป็น subtitle
 * - factory ของ title ในเกมสร้าง control ใหม่ทุกครั้งที่มี title เราจึงให้มันสร้างแผงห่อ (wrap) ที่มี title เดิมของเกม + การ์ดของเรา
 *   แอนิเมชันของการ์ดจึงเริ่มใหม่ทุกใบ และถูกลบพร้อม title ตามเวลาที่สคริปต์กำหนด ($title_fade_in_time, $title_stay_time, $title_fade_out_time)
 * - title ที่ไม่มีรหัสของเรา (จากเกมหรือแอดออนอื่น) แสดงเหมือนเดิมทุกอย่าง ส่วน title ของเราซ่อน title กลางจอแล้วแสดงการ์ดแทน
 * - การซ่อน title เดิมอยู่ในแผงห่อเท่านั้น ถ้าแพ็กอื่นทับ HUD จนแผงห่อไม่ถูกใช้ ผู้เล่นจะเห็น title แบบเดิม (รหัส § มองไม่เห็น)
 */
export function toastUi(T) {
  const NS = "bpc_toast";
  const ref = (name) => `@${NS}.${name}`;
  const tex = (name) => `textures/bpc/toast/${name}`;
  const full = ["100%", "100%"];
  const showIf = (expr) => [global(TITLE), view(expr, "#visible")];
  const { frameW, frameH, frames, fps } = TOAST_ART;
  const [CARD_W, CARD_H] = [164, 36]; // กรอบ 2 พิกเซล + ฉาก 160×32 (ภาพ 80×16 ขยาย 2 เท่า)
  const OFF = CARD_W + 30; // ระยะที่การ์ดหลบออกนอกจอทางขวา

  /** ฉากของทุกธีมซ้อนกัน แสดงเฉพาะธีมที่ตรงกับรหัสใน title */
  const scene = (layerName, layer) => ({
    type: "panel",
    size: full,
    layer,
    controls: THEMES.map((theme) => ({
      [`${theme}_${layerName}`]: {
        type: "image",
        texture: tex(`${theme}_${layerName}`),
        size: full,
        uv_size: [frameW, frameH],
        uv: ref("flip"),
        disable_anim_fast_forward: true,
        bindings: showIf(has(themeCode(theme))),
      },
    })),
  });

  const toast = {
    namespace: NS,

    // ---------- แอนิเมชัน ----------
    flip: { anim_type: "flip_book", initial_uv: [0, 0], frame_count: frames, frame_step: frameW, fps, easing: "linear" },
    slide_in: { anim_type: "offset", easing: "out_cubic", duration: "$title_fade_in_time", from: [OFF, 0], to: [0, 0], next: ref("slide_stay") },
    slide_stay: { anim_type: "wait", duration: "$title_stay_time", next: ref("slide_out") },
    slide_out: { anim_type: "offset", easing: "in_cubic", duration: "$title_fade_out_time", from: [0, 0], to: [OFF, 0] },
    shine_wait: { anim_type: "wait", duration: "$title_fade_in_time", next: ref("shine_go") },
    shine_go: { anim_type: "offset", easing: "linear", duration: 0.7, from: [-30, 0], to: [CARD_W + 10, 0] },

    // ---------- แผงห่อที่ factory ของ title สร้าง ----------
    wrap: {
      type: "panel",
      size: full,
      // ค่าเผื่อไว้ ถ้าเกมไม่ได้ส่งเวลาของ title มาให้
      "$title_fade_in_time|default": 0.8,
      "$title_stay_time|default": 4,
      "$title_fade_out_time|default": 0.8,
      // อายุของแผงเท่ากับ title เดิม: แอนิเมชันชุดเดียวกับของเกมจะลบ control ชื่อ hud_title_text เมื่อจบ
      alpha: "@hud.anim_title_text_alpha_in",
      propagate_alpha: false,
      controls: [
        { vanilla: { type: "panel", size: full, bindings: showIf(lacks(MARK)), controls: [{ "vanilla_title@hud.hud_title_text": {} }] } },
        { "card_area@bpc_toast.card_area": {} },
      ],
    },

    // ---------- การ์ด ----------
    card_area: {
      type: "panel",
      size: [CARD_W, CARD_H],
      anchor_from: "top_right",
      anchor_to: "top_right",
      offset: [-8, 26],
      layer: 40,
      bindings: showIf(has(MARK)),
      controls: [{ "card@bpc_toast.card": {} }],
    },
    card: {
      type: "panel",
      size: full,
      offset: [OFF, 0],
      anims: [ref("slide_in")],
      controls: [
        {
          body: {
            type: "panel",
            size: [CARD_W - 4, CARD_H - 4],
            clips_children: true,
            controls: [
              { "scene_bg@bpc_toast.scene_bg": {} },
              { shade: { type: "image", texture: tex("shade"), size: full, layer: 2 } },
              { "pics@bpc_toast.pics": {} },
              {
                name: label({
                  text: "#text",
                  size: [CARD_W - 4 - 46, "default"],
                  anchor_from: "left_middle",
                  anchor_to: "left_middle",
                  offset: [40, 0],
                  text_alignment: "left",
                  layer: 4,
                  bindings: [global(TITLE, { binding_name_override: "#text" })],
                }),
              },
              { "scene_fg@bpc_toast.scene_fg": {} },
              {
                shine: {
                  type: "image",
                  texture: tex("shine"),
                  size: [24, CARD_H - 4],
                  anchor_from: "left_middle",
                  anchor_to: "left_middle",
                  offset: [-30, 0],
                  anims: [ref("shine_wait")],
                  layer: 6,
                },
              },
            ],
          },
        },
        { frame: { type: "image", texture: tex("frame"), size: full, layer: 7 } },
        { "banner@bpc_toast.banner": {} },
      ],
    },
    scene_bg: scene("bg", 1),
    scene_fg: scene("fg", 5),
    pics: {
      type: "panel",
      size: [32, 32],
      anchor_from: "left_middle",
      anchor_to: "left_middle",
      layer: 3,
      controls: toastPics(T).map(([n, texture]) => ({ [`pic_${n}`]: { type: "image", texture, size: full, bindings: showIf(has(picCode(n))) } })),
    },
    // ป้ายมุมขวาบนแบบป้าย NEW ของปุ่ม Marketplace: กว้างตามข้อความ (subtitle)
    // keep_ratio: false จำเป็น: ภาพพื้นเป็นแถบ 1×1 / 1×2 พิกเซล ค่าเริ่มต้นของเกมคงสัดส่วนภาพไว้
    // กล่องจะกว้างตามข้อความถูกต้อง แต่ภาพถูกวาดเป็นช่องเล็กกลางกล่อง (ดู docs/bugfix/2026-11-10-0.10.0-ป้ายการ์ดแจ้งเตือน)
    banner: {
      type: "image",
      texture: tex("banner_edge"),
      keep_ratio: false,
      size: ["100%c + 2px", 13],
      anchor_from: "top_right",
      anchor_to: "top_right",
      offset: [2, -5],
      layer: 8,
      controls: [
        {
          fill: {
            type: "image",
            texture: tex("banner_fill"),
            keep_ratio: false,
            size: ["100%c + 8px", 11],
            layer: 1,
            controls: [{ text: label({ text: "#text", color: [0.24, 0.14, 0.02], shadow: false, layer: 1, bindings: [global(SUB, { binding_name_override: "#text" })] }) }],
          },
        },
      ],
    },
  };

  const hud = {
    namespace: "hud",
    root_panel: {
      modifications: [
        {
          control_name: "hud_title_text_area",
          operation: "replace",
          value: [{ hud_title_text_area: { type: "panel", factory: { name: "hud_title_text_factory", control_ids: { hud_title_text: `hud_title_text${ref("wrap")}` } } } }],
        },
      ],
    },
  };

  return { "RP/ui/_ui_defs.json": { ui_defs: ["ui/bpc_toast.json"] }, "RP/ui/bpc_toast.json": toast, "RP/ui/hud_screen.json": hud };
}

export function labUi() {
  const fixed = (name, text) => ({ [name]: label({ text }) });
  const bound = (name, expr, extra = []) => ({ [name]: label({ text: "#text", color: [1, 1, 0.6], bindings: [global(TITLE), ...extra, view(expr, "#text")] }) });
  const shownIf = (name, text, expr) => ({ [name]: label({ text, color: [0.6, 1, 0.6], bindings: [global(TITLE), view(expr, "#visible")] }) });
  const box = (offset, rows) => ({
    type: "image",
    texture: "textures/ui/Black",
    alpha: 0.65,
    anchor_from: "top_left",
    anchor_to: "top_left",
    offset,
    size: ["100%c + 6px", "100%c + 6px"],
    layer: 60,
    controls: [{ rows: { type: "stack_panel", orientation: "vertical", size: ["100%cm", "100%c"], anchor_from: "top_left", anchor_to: "top_left", offset: [3, 3], controls: rows } }],
  });
  const lab = {
    namespace: "bpc_lab",
    flip: { anim_type: "flip_book", initial_uv: [0, 0], frame_count: 9, frame_step: 18, fps: 6, reversible: true, easing: "linear" },
    static_panel: box([4, 30], [
      fixed("s0", "S0 static panel loaded"),
      bound("s1", `('S1 [' + ${TITLE} + ']')`),
      shownIf("s2", "S2 has marker", has(MARK)),
      shownIf("s3", "S3 no marker", `(not ${has(MARK)})`),
    ]),
    factory_item: box([4, 84], [
      fixed("f0", "F0 factory item created"),
      bound("f1", `('F1 [' + ${TITLE} + ']')`),
      { f1b: label({ text: "#text", color: [1, 1, 0.6], bindings: [global(TITLE, { binding_condition: "once" }), view(`('F1b once [' + ${TITLE} + ']')`, "#text")] }) },
      shownIf("f2", "F2 has marker", has(MARK)),
      shownIf("f3", "F3 no marker", `(not ${has(MARK)})`),
      bound("f4", `('F4 %.3s=[' + ('%.3s' * ${TITLE}) + ']')`),
      bound("f5", `('F5 -a=[' + (${TITLE} - 'a') + ']')`),
      shownIf("f6", "F6 card code 06", has("§n§0§6")),
      { f7: label({ text: "#text", color: [1, 1, 0.6], bindings: [global(SUB), view(`('F7 sub=[' + ${SUB} + ']')`, "#text")] }) },
      fixed("f8", "F8 ไทย: สวัสดี ทุ่งหญ้าบนเขา ป่าไผ่ ที่นี่ น้ำ"),
      {
        f9: {
          type: "stack_panel",
          orientation: "horizontal",
          size: ["100%c", 34],
          controls: [
            { flip: { type: "image", texture: "textures/ui/auto_save", size: [18, 30], uv_size: [18, 30], uv: "@bpc_lab.flip", disable_anim_fast_forward: true } },
            { gap1: { type: "panel", size: [6, 32] } },
            { fixed_tex: { type: "image", texture: "textures/blocks/pin_board/cherry_grove", size: [32, 32] } },
            { gap2: { type: "panel", size: [6, 32] } },
            { dyn_tex: { type: "image", texture: "#texture", size: [32, 32], bindings: [global(TITLE), view(`('textures/blocks/pin_board/' + (${TITLE} - '${MARK}'))`, "#texture")] } },
          ],
        },
      },
    ]),
  };
  const hud = {
    namespace: "hud",
    root_panel: {
      modifications: [
        {
          array_name: "controls",
          operation: "insert_front",
          value: [
            { "bpc_lab_static@bpc_lab.static_panel": {} },
            { bpc_lab_area: { type: "panel", factory: { name: "hud_title_text_factory", control_ids: { hud_title_text: "bpc_lab_item@bpc_lab.factory_item" } } } },
          ],
        },
      ],
    },
    // ซ่อน title กลางจอของเกมเมื่อข้อความมีรหัสของเรา
    hud_title_text: { bindings: [global(TITLE), view(`(not ${has(MARK)})`, "#visible")] },
  };
  return { "RP/ui/_ui_defs.json": { ui_defs: ["ui/bpc_lab.json"] }, "RP/ui/bpc_lab.json": lab, "RP/ui/hud_screen.json": hud };
}
