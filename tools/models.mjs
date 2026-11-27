// โมเดลบล็อก 3 มิติจากสเปกในโค้ด (art/models.mjs) → ไฟล์ของเกม + ไฟล์ Blockbench
//
// แต่ละโมเดลได้ 3 อย่างจากสเปกเดียว ผลลัพธ์จึงตรงกันเสมอ:
//   geo     geometry ของ Bedrock (minecraft:geometry) สำหรับ RP/models/blocks
//   png     เท็กซ์เจอร์ 1 แผ่นต่อโมเดล ทุกหน้าของทุกกล่องมีพื้นที่ของตัวเอง
//   bbmodel โปรเจกต์ Blockbench (ฝังเท็กซ์เจอร์) ไว้เปิดดูและใช้เป็นแบบ
//
// พิกัดของสเปกเป็นพิกัดที่เห็นใน Blockbench (รูปแบบ Bedrock Block): บล็อกกิน x −8..8, y 0..16, z −8..8
// ทิศเหนือ = −z ตะวันออก = +x ไฟล์ geometry ของเกมกลับแกน x (สูตรเดียวกับตัวส่งออกของ Blockbench)
//
// การวาดหน้า: painter(cv, w, h) วาดลง Canvas ย่อยขนาดเท่าหน้า (1 พิกเซล = 1 หน่วย × density)
//   หน้าข้าง: มองจากด้านนอก บนของภาพ = +y
//   หน้าบน (up): มองจากด้านบน บนของภาพ = ทิศเหนือ (−z) ขวา = ตะวันออก (+x)
//   หน้าล่าง (down): มองจากด้านล่าง บนของภาพ = ทิศใต้ (+z) ขวา = ตะวันออก (+x)
import { PNG } from "pngjs";

export const FACES = ["north", "east", "south", "west", "up", "down"];

// ---------- สี ----------
export function rgba(c) {
  if (Array.isArray(c)) return c;
  if (!c || c === "_") return [0, 0, 0, 0];
  const h = c.slice(1);
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length >= 8 ? n(6) : 255];
}
export const hexOf = ([r, g, b]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
/** ผสมสี a ไปหา b ตามสัดส่วน t */
export const mix = (a, b, t) => {
  const [x, y] = [rgba(a), rgba(b)];
  return hexOf([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t));
};
export const lighten = (c, t) => mix(c, "#ffffff", t);
export const darken = (c, t) => mix(c, "#000000", t);

// ---------- ตัวสุ่มที่ได้ผลเดิมทุกครั้ง ----------
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function rng(seed) {
  let a = typeof seed === "number" ? seed : hashStr(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- ผืนวาด ----------
export class Canvas {
  constructor(w, h, data = new Uint8Array(w * h * 4), ox = 0, oy = 0, stride = w) {
    Object.assign(this, { w, h, data, ox, oy, stride });
  }
  /** ผืนย่อยที่วาดลงผืนเดิม (ใช้เป็นพื้นที่ของหน้าเดียว) */
  sub(x, y, w, h) {
    return new Canvas(w, h, this.data, this.ox + x, this.oy + y, this.stride);
  }
  px(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || c === undefined || c === null) return this;
    const [r, g, b, a] = rgba(c);
    this.data.set([r, g, b, a], ((this.oy + y) * this.stride + this.ox + x) * 4);
    return this;
  }
  get(x, y) {
    const i = ((this.oy + y) * this.stride + this.ox + x) * 4;
    return [...this.data.slice(i, i + 4)];
  }
  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c);
    return this;
  }
  fill(c) {
    return this.rect(0, 0, this.w, this.h, c);
  }
  hline(x, y, n, c) {
    return this.rect(x, y, n, 1, c);
  }
  vline(x, y, n, c) {
    return this.rect(x, y, 1, n, c);
  }
  box(x, y, w, h, c) {
    return this.hline(x, y, w, c).hline(x, y + h - 1, w, c).vline(x, y, h, c).vline(x + w - 1, y, h, c);
  }
  /** ภาพจากตัวอักษร: แต่ละแถวเป็นสตริง ตัวอักษรชี้สีใน pal, "." = ข้าม */
  grid(x, y, rows, pal) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== "." && ch !== " " && this.px(x + i, y + j, pal[ch])));
    return this;
  }
}

// ---------- ตัววาดสำเร็จรูป ----------
/** พื้นผิวแบบบล็อกของเกม: สีพื้น + จุดเข้มและอ่อนกระจาย (เป็นกลุ่ม 1–2 พิกเซล) */
export function grain(base, { dark = darken(base, 0.14), light = lighten(base, 0.12), amount = 0.22, seed = "g" } = {}) {
  return (cv, w, h, key) => {
    const r = rng(`${seed}|${key}|${w}x${h}`);
    cv.fill(base);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = r();
        if (v < amount / 2) cv.px(x, y, dark);
        else if (v < amount) cv.px(x, y, light);
      }
    }
  };
}
/** สีเดียวทั้งหน้า */
export const solid = (c) => (cv) => void cv.fill(c);
/** ซ้อนตัววาดหลายตัวตามลำดับ */
export const layers = (...ps) => (cv, w, h, key) => ps.forEach((p) => p && p(cv, w, h, key));
/** ขอบสว่างด้านบน/ซ้าย และขอบเข้มด้านล่าง/ขวา ช่วยให้กล่องเล็กอ่านเป็นก้อน */
export const bevel = (hi, lo) => (cv, w, h) => {
  if (hi) cv.hline(0, 0, w, hi).vline(0, 0, h, hi);
  if (lo) cv.hline(0, h - 1, w, lo).vline(w - 1, 0, h, lo);
};
/** ภาพจากตัวอักษร วางที่ (x, y) ของหน้า ค่าลบนับจากขอบขวา/ล่าง */
export const art = (rows, pal, x = 0, y = 0) => (cv, w, h) => void cv.grid(x < 0 ? w + x : x, y < 0 ? h + y : y, rows, pal);
/** แถบแนวตั้งสลับสี กว้างแถบละ n พิกเซล */
export const vstripes = (colors, n = 2, offset = 0) => (cv, w, h) => {
  for (let x = 0; x < w; x++) cv.vline(x, 0, h, colors[Math.floor((x + offset) / n) % colors.length]);
};
/** แถบแนวนอนสลับสี สูงแถบละ n พิกเซล */
export const hstripes = (colors, n = 2, offset = 0) => (cv, w, h) => {
  for (let y = 0; y < h; y++) cv.hline(0, y, w, colors[Math.floor((y + offset) / n) % colors.length]);
};

/**
 * แผ่นภาพที่พาดผ่านหลายกล่อง: วาดภาพใหญ่ครั้งเดียวบนระนาบของหน้าใดหน้าหนึ่ง แล้วหน้าของกล่องแต่ละใบตัดส่วนที่ตรงกับตำแหน่งของตัวเองไปใช้
 * ใช้กับรูปทรงที่ต่อจากหลายกล่อง (วงกลมแบบขั้นบันได ลูกโลก) เพื่อให้ลายต่อเนื่องกันโดยไม่มีหน้าซ้อนกัน
 * @param {"north"|"south"|"east"|"west"|"up"|"down"} face หน้าที่แผ่นนี้ใช้ได้
 * @param {[number, number]} h ช่วงแนวนอนในพิกัดโมเดล: x สำหรับ north/south/up/down, z สำหรับ east/west
 * @param {[number, number]} v ช่วงแนวตั้ง: y สำหรับหน้าข้าง, z สำหรับ up/down
 * @param {Function} painter วาดทั้งแผ่น (cv, w, h)
 */
export function sheet(face, h, v, painter) {
  return { sheet: true, face, h, v, painter, canvas: null };
}
function sheetCanvas(sh, density, key) {
  if (!sh.canvas) {
    const w = Math.round((sh.h[1] - sh.h[0]) * density);
    const hh = Math.round((sh.v[1] - sh.v[0]) * density);
    sh.canvas = new Canvas(w, hh);
    sh.painter(sh.canvas, w, hh, key);
  }
  return sh.canvas;
}
/** มุมซ้ายบนของหน้า (ของกล่อง from/size) บนแผ่น หน่วยเป็นพิกัดโมเดล */
function sheetOffset(sh, face, from, size) {
  const [x, y, z] = from;
  const [sx, sy, sz] = size;
  const top = sh.v[1] - (y + sy); // หน้าข้าง: บนของภาพ = +y
  if (face === "north") return [sh.h[1] - (x + sx), top]; // ซ้าย = +x
  if (face === "south") return [x - sh.h[0], top]; // ซ้าย = −x
  if (face === "east") return [sh.h[1] - (z + sz), top]; // ซ้าย = +z
  if (face === "west") return [z - sh.h[0], top]; // ซ้าย = −z
  if (face === "up") return [x - sh.h[0], z - sh.v[0]]; // บน = −z
  return [x - sh.h[0], sh.v[1] - (z + sz)]; // down: บน = +z
}

// ---------- โมเดล ----------
const DIMS = {
  north: (s) => [s[0], s[1]],
  south: (s) => [s[0], s[1]],
  east: (s) => [s[2], s[1]],
  west: (s) => [s[2], s[1]],
  up: (s) => [s[0], s[2]],
  down: (s) => [s[0], s[2]],
};
const uuid = (seed) => {
  const r = rng(seed);
  const hex = (n) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
};

export class Model {
  /**
   * @param {string} id ชื่อบล็อก (ไม่มี namespace)
   * @param {{tex?: [number, number], density?: number, name?: string}} [opts] tex = ขนาดเท็กซ์เจอร์, density = พิกเซลต่อหน่วย
   */
  constructor(id, { tex = [32, 32], density = 1, name = id, extra = {} } = {}) {
    // extra = { ชื่อ material instance: Buffer ของ PNG } ใช้แสดงผลใน Blockbench เท่านั้น (ในเกมกำหนดที่ material_instances ของบล็อก)
    Object.assign(this, { id, name, tex, density, extra, cubes: [], bones: ["root"] });
  }

  /**
   * เพิ่มกล่อง
   * @param {string} name
   * @param {[number, number, number]} from มุมต่ำสุด (พิกัด Blockbench)
   * @param {[number, number, number]} size
   * @param {Function | Record<string, Function | false>} paint ตัววาดเดียวใช้ทุกหน้า หรือระบุรายหน้า: north/east/south/west/up/down, side (4 หน้าข้าง), all, false = ไม่มีหน้านั้น
   * @param {{bone?: string, rot?: [number, number, number], pivot?: [number, number, number], hide?: string, uv?: Record<string, [number, number, number, number]>, mi?: Record<string, string> | string, share?: boolean}} [opts]
   *   hide = ชื่อหน้าที่ไม่ต้องมี คั่นด้วยช่องว่าง, uv = ระบุพื้นที่บนเท็กซ์เจอร์เอง [u, v, w, h] (ไม่จองพื้นที่และไม่วาด), mi = ชื่อ material instance ของหน้า
   *   share = หน้าข้าง 4 หน้าใช้พื้นที่เดียวกัน (ประหยัดเท็กซ์เจอร์ ใช้กับกล่องที่ทุกด้านเหมือนกัน)
   */
  cube(name, from, size, paint, opts = {}) {
    const bone = opts.bone ?? "root";
    if (!this.bones.includes(bone)) this.bones.push(bone);
    this.cubes.push({ name, from, size, paint, opts: { ...opts, bone } });
    return this;
  }

  #painterFor(cube, face) {
    const p = cube.paint;
    if (typeof p === "function") return p;
    if (!p) return null;
    if (p[face] !== undefined) return p[face];
    if (face !== "up" && face !== "down" && p.side !== undefined) return p.side;
    return p.all ?? null;
  }

  /** จัดพื้นที่ของทุกหน้าบนเท็กซ์เจอร์ แล้ววาด คืน { canvas, faces } โดย faces[i][face] = [u, v, w, h] */
  layout() {
    const [W, H] = this.tex;
    const canvas = new Canvas(W, H);
    const jobs = [];
    const faces = this.cubes.map((cube, i) => {
      const out = {};
      const hidden = new Set((cube.opts.hide ?? "").split(/\s+/).filter(Boolean));
      let shared = null;
      for (const face of FACES) {
        if (hidden.has(face)) continue;
        const fixed = cube.opts.uv?.[face];
        if (fixed) {
          out[face] = fixed;
          continue;
        }
        const painter = this.#painterFor(cube, face);
        if (!painter) continue;
        const [du, dv] = DIMS[face](cube.size);
        const w = Math.max(1, Math.ceil(du * this.density - 1e-6));
        const h = Math.max(1, Math.ceil(dv * this.density - 1e-6));
        const side = face !== "up" && face !== "down";
        if (cube.opts.share && side && shared && shared.w === w && shared.h === h) {
          out[face] = shared; // ใช้พื้นที่เดียวกับหน้าแรก (แทนด้วยพื้นที่จริงหลังจัดวาง)
          continue;
        }
        const job = { i, face, w, h, painter, key: `${this.id}|${cube.name}|${cube.opts.share && side ? "side" : face}`, rect: null };
        jobs.push(job);
        out[face] = job; // แทนด้วยพื้นที่จริงหลังจัดวาง
        if (cube.opts.share && side && !shared) shared = job;
      }
      return out;
    });
    // จัดวางแบบชั้น: หน้าสูงก่อน เว้น 0 พิกเซล (แต่ละหน้าวาดเต็มพื้นที่ของตัวเอง)
    const order = [...jobs].sort((a, b) => b.h - a.h || b.w - a.w);
    let x = 0;
    let y = 0;
    let shelf = 0;
    for (const job of order) {
      if (x + job.w > W) {
        x = 0;
        y += shelf;
        shelf = 0;
      }
      if (job.w > W || y + job.h > H) throw new Error(`${this.id}: เท็กซ์เจอร์ ${W}×${H} ไม่พอ (วางหน้า ${job.key} ${job.w}×${job.h} ไม่ได้) เพิ่ม tex หรือใช้ share`);
      job.rect = [x, y, job.w, job.h];
      x += job.w;
      shelf = Math.max(shelf, job.h);
    }
    for (const job of jobs) {
      const target = canvas.sub(job.rect[0], job.rect[1], job.w, job.h);
      if (!job.painter.sheet) {
        job.painter(target, job.w, job.h, job.key);
        continue;
      }
      const sh = job.painter;
      if (sh.face !== job.face) throw new Error(`${job.key}: แผ่นภาพนี้ทำไว้สำหรับหน้า ${sh.face}`);
      const src = sheetCanvas(sh, this.density, `${this.id}|sheet|${sh.face}`);
      const cube = this.cubes[job.i];
      const [ou, ov] = sheetOffset(sh, job.face, cube.from, cube.size).map((n) => Math.round(n * this.density));
      for (let yy = 0; yy < job.h; yy++) {
        for (let xx = 0; xx < job.w; xx++) {
          const [sx2, sy2] = [ou + xx, ov + yy];
          if (sx2 >= 0 && sy2 >= 0 && sx2 < src.w && sy2 < src.h) target.px(xx, yy, src.get(sx2, sy2));
        }
      }
    }
    for (const out of faces) for (const f of Object.keys(out)) if (!Array.isArray(out[f])) out[f] = out[f].rect;
    return { canvas, faces, used: y + shelf };
  }

  build() {
    const { canvas, faces, used } = this.layout();
    const [W, H] = this.tex;
    const png = new PNG({ width: W, height: H });
    png.data.set(canvas.data);
    const pngBuf = PNG.sync.write(png);
    const miOf = (cube, face) => (typeof cube.opts.mi === "string" ? cube.opts.mi : cube.opts.mi?.[face]);

    // ----- geometry ของเกม (สูตรเดียวกับตัวส่งออก Bedrock ของ Blockbench: กลับแกน x, หน้าบน/ล่างกลับ uv) -----
    const round = (v) => Math.round(v * 10000) / 10000 || 0; // || 0 กัน -0
    const bones = this.bones.map((bone) => ({
      name: bone,
      pivot: [0, 0, 0],
      cubes: this.cubes
        .map((cube, i) => ({ cube, i }))
        .filter(({ cube }) => cube.opts.bone === bone)
        .map(({ cube, i }) => {
          const [x, y, z] = cube.from;
          const [sx, sy, sz] = cube.size;
          const uv = {};
          for (const [face, [u, v, w, h]] of Object.entries(faces[i])) {
            const flip = face === "up" || face === "down";
            uv[face] = { uv: flip ? [u + w, v + h] : [u, v], uv_size: flip ? [-w, -h] : [w, h] };
            const mi = miOf(cube, face);
            if (mi) uv[face].material_instance = mi;
          }
          const out = { origin: [round(-(x + sx)), round(y), round(z)], size: [round(sx), round(sy), round(sz)] };
          if (cube.opts.rot) {
            const [px, py, pz] = cube.opts.pivot ?? [x + sx / 2, y + sy / 2, z + sz / 2];
            out.pivot = [round(-px), round(py), round(pz)];
            out.rotation = [round(-cube.opts.rot[0]), round(-cube.opts.rot[1]), round(cube.opts.rot[2])];
          }
          out.uv = uv;
          return out;
        }),
    }));
    const geo = {
      format_version: "1.21.0",
      "minecraft:geometry": [
        {
          description: {
            identifier: `geometry.bpc.${this.id}`,
            texture_width: W,
            texture_height: H,
            visible_bounds_width: 2,
            visible_bounds_height: 2.5,
            visible_bounds_offset: [0, 0.75, 0],
          },
          bones: bones.filter((b) => b.cubes.length),
        },
      ],
    };

    // ----- โปรเจกต์ Blockbench -----
    const extraNames = Object.keys(this.extra);
    const texEntry = (name, buf, n) => ({
      path: "",
      name: `${name}.png`,
      folder: "",
      namespace: "",
      id: String(n),
      width: W,
      height: H,
      uv_width: W,
      uv_height: H,
      particle: false,
      use_as_default: false,
      layers_enabled: false,
      sync_to_project: "",
      render_mode: "default",
      render_sides: "auto",
      frame_time: 1,
      frame_order_type: "loop",
      frame_order: "",
      frame_interpolate: false,
      visible: true,
      internal: true,
      saved: true,
      uuid: uuid(`${this.id}|texture|${name}`),
      source: `data:image/png;base64,${buf.toString("base64")}`,
    });
    const elements = this.cubes.map((cube, i) => {
      const f = {};
      for (const face of FACES) {
        const r = faces[i][face];
        const mi = miOf(cube, face);
        const texIndex = mi && extraNames.includes(mi) ? 1 + extraNames.indexOf(mi) : 0;
        f[face] = r ? { uv: [r[0], r[1], r[0] + r[2], r[1] + r[3]], texture: texIndex, ...(mi ? { material_name: mi } : {}) } : { uv: [0, 0, 0, 0], texture: null };
      }
      const [x, y, z] = cube.from;
      const [sx, sy, sz] = cube.size;
      return {
        name: cube.name,
        box_uv: false,
        rescale: false,
        locked: false,
        light_emission: 0,
        render_order: "default",
        allow_mirror_modeling: true,
        from: [x, y, z],
        to: [x + sx, y + sy, z + sz],
        autouv: 0,
        color: i % 8,
        ...(cube.opts.rot ? { rotation: cube.opts.rot } : {}),
        origin: cube.opts.pivot ?? (cube.opts.rot ? [x + sx / 2, y + sy / 2, z + sz / 2] : [0, 0, 0]),
        faces: f,
        type: "cube",
        uuid: uuid(`${this.id}|cube|${i}|${cube.name}`),
      };
    });
    const bbmodel = {
      meta: { format_version: "4.10", model_format: "bedrock_block", box_uv: false },
      name: this.name,
      model_identifier: `bpc.${this.id}`,
      visible_box: [2, 2.5, 0.75],
      variable_placeholders: "",
      variable_placeholder_buttons: [],
      timeline_setups: [],
      unhandled_root_fields: {},
      resolution: { width: W, height: H },
      elements,
      outliner: this.bones
        .map((bone) => ({
          name: bone,
          origin: [0, 0, 0],
          color: 0,
          uuid: uuid(`${this.id}|bone|${bone}`),
          export: true,
          mirror_uv: false,
          isOpen: true,
          locked: false,
          visibility: true,
          autouv: 0,
          children: elements.filter((_, i) => this.cubes[i].opts.bone === bone).map((e) => e.uuid),
        }))
        .filter((g) => g.children.length),
      textures: [texEntry(this.id, pngBuf, 0), ...extraNames.map((n, k) => texEntry(n, this.extra[n], k + 1))],
    };
    return { id: this.id, geo, png: pngBuf, bbmodel, used, bounds: this.bounds() };
  }

  /** กล่องล้อมรอบทั้งโมเดล (ไม่คิดการหมุน) ใช้ตั้ง selection/collision box */
  bounds() {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (const { from, size } of this.cubes) {
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], from[k]);
        hi[k] = Math.max(hi[k], from[k] + size[k]);
      }
    }
    return { origin: lo, size: hi.map((v, k) => v - lo[k]) };
  }
}
