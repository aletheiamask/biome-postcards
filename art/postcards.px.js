// ภาพทั้งหมดของ Biome Postcards วาดด้วย pxl (pixel art เป็นโค้ด)
// สร้างและคัดลอกเข้า RP ด้วย: node tools/art.mjs   ดูแผ่นรวม: node tools/art.mjs --preview
// ฉากของการ์ดแต่ละใบเขียนครั้งเดียว ใช้ทั้งภาพบนบอร์ด (22×18) และไอคอนไอเท็ม (12×9)
include("_data.px.js") // BPC.cards = [{ id, rarity }], BPC.trinkets จาก content/cards.js

const PAPER = "#f4efe2" // ขอบกระดาษของโปสการ์ด tools/build.mjs เปลี่ยนสีนี้เป็นทองในรุ่นฟอยล์ ห้ามใช้สีนี้ที่อื่น
const INK = "#3b2a1a"
const SKY = "#8fc7ff", SKY2 = "#c3e3ff", GRASS = "#6fb548", GRASS_L = "#8fd05a", GRASS_D = "#4f9438"
const SAND = "#e8d591", SAND_L = "#f4e6ae", SAND_D = "#cfb56c", SNOW = "#f4f9fd", SNOW_D = "#cfe0ee"
const STONE = "#8a8f96", STONE_D = "#6c7178", WOOD = "#6b4a2b", WATER = "#3f7fd6", WATER_L = "#8fbff2"

pal({ c: "#c79a63", d: "#b5884f", w: "#7a4a2a", v: "#6b4025" })

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// ชุดเครื่องมือวาดฉาก ผูกกับผืนผ้าใบ ตำแหน่งเป็นสัดส่วน 0..1 จึงใช้ได้ทั้งสองขนาด
function kit(c) {
  const W = c.w, H = c.h, big = W > 14
  const X = (f) => Math.round(f * (W - 1)), Y = (f) => Math.round(f * (H - 1))
  const k = { W, H, big, X, Y }
  k.R = {
    oak: big ? [4, 6, 8, 8, 6] : [1, 3, 3],
    wide: big ? [6, 10, 12, 12, 10] : [3, 5, 5],
    round: big ? [4, 6, 6, 4] : [1, 3],
    flat: big ? [8, 10] : [3, 5],
    spruce: big ? [2, 4, 6, 4, 6, 8, 6, 8, 10] : [1, 3, 3, 5],
    spruceS: big ? [2, 4, 6, 4, 6, 8] : [1, 3, 5],
    cap: big ? [6, 10, 10] : [3, 5],
    jungle: big ? [6, 8, 10, 8] : [3, 5, 3],
  }
  k.sky = (top, low) => {
    c.rect(0, 0, W, H, top)
    if (low) c.rect(0, Math.round(H * 0.4), W, H, low)
  }
  k.ground = (fy, col, edge) => {
    const y = Y(fy)
    c.rect(0, y, W, H - y, col)
    if (edge) c.hline(0, y, W, edge)
    return y
  }
  k.sun = (fx, fy, col = "#fff2a8") => (big ? c.circ(X(fx), Y(fy), 2, col) : c.rect(X(fx), Y(fy), 2, 2, col))
  k.hills = (fy, amp, col, phase = 0, freq = 1, edge) => {
    for (let x = 0; x < W; x++) {
      const y = Y(fy) - Math.round(amp * (H - 1) * (0.5 + 0.5 * Math.sin((x / W) * 6.283 * freq + phase)))
      c.rect(x, y, 1, H - y, col)
      if (edge) c.px(x, y, edge)
    }
  }
  // ภูเขา/เนินสามเหลี่ยม by = แถวฐาน, cap = สียอด, shade = สีด้านขวา
  k.peak = (fx, by, wf, hf, col, cap, shade) => {
    const cx = X(fx), hh = Math.max(2, Math.round(hf * H)), hw = Math.max(1, Math.round((wf * W) / 2))
    const capH = Math.max(1, Math.round(hh * 0.3))
    for (let i = 0; i <= hh; i++) {
      const half = Math.round((hw * i) / hh), y = by - hh + i, top = cap && i <= capH
      c.rect(cx - half, y, half * 2 + 1, 1, top ? cap : col)
      if (shade && !top && half > 0) c.rect(cx + 1, y, half, 1, shade)
    }
  }
  k.rows = (cx2, top, widths, col) => widths.forEach((w, i) => c.rect((cx2 - w) / 2, top + i, w, 1, col))
  // ต้นไม้: ลำต้น + พุ่มเป็นแถวตามความกว้าง (ความกว้างต้องคู่/คี่ตรงกับลำต้น)
  k.tree = (fx, gy, rows, leaf, dark, o = {}) => {
    const tw = o.tw ?? (big ? 2 : 1), th = o.th ?? (big ? 3 : 2), x = X(fx) - (tw >> 1), cx2 = 2 * x + tw
    if (th > 0) c.rect(x, gy - th, tw, th, o.trunk ?? WOOD)
    const top = gy - th - rows.length + (o.lap ?? 1)
    k.rows(cx2, top, rows, leaf)
    if (dark) k.rows(cx2, top + rows.length - 1, [rows[rows.length - 1]], dark)
    return { x, cx: cx2 >> 1, cx2, top, bottom: top + rows.length, left: (cx2 - Math.max(...rows)) / 2, right: (cx2 + Math.max(...rows)) / 2 - 1 }
  }
  k.cactus = (fx, gy, h) => {
    const x = X(fx), hh = h ?? (big ? 6 : 3), g = "#4f9a3a", d = "#3a7a2c"
    c.rect(x, gy - hh, big ? 2 : 1, hh, g)
    if (big) {
      c.vline(x + 1, gy - hh, hh, d)
      c.hline(x - 2, gy - 3, 2, g)
      c.vline(x - 2, gy - 5, 2, g)
      c.hline(x + 2, gy - 2, 2, d)
      c.vline(x + 3, gy - 4, 2, d)
    } else c.px(x - 1, gy - 2, g)
  }
  k.spike = (fx, gy, hf, col, hi, sh) => {
    const x = X(fx), hh = Math.max(3, Math.round(hf * H)), bw = big ? 2 : 1
    for (let i = 0; i < hh; i++) {
      const half = Math.round((bw * i) / hh), y = gy - hh + i
      c.rect(x - half, y, half * 2 + 1, 1, col)
      if (hi && half > 0) c.px(x - half, y, hi)
      if (sh && half > 0) c.px(x + half, y, sh)
    }
  }
  // หินย้อย (จาก y0 ลง) หรือหินงอก (up = true จาก y0 ขึ้น)
  k.drip = (fx, y0, len, col, hi, up) => {
    const x = X(fx), n = big ? len : Math.max(1, Math.ceil(len / 2))
    for (let i = 0; i < n; i++) {
      const w = big && i < Math.ceil(n / 3) ? 3 : 1, y = up ? y0 - i : y0 + i
      c.rect(x - (w >> 1), y, w, 1, col)
      if (hi) c.px(x - (w >> 1), y, hi)
    }
  }
  k.dots = (y0, y1, cols, n, seed, x0 = 0, x1 = W) => {
    const r = rng(seed)
    for (let i = 0; i < n; i++) c.px(x0 + Math.floor(r() * (x1 - x0)), y0 + Math.floor(r() * Math.max(1, y1 - y0)), cols[Math.floor(r() * cols.length)])
  }
  // ดอกไม้บนพื้น: ดอกโผล่เหนือขอบพื้น + แถวหน้าบนพื้น
  k.flowers = (gy, cols, seed, step = big ? 2 : 2) => {
    const r = rng(seed)
    for (let x = 1; x < W - 1; x += step) {
      const col = cols[Math.floor(r() * cols.length)]
      if (r() < 0.75) {
        c.px(x, gy - 1, big ? "#3f8a2f" : col)
        if (big) c.px(x, gy - 2, col)
      }
      if (r() < 0.6) c.px(x + (big ? 1 : 0), gy + (big ? 3 : 2), cols[Math.floor(r() * cols.length)])
    }
  }
  k.waves = (y0, y1, col, seed) => {
    const r = rng(seed)
    for (let y = y0; y < y1; y += big ? 2 : 1) c.hline(Math.floor(r() * (W - 3)), y, big ? 3 : 2, col)
  }
  k.water = (fy, col, hi, seed = 7) => {
    const y = Y(fy)
    c.rect(0, y, W, H - y, col)
    k.waves(y + 1, H, hi, seed)
    return y
  }
  k.ceiling = (col, seed = 3, depth) => {
    const r = rng(seed), d = depth ?? (big ? 2 : 1)
    c.rect(0, 0, W, d, col)
    for (let x = 0; x < W; x++) if (r() < 0.45) c.px(x, d, col)
    return d
  }
  k.burst = (fx, fy, r, col) => {
    const x = X(fx), y = Y(fy), q = Math.max(1, Math.round(r * 0.7))
    c.px(x, y, "#ffffff")
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      c.px(x + dx * r, y + dy * r, col)
      if (big) c.px(x + dx * (r - 1), y + dy * (r - 1), col)
    }
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) c.px(x + dx * q, y + dy * q, col)
  }
  k.sunflower = (fx, by) => {
    const x = X(fx)
    if (big) {
      c.vline(x, by - 4, 4, "#3f8a2f")
      c.px(x + 1, by - 2, "#3f8a2f")
      c.rect(x - 1, by - 7, 3, 3, "#ffd23d")
      c.px(x, by - 6, "#8a5a2a")
    } else {
      c.px(x, by - 1, "#3f8a2f")
      c.px(x, by - 2, "#ffd23d")
    }
  }
  k.mesa = (f0, f1, fyTop, gy, bands, shift = 0) => {
    const x0 = X(f0), x1 = X(f1), top = Y(fyTop), t = big ? 2 : 1
    for (let y = top; y < gy; y++) {
      const inset = y === top ? 1 : 0
      c.rect(x0 + inset, y, x1 - x0 + 1 - inset * 2, 1, bands[(Math.floor((y - top) / t) + shift) % bands.length])
    }
  }
  return k
}

const FLOWERS = ["#ff5f6f", "#ffd23d", "#ff9fd6", "#6fa8ff", "#ffffff"]
const MESA = ["#b5522c", "#e8b25a", "#c46a32", "#f0d9b5", "#a0452c", "#d98a4a"]

// ฉากของการ์ดแต่ละใบ มุมขวาบน (5×5 บนภาพใหญ่, 3×3 บนภาพเล็ก) ถูกแสตมป์ความหายากบัง จึงไม่วางของสำคัญตรงนั้น
const SCENES = {
  plains(k, c) {
    k.sky(SKY, SKY2)
    k.sun(0.14, 0.2)
    k.hills(0.62, 0.08, GRASS_L, 2.2, 1)
    const gy = k.ground(0.66, GRASS, GRASS_L)
    c.rect(0, gy + (k.big ? 4 : 2), k.W, k.H, GRASS_D)
    for (const fx of [0.3, 0.55, 0.82]) k.sunflower(fx, gy + (k.big ? 3 : 2))
  },
  forest(k, c) {
    k.sky(SKY, SKY2)
    const gy = k.ground(0.72, GRASS, GRASS_L)
    k.tree(0.2, gy, k.R.oak, "#4f9a35", "#3a7a2a")
    const b = k.tree(0.52, gy + 1, k.R.oak, "#8fd05a", "#6fb548", { trunk: "#ece8dc", th: k.big ? 5 : 3 })
    if (k.big) {
      c.px(b.x, gy - 1, "#4a4a4a")
      c.px(b.x + 1, gy - 3, "#4a4a4a")
    }
    k.tree(0.82, gy, k.R.oak, "#3f8a2f", "#2f6b22")
  },
  flower_forest(k, c) {
    k.sky(SKY, SKY2)
    const gy = k.ground(0.64, "#7cc552", "#9ade6a")
    k.tree(0.2, gy, k.R.oak, "#4f9a35", "#3a7a2a")
    k.flowers(gy, FLOWERS, 5)
    k.dots(gy + 1, k.H, FLOWERS, k.big ? 10 : 4, 9)
  },
  dark_forest(k, c) {
    k.sky("#6f8fa8", "#93a9b8")
    const gy = k.ground(0.76, "#2f5a24", "#3f6f2f")
    for (const fx of [0.18, 0.5, 0.82]) k.tree(fx, gy, k.R.wide, "#2f6b22", "#1f4a18", { trunk: "#3a2718" })
    const x = k.X(0.66)
    c.hline(x - 1, gy + 1, 3, "#d6453c")
    c.px(x, gy + 2, "#ece4d6")
    if (k.big) c.px(x, gy + 1, "#ffffff")
  },
  pale_garden(k, c) {
    k.sky("#b9bfc2", "#d3d7d8")
    const gy = k.ground(0.72, "#8d948c", "#a6ada4")
    for (const fx of [0.26, 0.7]) {
      const t = k.tree(fx, gy, k.R.oak, "#e4e7df", "#bfc5bb", { trunk: "#f2f3ee" })
      for (let x = t.left + 1, i = 0; x <= t.right; x += k.big ? 3 : 2, i++) c.vline(x, t.bottom, 1 + (i % 2) + (k.big ? 1 : 0), "#aab1a7")
    }
    c.px(k.X(0.48), gy + 1, "#f08a2a")
    if (k.big) c.px(k.X(0.48), gy + 2, "#6c7178")
  },
  cherry_grove(k, c) {
    k.sky(SKY, SKY2)
    k.hills(0.62, 0.1, GRASS_L, 1, 1)
    const gy = k.ground(0.7, GRASS, "#9ade6a")
    for (const fx of [0.24, 0.66]) {
      const t = k.tree(fx, gy, k.R.oak, "#ffb7dc", "#f08fc0", { trunk: "#4a2f2a" })
      c.px(t.cx - 1, t.top + 1, "#ffe0f0")
    }
    k.dots(gy + 1, k.H, ["#ffb7dc", "#ffd6ea"], k.big ? 9 : 4, 4)
    k.dots(k.Y(0.45), gy, ["#ffb7dc"], k.big ? 3 : 1, 8, k.X(0.4), k.X(0.6))
  },
  meadow(k, c) {
    k.sky(SKY, SKY2)
    const gy = k.Y(0.66)
    k.peak(0.3, gy, 0.6, 0.5, STONE, SNOW, STONE_D)
    k.peak(0.72, gy, 0.5, 0.36, STONE, SNOW, STONE_D)
    k.hills(0.72, 0.1, "#86cf6a", 0.6, 1, "#a3e283")
    k.dots(k.Y(0.72), k.H, ["#5f8fff", "#ffffff", "#ff9fd6", "#5f8fff"], k.big ? 14 : 6, 6)
  },
  dappled_forest(k, c) {
    k.sky("#b5dcff", "#dcedff")
    const gy = k.ground(0.72, "#6aa63f", "#84c253")
    for (const fx of [0.22, 0.62]) {
      const t = k.tree(fx, gy, k.R.oak, "#5a9a36", "#457a2a")
      c.px(t.cx - 1, t.top + 1, "#c4e06a")
      c.px(t.cx + 1, t.top + 2, "#c4e06a")
      if (k.big) c.px(t.cx - 2, t.top + 3, "#c4e06a")
    }
    k.dots(gy + 1, k.H, ["#f2d06b", "#d9e07a"], k.big ? 8 : 3, 12)
  },
  taiga(k, c) {
    k.sky("#9cc4e8", "#c0dbf2")
    const gy = k.ground(0.74, "#4c7d4f", "#5f9463")
    const o = { trunk: "#4a3320", th: k.big ? 2 : 1 }
    k.tree(0.18, gy, k.R.spruceS, "#2f5f3f", "#234a31", o)
    k.tree(0.5, gy, k.R.spruce, "#2f5f3f", "#234a31", o)
    k.tree(0.8, gy, k.R.spruceS, "#356b47", "#234a31", o)
  },
  snowy_lands(k, c) {
    k.sky("#bcd9f5", "#e0eefb")
    k.hills(0.64, 0.1, SNOW_D, 2, 1)
    const gy = k.ground(0.72, SNOW, "#ffffff")
    for (const [fx, rows] of [[0.26, k.R.spruce], [0.68, k.R.spruceS]]) {
      const t = k.tree(fx, gy, rows, "#3f6f52", "#2f573f", { trunk: "#4a3320", th: k.big ? 2 : 1 })
      for (const i of k.big ? [0, 3, 6] : [0]) if (i < rows.length) k.rows(t.cx2, t.top + i, [rows[i]], "#ffffff")
    }
    k.dots(0, k.Y(0.5), ["#ffffff"], k.big ? 6 : 3, 2, 0, k.X(0.7))
  },
  ice_spikes(k, c) {
    k.sky("#b4d6f7", "#dcecfb")
    const gy = k.ground(0.76, SNOW, "#ffffff")
    k.spike(0.2, gy, 0.42, "#8fcdf5", "#d6f0ff", "#5fa6d6")
    k.spike(0.48, gy, 0.68, "#8fcdf5", "#d6f0ff", "#5fa6d6")
    k.spike(0.76, gy, 0.5, "#8fcdf5", "#d6f0ff", "#5fa6d6")
  },
  mountain_peaks(k, c) {
    k.sky(SKY, SKY2)
    const gy = k.Y(0.84)
    k.peak(0.48, gy, 0.85, 0.78, STONE_D, SNOW, "#5c6168")
    k.peak(0.18, gy, 0.5, 0.48, STONE, SNOW, STONE_D)
    k.peak(0.8, gy, 0.46, 0.4, STONE, SNOW, STONE_D)
    k.ground(0.84, SNOW_D, "#ffffff")
  },
  windswept_hills(k, c) {
    k.sky(SKY, SKY2)
    k.hills(0.74, 0.36, "#7e8a80", 0.8, 1.5, "#6fa055")
    k.hills(0.9, 0.18, "#6b766d", 3, 2, "#5f8f4a")
    k.dots(k.Y(0.6), k.H, ["#9aa39b"], k.big ? 6 : 2, 15)
  },
  desert(k, c) {
    k.sky("#9fd4ff", "#dbeeff")
    k.sun(0.14, 0.2)
    k.hills(0.66, 0.1, SAND_D, 1.5, 1)
    const gy = k.ground(0.72, SAND, SAND_L)
    k.cactus(0.3, gy)
    k.cactus(0.76, gy + 1, k.big ? 4 : 2)
    const x = k.X(0.54)
    c.vline(x, gy, 2, "#8a6a3a")
    c.px(x - 1, gy - 1, "#8a6a3a")
    c.px(x + 1, gy - 1, "#8a6a3a")
  },
  savanna(k, c) {
    k.sky("#a9d3f5", "#e6e8b8")
    const gy = k.ground(0.74, "#b5b04a", "#cbc65e")
    k.tree(0.3, gy, k.R.flat, "#7a9a3a", "#5f7f2f", { trunk: "#7a5a3a", th: k.big ? 6 : 3 })
    k.tree(0.74, gy + 1, k.R.flat, "#86a644", "#5f7f2f", { trunk: "#7a5a3a", th: k.big ? 4 : 2 })
    k.dots(gy + 1, k.H, ["#9a9538"], k.big ? 8 : 3, 21)
  },
  badlands(k, c) {
    k.sky(SKY, SKY2)
    const gy = k.Y(0.8)
    k.mesa(0.02, 0.48, 0.26, gy, MESA)
    k.mesa(0.58, 0.98, 0.48, gy, MESA, 2)
    k.ground(0.8, "#d0763a", "#e08a4a")
  },
  jungle(k, c) {
    k.sky("#8fd0f5", "#c4ecf5")
    k.hills(0.52, 0.2, "#1f6b23", 0.3, 1.3)
    const gy = k.ground(0.8, "#2f9a2c", "#46b83f")
    const t = k.tree(0.3, gy, k.R.jungle, "#3fae3a", "#2a8a2a", { trunk: "#5a4326", th: k.big ? 8 : 4 })
    c.vline(t.left, t.bottom, k.big ? 3 : 1, "#1f6b23")
    c.vline(t.right, t.bottom, k.big ? 4 : 2, "#1f6b23")
    k.tree(0.72, gy + 1, k.R.round, "#46b83f", "#2a8a2a", { th: 0 })
    c.px(k.X(0.58), k.Y(0.3), "#e2585e")
    if (k.big) c.px(k.X(0.58) + 1, k.Y(0.3), "#ffd23d")
  },
  bamboo_jungle(k, c) {
    k.sky("#93d2f2", "#c4ecf5")
    k.hills(0.56, 0.16, "#2a8a2a", 1, 1.2)
    const gy = k.ground(0.82, "#4aa63a", "#62c24e")
    const xs = k.big ? [2, 5, 9, 12, 16, 19] : [1, 3, 5, 8, 10]
    xs.forEach((x, i) => {
      const top = 1 + (i % 3) + (x > k.W - (k.big ? 7 : 4) ? (k.big ? 4 : 3) : 0)
      c.vline(x, top, gy - top + 1, "#a9d64f")
      for (let y = top + 2; y < gy; y += 3) c.px(x, y, "#7fae35")
      c.px(x - 1, top + 1, "#5fbf3f")
      c.px(x + 1, top + 2, "#5fbf3f")
    })
  },
  swamp(k, c) {
    k.sky("#8fa9b8", "#b0c3cc")
    const y = k.water(0.72, "#4a6b5a", "#5f8570")
    c.rect(0, y - 1, k.X(0.5) + 1, k.big ? 3 : 2, "#5a6b3a")
    c.hline(0, y - 1, k.X(0.5) + 1, "#6f8548")
    const t = k.tree(0.26, y - 1, k.R.oak, "#4f7a3a", "#3a5f2c", { trunk: "#4a3a25" })
    for (let x = t.left, i = 0; x <= t.right; x += 2, i++) c.vline(x, t.bottom, 1 + (i % 2) + (k.big ? 1 : 0), "#3a5f2c")
    c.hline(k.X(0.62), y + (k.big ? 2 : 1), 2, "#7fbf4f")
    c.hline(k.X(0.82), y + (k.big ? 4 : 2), 2, "#7fbf4f")
    if (k.big) c.px(k.X(0.62), y + 1, "#ffffff")
  },
  mangrove_swamp(k, c) {
    k.sky("#93b5c4", "#b7ced8")
    const y = k.water(0.76, "#5a7a5f", "#6f9273")
    for (const fx of [0.28, 0.72]) {
      const base = y - (k.big ? 2 : 1)
      const t = k.tree(fx, base, k.R.round, "#4f8a3a", "#3a6b2c", { trunk: "#8a4a32" })
      const tw = k.big ? 2 : 1, d = k.big ? 3 : 2
      c.line(t.x, base - 1, t.x - d, y + 1, "#8a4a32")
      c.line(t.x + tw - 1, base - 1, t.x + tw - 1 + d, y + 1, "#8a4a32")
      c.vline(t.x, base, d, "#6b3a28")
    }
  },
  mushroom_fields(k, c) {
    k.sky(SKY, SKY2)
    k.hills(0.64, 0.08, "#74607b", 1, 1)
    const gy = k.ground(0.7, "#8a7391", "#a38bab")
    const t = k.tree(0.3, gy, k.R.cap, "#d6453c", "#a8322c", { trunk: "#ece4d6", th: k.big ? 4 : 2 })
    c.px(t.cx, t.top, "#ffffff")
    if (k.big) {
      c.px(t.cx - 3, t.top + 1, "#ffffff")
      c.px(t.cx + 2, t.top + 1, "#ffffff")
    }
    k.tree(0.74, gy + 1, k.big ? [8, 10] : [3, 5], "#9a7355", "#7a5a40", { trunk: "#ece4d6", th: k.big ? 3 : 1 })
  },
  beach(k, c) {
    k.sky(SKY, SKY2)
    k.sun(0.14, 0.18)
    k.water(0.46, "#3f8fe0", "#9fd0ff", 3)
    for (let x = 0; x < k.W; x++) {
      const sy = k.Y(0.6) + Math.round((x / (k.W - 1)) * k.H * 0.32)
      c.rect(x, sy, 1, k.H - sy, "#f0e2a8")
      c.px(x, sy - 1, "#ffffff")
    }
    k.dots(k.Y(0.82), k.H, ["#ff9fb5", "#ffffff", "#d9c98a"], k.big ? 4 : 2, 5, 0, k.X(0.45))
  },
  ocean(k, c) {
    k.sky(SKY, SKY2)
    k.sun(0.14, 0.18)
    const y = k.water(0.46, "#2f6fd0", "#7fb4f0", 11)
    c.rect(0, y, k.W, k.big ? 2 : 1, "#4f8fe0")
    const x = k.X(0.56)
    if (k.big) {
      c.hline(x - 2, y + 1, 6, "#7a4a2a")
      c.hline(x - 1, y + 2, 4, "#5a3418")
      c.vline(x, y - 4, 5, "#5a3418")
      c.rect(x + 1, y - 4, 2, 3, "#ffffff")
      c.px(x + 3, y - 2, "#ffffff")
    } else {
      c.hline(x - 1, y, 3, "#7a4a2a")
      c.px(x, y - 1, "#ffffff")
      c.px(x, y - 2, "#ffffff")
    }
  },
  frozen_ocean(k, c) {
    k.sky("#b9d9f5", "#e3f0fb")
    const y = k.water(0.6, "#3f6fb5", "#6f9ad6", 4)
    k.peak(0.3, y + 1, 0.44, 0.38, "#dff0fb", "#ffffff", "#a9d2ee")
    k.peak(0.72, y + 1, 0.3, 0.2, "#dff0fb", "#ffffff", "#a9d2ee")
    c.hline(k.X(0.5), y + (k.big ? 4 : 2), k.big ? 4 : 2, "#eef7fd")
    c.hline(k.X(0.08), y + (k.big ? 6 : 3), k.big ? 3 : 2, "#eef7fd")
  },
  lush_caves(k, c) {
    c.rect(0, 0, k.W, k.H, "#262e26")
    const d = k.ceiling("#3f4a3a", 3)
    const gy = k.ground(0.76, "#5f9a3a", "#7fc04f")
    c.rect(0, gy + (k.big ? 3 : 2), k.W, k.H, "#3f4a3a")
    c.rect(k.X(0.6), gy, k.big ? 6 : 3, k.big ? 2 : 1, "#3f8fd6")
    c.px(k.X(0.6) + 1, gy, "#9fd0ff")
    const t = k.tree(0.26, gy, k.R.round, "#4f9a3a", "#3a7a2c", { th: k.big ? 2 : 1, trunk: "#5a4326" })
    c.px(t.cx - 1, t.top + 1, "#f08fc0")
    c.px(t.cx + 1, t.top, "#f08fc0")
    for (const [fx, len] of [[0.46, 6], [0.62, 4], [0.12, 3]]) {
      const x = k.X(fx), n = k.big ? len : Math.ceil(len / 2)
      c.vline(x, d, n, "#3f7a2f")
      c.px(x, d + n, "#ffb030")
      if (k.big) c.px(x, d + 2, "#ffb030")
    }
  },
  dripstone_caves(k, c) {
    c.rect(0, 0, k.W, k.H, "#332c27")
    const d = k.ceiling("#5a4f45", 8)
    const gy = k.ground(0.82, "#5a4f45", "#6b5f53")
    for (const [fx, len] of [[0.1, 5], [0.3, 9], [0.5, 4], [0.66, 6]]) k.drip(fx, d, len, "#9a7f66", "#b99d82")
    for (const [fx, len] of [[0.2, 3], [0.44, 6], [0.84, 4]]) k.drip(fx, gy - 1, len, "#9a7f66", "#b99d82", true)
    c.px(k.X(0.3), d + (k.big ? 10 : 6), "#7fb4f0")
    c.hline(k.X(0.56), gy, k.big ? 4 : 2, "#3f7fb5")
  },
  deep_dark(k, c) {
    c.rect(0, 0, k.W, k.H, "#0b1418")
    const d = k.ceiling("#101d23", 6)
    const gy = k.ground(0.76, "#0f2a33", "#16404a")
    const x = k.X(0.26), w = k.big ? 3 : 2
    c.rect(x, d, w, gy - d, "#353b41")
    for (let y = d + 1; y < gy; y += 3) c.hline(x, y, w, "#262b30")
    c.px(x + w, k.Y(0.42), "#5fe6e6")
    k.dots(gy, k.H, ["#2fd0d0", "#1f8a94"], k.big ? 8 : 3, 14)
    const s = k.X(0.66)
    c.vline(s, gy - 2, 2, "#2fd0d0")
    c.vline(s + 2, gy - (k.big ? 3 : 2), k.big ? 3 : 2, "#2fd0d0")
    if (k.big) c.hline(s - 1, gy - 1, 5, "#1b4a55")
  },
  nether(k, c) {
    c.rect(0, 0, k.W, k.H, "#4a1a1a")
    const d = k.ceiling("#7a2a26", 5, k.big ? 3 : 2)
    const y = k.Y(0.76)
    c.rect(0, y, k.W, k.H - y, "#f08a2a")
    k.waves(y + 1, k.H, "#ffd23d", 9)
    const l = k.X(0.36), r = k.X(0.72)
    for (let x = 0; x <= l; x++) {
      const top = y - Math.round((1 - x / l) * k.H * 0.28)
      c.rect(x, top, 1, k.H - top, "#8a2f2a")
    }
    for (let x = r; x < k.W; x++) {
      const top = y - Math.round(((x - r) / (k.W - 1 - r)) * k.H * 0.22)
      c.rect(x, top, 1, k.H - top, "#8a2f2a")
    }
    c.rect(k.X(0.54), d, k.big ? 2 : 1, y - d, "#f0a02a")
    c.vline(k.X(0.54), d, y - d, "#ffd23d")
    c.rect(k.X(0.2), d, k.big ? 3 : 2, k.big ? 2 : 1, "#ffd98a")
  },
  nether_forests(k, c) {
    c.rect(0, 0, k.W, k.H, "#3a1420")
    const d = k.ceiling("#5a1f2a", 7)
    const gy = k.Y(0.74), half = k.W >> 1
    c.rect(0, gy, half, k.H - gy, "#b5303a")
    c.hline(0, gy, half, "#d64550")
    c.rect(half, gy, k.W - half, k.H - gy, "#2a9a8f")
    c.hline(half, gy, k.W - half, "#3fc4b5")
    const th = k.big ? 4 : 2
    const a = k.tree(0.24, gy, k.R.cap, "#c93a3a", "#9a2a2e", { trunk: "#7a2a3a", th })
    c.px(a.cx - 1, a.top + 1, "#ffb347")
    const b = k.tree(0.74, gy, k.R.cap, "#2fb5a6", "#1f8a7f", { trunk: "#3a6f7a", th })
    c.px(b.cx, b.top + 1, "#8ff0e0")
    c.vline(k.X(0.04), d, k.big ? 5 : 2, "#c93a3a")
    c.vline(k.X(0.5), gy - (k.big ? 3 : 2), k.big ? 3 : 2, "#2fb5a6")
  },
  the_end(k, c) {
    c.rect(0, 0, k.W, k.H, "#140c1f")
    k.dots(0, k.Y(0.6), ["#d9c9ff", "#8f7fb5"], k.big ? 10 : 4, 11)
    k.hills(0.76, 0.05, "#dcd9a3", 1, 1, "#efedc0")
    const gy = k.Y(0.74), w = k.big ? 3 : 2
    for (const [fx, fy] of [[0.18, 0.14], [0.7, 0.44]]) {
      const x = k.X(fx), top = k.Y(fy)
      c.rect(x, top, w, gy - top, "#2a1f3d")
      c.vline(x, top, gy - top, "#3d2f57")
      c.px(x + (w >> 1), top - 1, "#ff8fe0")
      if (k.big) c.px(x + 1, top - 2, "#ffffff")
    }
    const x = k.X(0.46), h = k.big ? 6 : 3
    c.vline(x, gy - h, h, "#8f5fb5")
    c.px(x - 1, gy - h + 1, "#8f5fb5")
    c.px(x + 1, gy - h + 2, "#8f5fb5")
    c.px(x, gy - h - 1, "#d6b3f0")
    c.px(x - 2, gy - h + 1, "#d6b3f0")
    if (k.big) c.px(x + 2, gy - h + 2, "#d6b3f0")
  },
  sulfur_caves(k, c) {
    c.rect(0, 0, k.W, k.H, "#2b2a1f")
    const d = k.ceiling("#4a4832", 4)
    const gy = k.ground(0.78, "#b5a83a", "#e6d84a")
    k.drip(0.42, d, 5, "#8a8440", "#b5ae5a")
    k.spike(0.24, gy, 0.46, "#f0e04a", "#fff59a", "#c9b82f")
    k.spike(0.5, gy, 0.26, "#f0e04a", "#fff59a", "#c9b82f")
    k.spike(0.72, gy, 0.36, "#f0e04a", "#fff59a", "#c9b82f")
    c.hline(k.X(0.54), gy + 1, k.big ? 5 : 2, "#cfe04a")
    if (k.big) {
      c.px(k.X(0.6), gy - 2, "#d9d9c0")
      c.px(k.X(0.62), gy - 4, "#d9d9c0")
    }
  },
  mystery(k, c) {
    k.sky("#2a2440", "#3a3060")
    k.dots(0, k.Y(0.7), ["#ffffff", "#f0d04a", "#8f85c9"], k.big ? 10 : 4, 17)
    k.hills(0.84, 0.14, "#1a1630", 2, 1.5)
    if (k.big) c.text(8, 3, "?", "#f0d04a", { scale: 2 })
    else c.text(4, 1, "?", "#f0d04a")
  },
  ice_caves(k, c) {
    c.rect(0, 0, k.W, k.H, "#16222e")
    const d = k.ceiling("#2f5578", 9)
    for (const [fx, len] of [[0.12, 4], [0.34, 7], [0.56, 5]]) k.drip(fx, d, len, "#9fd0f0", "#e6f5ff")
    const gy = k.ground(0.78, "#7fb5e0", "#c9ebff")
    k.spike(0.3, gy, 0.4, "#5fa6e6", "#bfe6ff", "#3f7fc0")
    k.spike(0.64, gy, 0.28, "#5fa6e6", "#bfe6ff", "#3f7fc0")
    k.dots(gy + 1, k.H, ["#ffffff"], k.big ? 5 : 2, 23)
  },
  fest_new_year(k, c) {
    k.sky("#101638", "#1c2452")
    k.dots(0, k.Y(0.6), ["#8f95c9"], k.big ? 6 : 2, 31)
    const gy = k.Y(0.84)
    c.rect(0, gy, k.W, k.H - gy, "#0a0e24")
    for (const [fx, h] of [[0.08, 3], [0.3, 5], [0.52, 2], [0.76, 4]]) {
      const x = k.X(fx), hh = k.big ? h : Math.ceil(h / 2), w = k.big ? 3 : 2
      c.rect(x, gy - hh, w, hh, "#0a0e24")
      c.px(x + 1, gy - hh + 1, "#ffd98a")
    }
    k.burst(0.26, 0.34, k.big ? 4 : 2, "#ffd23d")
    k.burst(0.6, 0.5, k.big ? 3 : 2, "#ff7fb5")
    k.burst(0.5, 0.16, k.big ? 2 : 1, "#6fe0ff")
  },
  fest_songkran(k, c) {
    k.sky(SKY, SKY2)
    k.sun(0.14, 0.18)
    const gy = k.ground(0.74, SAND, SAND_L)
    k.peak(0.72, gy + 1, 0.34, 0.36, SAND_D, null, "#b89a55")
    const top = gy + 1 - Math.max(2, Math.round(0.36 * k.H)), px = k.X(0.72)
    c.vline(px, top - 2, 2, "#7a5a3a")
    c.px(px + 1, top - 2, "#e2585e")
    if (k.big) c.px(px - 1, top - 1, "#3f8fe0")
    const x = k.X(0.3)
    if (k.big) {
      c.rect(x - 3, gy - 2, 7, 2, "#e6b93a")
      c.hline(x - 2, gy, 5, "#c9982a")
      c.hline(x - 2, gy - 2, 5, "#6fc4ff")
      for (const [dx, dy] of [[-4, -4], [-2, -6], [0, -7], [2, -6], [4, -5], [5, -3], [-5, -2]]) c.px(x + dx, gy + dy, dx % 2 ? "#dff2ff" : "#6fc4ff")
    } else {
      c.hline(x - 1, gy - 1, 3, "#e6b93a")
      c.px(x, gy - 1, "#6fc4ff")
      for (const [dx, dy] of [[-2, -2], [0, -3], [2, -3], [3, -1]]) c.px(x + dx, gy + dy, "#6fc4ff")
    }
  },
  fest_midyear(k, c) {
    k.sky("#f07a3a", "#ffc46a")
    const y = k.Y(0.62), x = k.X(0.46)
    c.circ(x, y, k.big ? 4 : 2, "#fff2b0")
    c.rect(0, y, k.W, k.H - y, "#3f5fa6")
    for (let i = 0; y + 1 + i * (k.big ? 2 : 1) < k.H; i++) {
      const w = Math.max(1, (k.big ? 8 : 4) - i * (k.big ? 2 : 1))
      c.hline(x - (w >> 1), y + 1 + i * (k.big ? 2 : 1), w, i % 2 ? "#ffc46a" : "#fff2b0")
    }
    c.rect(0, y - 1, k.X(0.2), 1, "#7a3a3a")
    c.rect(k.X(0.78), y - (k.big ? 2 : 1), k.W, k.big ? 2 : 1, "#7a3a3a")
    c.px(k.X(0.2), k.Y(0.2), "#7a3a3a")
    c.px(k.X(0.2) + 2, k.Y(0.2), "#7a3a3a")
    c.px(k.X(0.2) + 1, k.Y(0.2) + 1, "#7a3a3a")
  },
  fest_halloween(k, c) {
    k.sky("#2a1a3a", "#4a2a5a")
    if (k.big) c.circ(k.X(0.22), k.Y(0.3), 3, "#ffe9a0")
    else c.rect(k.X(0.18), k.Y(0.2), 2, 2, "#ffe9a0")
    const gy = k.ground(0.78, "#1f1428", "#33203f")
    const x = k.X(0.6)
    if (k.big) {
      c.rect(x - 3, gy - 5, 8, 6, "#f08a2a")
      for (const [dx, dy] of [[-3, -5], [4, -5], [-3, 0], [4, 0]]) c.px(x + dx, gy + dy, dy ? "#4a2a5a" : "#1f1428")
      c.vline(x - 1, gy - 5, 6, "#c96a1a")
      c.vline(x + 2, gy - 5, 6, "#c96a1a")
      c.rect(x, gy - 7, 2, 2, "#4f8a3a")
      c.px(x - 2, gy - 3, "#ffd23d")
      c.px(x + 3, gy - 3, "#ffd23d")
      c.px(x - 2, gy - 4, "#ffd23d")
      c.px(x + 3, gy - 4, "#ffd23d")
      c.hline(x - 2, gy - 1, 6, "#ffd23d")
      c.px(x, gy - 1, "#f08a2a")
      for (const [bx, by] of [[0.44, 0.12], [0.62, 0.3]]) {
        const u = k.X(bx), v = k.Y(by)
        c.px(u - 1, v, "#120a1a")
        c.px(u, v + 1, "#120a1a")
        c.px(u + 1, v, "#120a1a")
      }
    } else {
      c.rect(x - 2, gy - 4, 5, 4, "#f08a2a")
      c.px(x, gy - 5, "#4f8a3a")
      c.px(x - 1, gy - 3, "#ffd23d")
      c.px(x + 1, gy - 3, "#ffd23d")
      c.hline(x - 1, gy - 1, 3, "#ffd23d")
      c.px(k.X(0.5), k.Y(0.1), "#120a1a")
    }
  },
}

// ---------- แสตมป์ความหายาก: แยกได้ทั้งสีและรูปทรง ----------
const RARITY = { common: "#7d848c", uncommon: "#2f9e44", rare: "#c2255c" }
const MOTIF_S = { common: ["###", "###", "###"], uncommon: [".#.", "###", ".#."], rare: ["#.#", ".#.", "#.#"] }
const MOTIF_B = {
  common: ["#####", "#...#", "#.#.#", "#...#", "#####"],
  uncommon: ["..#..", ".###.", "#####", ".###.", "..#.."],
  rare: ["..#..", "#####", ".###.", ".#.#.", "#...#"],
}
const motif = (x, y, rows, col) => (c) => rows.forEach((row, j) => [...row].forEach((ch, i) => c.px(x + i, y + j, ch === "#" ? col : "#fffdf5")))

// ---------- บอร์ดและกรอบโปสการ์ด ----------
sprite("_board", { w: 32, h: 32 },
  rect(0, 0, 32, 32, "w"), hline(0, 0, 32, "#9a6238"), vline(0, 0, 32, "#9a6238"), hline(0, 31, 32, "#5a3418"), vline(31, 0, 32, "#5a3418"),
  rect(2, 2, 28, 28, "c"), hline(2, 2, 28, "#a67c4a"), vline(2, 2, 28, "#a67c4a"), noise(3, 3, 26, 26, "d", 0.1, 3))
const pin = (x, y, col, hi, sh) => [rect(x, y, 2, 2, col), px(x, y, hi), px(x + 1, y + 2, sh)]

sprite("board_empty", { w: 32, h: 32 }, stamp("_board", 0, 0),
  ...pin(8, 7, "#e2585e", "#ff9a9a", "#8a2a30"), ...pin(22, 20, "#3f8fe0", "#9fd0ff", "#2a5a94"), px(15, 14, "#a67c4a"), px(19, 9, "#a67c4a"), px(11, 22, "#a67c4a"))

for (const { id, rarity } of BPC.cards) {
  if (!SCENES[id]) throw new Error("ไม่มีฉากของการ์ด " + id)
  sprite("_big_" + id, { w: 22, h: 18 }, (c) => SCENES[id](kit(c), c))
  sprite("_small_" + id, { w: 12, h: 9 }, (c) => SCENES[id](kit(c), c))
  sprite("board_" + id, { w: 32, h: 32 }, stamp("_board", 0, 0),
    rect(5, 7, 24, 21, "#a67c4a"), rect(4, 6, 24, 21, PAPER), stamp("_big_" + id, 5, 7),
    motif(22, 7, MOTIF_B[rarity], RARITY[rarity]), hline(6, 25, 9, "#b9ae96"),
    ...pin(15, 4, "#e2585e", "#ff9a9a", "#8a2a30"))
  sprite("item_" + id, { w: 16, h: 16 },
    rect(0, 1, 16, 14, INK), px(0, 1, "_"), px(15, 1, "_"), px(0, 14, "_"), px(15, 14, "_"),
    rect(1, 2, 14, 12, PAPER), stamp("_small_" + id, 2, 3),
    motif(11, 3, MOTIF_S[rarity], RARITY[rarity]), hline(3, 12, 6, "#b9ae96"))
}

// ---------- ไอเท็มอื่น ----------
sprite("album", { w: 16, h: 16 },
  rect(1, 0, 14, 16, INK), px(1, 0, "_"), px(14, 0, "_"), px(1, 15, "_"), px(14, 15, "_"),
  rect(2, 1, 12, 14, "#8a5a2f"), rect(2, 1, 2, 14, "#6b4423"), vline(13, 2, 12, "#f4efe6"), hline(4, 14, 9, "#e0d8c6"),
  px(5, 2, "#e6b93a"), px(12, 2, "#e6b93a"), px(5, 13, "#e6b93a"), px(12, 13, "#e6b93a"),
  rect(5, 4, 7, 6, "#fbf8ee"), rect(6, 5, 5, 2, "#8fc7ff"), rect(6, 7, 5, 2, "#6fb548"), px(7, 5, "#fff2a8"), hline(6, 11, 5, "#e6b93a"))
// ไอคอนไอเท็มของ Pin Board: บอร์ดไม้ก๊อกในกรอบไม้ มีโปสการ์ดใบเล็กปักหมุด
sprite("pin_board_item", { w: 16, h: 16 },
  rect(0, 0, 16, 16, INK), px(0, 0, "_"), px(15, 0, "_"), px(0, 15, "_"), px(15, 15, "_"),
  rect(1, 1, 14, 14, "w"), hline(1, 1, 14, "#9a6238"), vline(1, 1, 14, "#9a6238"), hline(2, 14, 13, "#5a3418"), vline(14, 2, 13, "#5a3418"),
  rect(3, 3, 10, 10, "c"), hline(3, 3, 10, "#a67c4a"), vline(3, 3, 10, "#a67c4a"), px(5, 11, "d"), px(11, 5, "d"), px(10, 11, "d"),
  rect(5, 6, 7, 5, "#a67c4a"), rect(4, 5, 7, 5, PAPER), rect(5, 6, 5, 2, SKY), rect(5, 8, 5, 1, GRASS), px(6, 6, "#fff2a8"),
  rect(7, 4, 2, 2, "#e2585e"), px(7, 4, "#ff9a9a"))
sprite("blank_postcard", { w: 16, h: 16 },
  rect(0, 1, 16, 14, INK), px(0, 1, "_"), px(15, 1, "_"), px(0, 14, "_"), px(15, 14, "_"),
  rect(1, 2, 14, 12, "#fbf8ee"), vline(7, 4, 8, "#d9cfb8"), hline(9, 7, 4, "#c9bfa8"), hline(9, 9, 4, "#c9bfa8"), hline(9, 11, 4, "#c9bfa8"),
  box(11, 3, 3, 3, "#c9bfa8"), box(2, 4, 4, 4, "#e4dcc8"))
sprite("lock", { w: 16, h: 16 },
  box(4, 1, 8, 8, "#3b3f45"), box(5, 2, 6, 7, "#aeb4ba"), rect(6, 3, 4, 6, "_"),
  rect(2, 7, 12, 8, "#3b3f45"), rect(3, 8, 10, 6, "#d9a441"), hline(3, 8, 10, "#f0c868"), hline(3, 13, 10, "#a87a26"),
  rect(7, 10, 2, 3, "#3b3f45"))

// ---------- ของตกแต่ง (รางวัลชุด + ของที่ระลึก) วาดบน 14×14 แล้วตัดเส้นขอบเป็น 16×16 ----------
const deco = (name, ...items) => sprite(name, { w: 14, h: 14, outline: INK }, ...items)
const base = [rect(3, 12, 8, 2, "#7a4a2a"), hline(3, 12, 8, "#9a6238")]
deco("trophy_forests", rect(3, 10, 8, 4, "#b5623a"), hline(2, 10, 10, "#c97a4a"),
  line(7, 9, 6, 6, "#6b4a2b"), line(6, 6, 8, 4, "#6b4a2b"), circ(5, 4, 3, "#4f9a35"), circ(9, 4, 2, "#3f8a2f"), px(4, 3, "#8fd05a"), px(9, 3, "#6fb548"))
deco("trophy_cold", ...base, poly([5, 12, 5, 4, 7, 1, 9, 4, 9, 12], "#8fcdf5"), poly([2, 12, 2, 8, 4, 6, 5, 8, 5, 12], "#b9e2ff"),
  poly([9, 12, 9, 7, 11, 5, 12, 8, 12, 12], "#5fa6d6"), vline(6, 3, 7, "#e6f5ff"), px(3, 8, "#ffffff"))
deco("trophy_dry", rect(3, 0, 8, 2, "#8a5a2f"), rect(3, 12, 8, 2, "#8a5a2f"), poly([4, 2, 10, 2, 7, 7], "#d9eef7"), poly([7, 7, 10, 12, 4, 12], "#d9eef7"),
  rect(5, 2, 4, 2, "#e8d591"), px(6, 4, "#e8d591"), px(7, 4, "#e8d591"), vline(7, 5, 5, "#e8d591"), rect(5, 10, 4, 2, "#e8d591"), rect(6, 9, 2, 1, "#e8d591"))
deco("trophy_wet", poly([1, 8, 13, 8, 11, 13, 3, 13], "#9aa0a6"), rect(1, 7, 12, 2, "#6f9ad6"), hline(2, 7, 4, "#9fc4f0"),
  rect(3, 6, 4, 2, "#5fae45"), px(6, 6, "#6f9ad6"), rect(8, 5, 3, 2, "#ff9fd6"), px(9, 4, "#ffd0ea"), px(9, 5, "#ffd23d"), hline(3, 12, 8, "#7d848c"))
deco("trophy_fields", ...base, poly([7, 11, 2, 7, 3, 4, 7, 2, 11, 4, 12, 7], "#ffe2d2"),
  line(7, 11, 3, 6, "#f0a58f"), line(7, 11, 5, 3, "#f0a58f"), line(7, 11, 7, 2, "#f0a58f"), line(7, 11, 9, 3, "#f0a58f"), line(7, 11, 11, 6, "#f0a58f"), rect(6, 10, 3, 2, "#d98a72"))
deco("trophy_underground", circ(7, 7, 6, "#6c7178"), circ(7, 7, 4, "#3a2f5a"), px(3, 3, "#8a8f96"), px(4, 2, "#8a8f96"),
  px(5, 6, "#b58cff"), px(6, 5, "#d9c2ff"), px(8, 6, "#2fd0d0"), px(9, 8, "#b58cff"), px(6, 9, "#2fd0d0"), px(7, 7, "#ffffff"), px(8, 9, "#8ff0f0"), px(5, 8, "#8f5fe0"))
deco("trophy_otherworld", ...base, poly([7, 0, 11, 6, 9, 12, 5, 12, 3, 6], "#2a1f3d"), poly([7, 3, 9, 7, 8, 11, 6, 11, 5, 7], "#b05ad6"),
  px(7, 5, "#f0c9ff"), px(6, 8, "#d68af0"), px(7, 9, "#f0c9ff"), vline(4, 5, 3, "#3d2f57"))
deco("traveler_globe", rect(4, 12, 6, 2, "#c9982a"), hline(4, 12, 6, "#e6b93a"), vline(7, 10, 2, "#e6b93a"), circ(7, 5, 5, "#3f8fe0"),
  rect(4, 3, 3, 2, "#5fae45"), px(5, 5, "#5fae45"), rect(8, 5, 3, 3, "#5fae45"), px(9, 4, "#5fae45"), px(6, 8, "#5fae45"), px(4, 2, "#9fd0ff"), px(5, 1, "#9fd0ff"))
deco("souvenir_snow_globe", rect(3, 11, 8, 3, "#8a5a2f"), hline(3, 11, 8, "#a8713d"), circ(7, 6, 5, "#d9eef7"), rect(3, 9, 9, 2, "#ffffff"),
  rect(7, 8, 1, 2, "#6b4a2b"), hline(6, 7, 3, "#3f8a2f"), hline(6, 5, 3, "#3f8a2f"), px(7, 4, "#3f8a2f"), px(7, 6, "#3f8a2f"),
  px(4, 4, "#ffffff"), px(10, 5, "#ffffff"), px(9, 3, "#ffffff"), px(5, 7, "#ffffff"), px(5, 2, "#f4fbff"))
deco("souvenir_cactus_pot", poly([3, 9, 11, 9, 10, 14, 4, 14], "#c46a32"), rect(2, 8, 10, 2, "#d98a4a"),
  rect(6, 2, 3, 7, "#4f9a3a"), vline(8, 2, 7, "#3a7a2c"), hline(3, 5, 3, "#4f9a3a"), vline(3, 3, 2, "#4f9a3a"), hline(9, 6, 2, "#3a7a2c"), vline(10, 4, 2, "#3a7a2c"),
  px(7, 1, "#ff9fd6"), px(6, 1, "#ffd0ea"))
deco("souvenir_shell_jar", rect(3, 4, 8, 10, "#d9eef7"), rect(4, 1, 6, 3, "#b98a5a"), hline(4, 1, 6, "#d1a674"), rect(3, 10, 8, 4, "#e8d591"),
  px(4, 9, "#ff9fb5"), px(5, 9, "#ffd0da"), px(8, 9, "#f0a58f"), px(9, 8, "#ffffff"), px(6, 8, "#ffffff"), px(7, 9, "#ff9fb5"), vline(4, 5, 3, "#ffffff"))
deco("souvenir_golden_compass", rect(6, 0, 2, 2, "#c9982a"), circ(7, 8, 6, "#e6b93a"), circ(7, 8, 4, "#fff6e0"),
  line(7, 8, 9, 5, "#e2585e"), line(7, 8, 5, 11, "#6c7178"), px(7, 8, "#3b2a1a"), px(3, 5, "#f7d875"), px(4, 4, "#f7d875"))

// ---------- แผ่นรวมสำหรับตรวจด้วยตา ----------
sheet("sheet_boards", ["board_*"], { cols: 8, pad: 1 })
sheet("sheet_items", ["item_*", "album", "blank_postcard", "pin_board_item", "lock", "trophy_*", "traveler_globe", "souvenir_*"], { cols: 11, pad: 1 })
