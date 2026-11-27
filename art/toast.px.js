// การ์ดแจ้งเตือนแบบปุ่ม Marketplace: ฉากพื้นหลัง + ชั้นหน้า ธีมละ 2 แถบ แถบละ 8 เฟรม (เฟรมละ 80×16 แสดงในเกมที่ 2 เท่า)
// พื้นหลังเขียนเป็นฟังก์ชันสีของ (x, y, เฟรม) จึงทึบทุกพิกเซลและวนต่อกันพอดี: ทุกการเคลื่อนไหวใช้ ph ที่ครบรอบใน 8 เฟรม
// สีอิงโทนของบล็อกในเกม (หญ้า ใบไม้ หิมะ ทราย หิน ลาวา) สร้างด้วย tools/art.mjs

const W = 80;
const H = 16;
const F = 8;
const TAU = Math.PI * 2;
const wrap = (v, m) => ((v % m) + m) % m;
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (r, g, b) => "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => {
  const A = rgb(a);
  const B = rgb(b);
  return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
};
const alpha = (color, a) => color + clamp(a * 255).toString(16).padStart(2, "0");
/** ไล่สีแนวตั้งแบบเป็นขั้น (4 ขั้น) ให้ยังดูเป็นพิกเซลอาร์ต */
const grade = (top, bottom, y, rows) => mix(top, bottom, Math.min(3, Math.floor((y / rows) * 4)) / 3);
/** สุ่มแบบคงที่ต่อดัชนี ภาพจึงเหมือนเดิมทุกครั้งที่สร้าง */
const rnd = (i, s = 1) => {
  const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
/** ความสูงของยอดสามเหลี่ยมที่ตำแหน่ง x */
const tri = (x, cx, half, h) => Math.max(0, h * (1 - Math.abs(x - cx) / half));

const bg = {
  // ป่า: แนวไม้ไหวตามลม ลำต้น พุ่มหน้า และแสงลอดกิ่งที่สว่างสลับกัน
  forests(x, y, f, ph) {
    const sway = Math.round(Math.sin(ph + x * 0.09));
    const far = 6 - Math.round(1.6 * Math.sin((x + sway) * 0.42) + 1.2 * Math.sin((x + sway) * 0.19 + 2));
    const near = 12 - Math.round(1.2 * Math.sin(x * 0.55 + 1) + 0.8 * Math.sin(x * 0.23));
    let col;
    if (y >= near) col = y >= 14 ? "#3d7a2a" : y === near ? "#6fbf4a" : "#4f9a35";
    else if (y >= far) col = y >= 9 && x % 11 === 4 ? "#5a3c22" : y === far ? "#3d8a2c" : "#2f6b22";
    else col = grade("#8fc7ff", "#cfeaff", y, 10);
    const d = x - y * 0.5 + 80;
    if (y < near && d % 26 < 3) col = mix(col, "#fff6c0", 0.2 + 0.12 * Math.sin(ph + Math.floor(d / 26) * 2.1));
    return col;
  },
  // ดินแดนหนาว: แสงเหนือไหล ภูเขาหิมะ ต้นสน
  cold(x, y, f, ph) {
    let col = grade("#27356b", "#5f86c4", y, 11);
    if (y < 3 && (x * 13 + y * 7) % 53 === 0 && (f + x) % 8 < 5) col = "#e8f2ff";
    const a = y - (2.5 + 1.3 * Math.sin(x / 6.5 + ph));
    if (a >= -0.5 && a < 0.5) col = mix(col, "#7ff2c8", 0.8);
    else if (a >= 0.5 && a < 2.5) col = mix(col, "#7ff2c8", 0.3);
    const b = y - (5.2 + Math.sin(x / 9 - ph + 2));
    if (b >= -0.5 && b < 0.5) col = mix(col, "#8fd0ff", 0.5);
    const peaks = [[16, 14, 9], [40, 16, 11], [66, 13, 8]];
    let m = 0;
    let peak = peaks[0];
    for (const p of peaks) {
      const h = tri(x, p[0], p[1], p[2]);
      if (h > m) [m, peak] = [h, p];
    }
    const top = 13 - Math.round(m);
    if (m > 0.5 && y >= top) col = y - top < 2 + ((x * 7) % 3 === 0 ? 1 : 0) ? (x > peak[0] ? "#d7e6f5" : "#f3f8fc") : x > peak[0] ? "#647285" : "#7f8c9a";
    for (const cx of [7, 27, 51, 73]) {
      const half = Math.floor((y - 7) / 2);
      if (y >= 8 && y <= 13 && Math.abs(x - cx) <= half) col = y % 2 === 0 && Math.abs(x - cx) === half ? "#f3f8fc" : "#2b4f37";
      if (y === 7 && x === cx) col = "#f3f8fc";
    }
    if (y >= 13) col = y === 15 ? "#d7e6f5" : y === 13 && x % 9 < 3 ? "#e6f0fa" : "#f3f8fc";
    return col;
  },
  // ร้อนแห้ง: เนินทราย กระบองเพชร ไอแดดสั่นที่ขอบฟ้า
  dry(x, y, f, ph) {
    const sx = y >= 8 && y <= 10 ? x + Math.round(Math.sin(ph + y * 1.7)) : x;
    let col = grade("#6db4f5", "#ffe2a0", y, 11);
    const sun = Math.hypot(x - 62, y - 4);
    if (sun < 2.5) col = "#fff6c8";
    else if (sun < 3.5) col = "#ffd83d";
    const far = 10 - Math.round(1.5 * (0.5 + 0.5 * Math.sin((sx / 20) * TAU)));
    if (y >= far) col = y === far ? "#e3c98a" : "#d9bd72";
    const wave = (v) => 2.5 * (0.5 + 0.5 * Math.sin((v / 40) * TAU + 2));
    const near = 12 - Math.round(wave(x));
    if (y >= near) col = y === near ? "#f2e2a8" : wave(x + 1) < wave(x) && y - near < 3 ? "#cdb26a" : "#e6d28f";
    for (const cx of [27, 50]) {
      const dx = x - cx;
      if ((dx === 0 || dx === 1) && y >= 6 && y <= 13) col = dx === 0 ? "#4f9a35" : "#3d7a2a";
      if ((dx === -2 && (y === 8 || y === 9)) || (dx === -1 && y === 9)) col = "#4f9a35";
      if ((dx === 3 && (y === 7 || y === 8)) || (dx === 2 && y === 8)) col = "#3d7a2a";
    }
    return col;
  },
  // ชุ่มชื้น: เรือนยอดทึบ เถาวัลย์ไหว ผืนน้ำกระเพื่อม ใบบัว และกก
  wet(x, y, f, ph) {
    const canopyAt = (v) => 4 + Math.round(1.5 * Math.sin(v * 0.5) + Math.sin(v * 0.17 + 1));
    const canopy = canopyAt(x);
    let col = grade("#2f7d32", "#5aa868", y, 11);
    if (y < canopy) col = y === canopy - 1 ? "#2a8a2e" : "#1f6b23";
    for (const b of [x - 1, x, x + 1]) {
      if (wrap(b, 9) !== 2) continue; // เถาวัลย์ห้อยทุก 9 พิกเซล ปลายล่างแกว่งตามลม
      const top = canopyAt(b);
      const s = y > top + 1 ? Math.round(Math.sin(ph + b)) : 0;
      if (b + s === x && y >= top && y < top + 3 + (b % 4)) col = "#2f9a2c";
    }
    if (y >= 11) {
      col = y >= 14 ? "#356d7d" : "#3f7f8f";
      if (y % 2 === 1 && wrap(x + f + y * 3, 10) < 3) col = "#6fb0b8";
      for (const [px, py] of [[12, 12], [40, 13], [63, 12]]) if (y === py && x >= px && x < px + 4 && x !== px + 2) col = "#3fae3f";
    }
    for (const rx of [4, 22, 31, 55, 71]) {
      const lean = y < 9 ? Math.round(Math.sin(ph + rx)) : 0;
      if (x === rx + lean && y >= 6 && y <= 12) col = y <= 7 ? "#7a4a2a" : "#6b7f3a";
    }
    return col;
  },
  // ทุ่งและชายฝั่ง: เมฆลอย ทุ่งหญ้าไหว ดอกไม้ และคลื่นซัดฝั่ง
  fields(x, y, f, ph) {
    let col = grade("#6fb6ff", "#cfeaff", y, 11);
    const u = wrap(x + f * 4, 32);
    if ((y === 2 && u >= 7 && u < 13) || (y === 3 && u >= 5 && u < 15)) col = "#ffffff";
    if (y === 4 && u >= 4 && u < 16) col = "#e6f0fa";
    if (y === 1 && u >= 22 && u < 27) col = "#f4f9ff";
    const hill = 10 - Math.round(2 * (0.5 + 0.5 * Math.sin((x / 40) * TAU + 1)));
    if (y >= hill) col = "#6aa943";
    if (y >= 11) col = y >= 14 ? "#6aa943" : "#7cbd4b";
    const blade = x - wrap(x + 1, 3) + 1; // โคนหญ้าอยู่ทุก 3 พิกเซล ปลายใบเอนซ้ายขวาตามลม
    if (y === 10 && blade + Math.round(Math.sin(ph + blade * 0.5)) === x) col = "#5f9a35";
    if (y >= 12 && y <= 14) {
      const k = (x * 7 + y * 13) % 31;
      if (k === 0) col = "#ffd83d";
      else if (k === 9) col = "#e2584a";
      else if (k === 17) col = "#ffffff";
    }
    const shore = 60 + Math.round(1.5 * Math.sin(ph));
    if (y >= 11 && x >= 55) {
      if (x < shore) col = "#f0e2a8";
      else if (x === shore) col = "#ffffff";
      else col = wrap(x - f + y * 2, 8) === 0 ? "#7fc4f2" : y >= 14 ? "#2f6fc4" : "#3f8fe0";
    }
    return col;
  },
  // ใต้พิภพ: หินย้อย หินงอก ผลึกอเมทิสต์เรืองแสงวูบวาบ แอ่งน้ำ
  underground(x, y, f, ph) {
    let col = y < 2 || y >= 14 ? "#2e2e33" : y % 5 === 2 ? "#45454b" : "#3b3b40";
    for (const cx of [6, 19, 33, 47, 58, 72]) {
      if (y < tri(x, cx, 2.5, 3 + (cx % 3))) col = x < cx ? "#857d76" : "#6b6560";
    }
    for (const cx of [12, 27, 41, 65]) {
      if (15 - y < tri(x, cx, 2.5, 3 + (cx % 2))) col = x < cx ? "#857d76" : "#6b6560";
    }
    if (y >= 14 && x >= 54 && x <= 70 && Math.abs(x - 65) > 2) col = wrap(x + f, 6) === 0 ? "#5f9fd0" : "#2f5f8f";
    for (const cx of [22, 52, 76]) {
      const t = 0.5 + 0.5 * Math.sin(ph + cx);
      const d = Math.hypot(x - cx, (y - 12) * 1.2);
      if (d < 4.5) col = mix(col, "#a77ce0", 0.3 * t * (1 - d / 4.5));
      for (const [dx, h] of [[-1, 3], [0, 5], [1, 2]]) {
        if (x === cx + dx && y <= 13 && y > 13 - h) col = mix(dx === 0 ? "#b98ae8" : "#8a5fc4", "#f0deff", 0.6 * t);
      }
    }
    if (y === 2 && x >= 38 && x <= 44 && x % 2 === 0) col = mix("#3f9a86", "#8ff0d0", 0.5 - 0.5 * Math.sin(ph));
    return col;
  },
  // ต่างมิติ: ฟ้าม่วงของ End เสาหินบะซอลต์ และทะเลลาวาของ Nether
  otherworld(x, y, f, ph) {
    let col = grade("#2a1030", "#5a1a1a", y, 11);
    if (y < 5 && (x * 17 + y * 29) % 61 === 0) col = (f + x) % 8 < 4 ? "#d9b8ff" : "#8a5fc4";
    for (const [x0, x1, top] of [[22, 25, 2], [36, 40, 5], [51, 54, 1], [66, 70, 4]]) {
      if (x >= x0 && x <= x1 && y >= top && y < 12) {
        col = y === top ? "#5c5059" : x === x0 ? "#4f434c" : "#3a3038";
        if (y >= 10) col = mix(col, "#ff6a1a", 0.3);
      }
    }
    if (y === 11) col = "#6f3535";
    if (y >= 12) {
      col = "#e8591a";
      if (y === 12 && wrap(x + f, 6) < 3) col = "#ffb23a";
      if (y === 14 && wrap(x - f + 3, 8) < 2) col = "#ffb23a";
      if ((x * 5 + y * 3) % 37 === 0) col = mix("#ffb23a", "#fff0a0", 0.5 + 0.5 * Math.sin(ph + x));
    }
    return col;
  },
  // ลึกลับ: หมอกม่วงไหลสวนทางกัน และดาวเคราะห์ที่ไม่มีใครรู้จัก
  mystery(x, y, f, ph) {
    let col = "#241d3d";
    const planet = Math.hypot(x - 62, y - 6);
    if (planet < 4.5) col = x - y < 54 ? "#7a68b0" : "#5a4a8a";
    if (Math.abs(y - 6 - (x - 62) * 0.25) < 0.6 && Math.abs(x - 62) < 8 && !(planet < 4.5 && y < 6)) col = "#b9a8e8";
    for (let b = 0; b < 3; b++) {
      const d = y - (3 + b * 4.5 + 1.4 * Math.sin(x / (6 + b * 2) + (b % 2 ? ph : -ph) + b));
      if (d >= -0.5 && d < 0.5) col = mix(col, "#8f7fd0", 0.55);
      else if (d >= 0.5 && d < 2.5) col = mix(col, "#5a4a8a", 0.45);
    }
    return col;
  },
  // เทศกาล: ฟ้ากลางคืน พลุแตกสามลูกคนละจังหวะ สายไฟประดับ และหมู่บ้าน
  festival(x, y, f, ph) {
    let col = grade("#0f1230", "#2a2f66", y, 12);
    if (y < 8 && (x * 11 + y * 23) % 47 === 0) col = "#c8d0ff";
    const colors = ["#ff7fb5", "#ffd83d", "#7ff2c8"];
    [[16, 5], [40, 4], [64, 6]].forEach(([cx, cy], i) => {
      const t = (f + i * 3) % 8;
      if (t > 5) return;
      const d = Math.hypot(x - cx, y - cy);
      const r = 1 + t * 0.8;
      const ang = Math.atan2(y - cy, x - cx);
      const spoke = Math.abs(Math.sin(ang * 4)) < 0.38;
      if (spoke && Math.abs(d - r) < 0.6) col = mix(col, colors[i], t > 3 ? 0.5 : 1);
      else if (spoke && t >= 2 && d < r - 0.6 && d > r - 2) col = mix(col, colors[i], 0.3);
      if (t === 0 && d < 1) col = "#ffffff";
    });
    if (y === 10 + Math.round(Math.sin((x / 20) * Math.PI) ** 2) && x % 4 === 1) col = (Math.floor(x / 4) + f) % 2 ? "#ffd83d" : "#ff7fb5";
    const roof = Math.max(tri(x, 12, 6, 4), tri(x, 34, 7, 3), tri(x, 56, 6, 4), tri(x, 74, 5, 3));
    if (y >= 13 - Math.round(roof)) col = "#0a0c1e";
    if (y >= 13) col = "#0a0c1e";
    if (y === 14 && (x === 10 || x === 14 || x === 33 || x === 55 || x === 58 || x === 74)) col = (x + f) % 8 < 6 ? "#ffd83d" : "#8a7420";
    return col;
  },
  // รางวัล: พื้นทอง รัศมีหมุน และแถบแสงกวาด
  reward(x, y, f, ph) {
    let col = y < 5 ? "#ffe680" : y < 11 ? "#f5c13a" : "#d99a1c";
    const ray = (Math.atan2(y - 8, (x - 18) * 0.5) / TAU) * 12 + (f / F) * 2; // หมุนครบ 2 แฉกต่อรอบ จึงวนต่อกันพอดี
    if (wrap(Math.floor(ray), 2) === 0) col = mix(col, "#fff6c8", 0.28);
    const sweep = wrap(x - y * 0.5 - f * 10, W);
    if (sweep < 3) col = mix(col, "#ffffff", 0.45);
    else if (sweep < 5) col = mix(col, "#ffffff", 0.2);
    if (y === 0 || y === H - 1) col = mix(col, "#8a5a0a", 0.35);
    return col;
  },
};

// ชั้นหน้า: อนุภาคบนพื้นโปร่ง ของที่ตกหรือลอยขยับ 2 พิกเซลต่อเฟรม จึงวนครบความสูง 16 พอดี
const fall = (i, f, seed, dir = 1) => wrap(Math.round(rnd(i, seed) * H) + dir * f * 2, H);
const drift = (i, ph, seed, amp = 2) => Math.round(wrap(rnd(i, seed) * W + amp * Math.sin(ph + i * 1.7), W));
function sparkle(c, x, y, color, big) {
  c.px(x, y, color);
  if (!big) return;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.px(x + dx, y + dy, alpha(color, 0.55));
}

const fg = {
  forests(c, f, ph) {
    for (let i = 0; i < 9; i++) {
      const x = drift(i, ph, 1);
      const y = fall(i, f, 2);
      const leaf = [["#b7d94f", "#7fae35"], ["#e08a2a", "#b5651d"], ["#d9c24a", "#a8902a"]][i % 3];
      c.px(x, y, leaf[0]);
      c.px(wrap(x + 1, W), wrap(y + 1, H), leaf[1]);
    }
  },
  cold(c, f, ph) {
    for (let i = 0; i < 16; i++) {
      const x = drift(i, ph, 3, 1.5);
      const y = fall(i, f, 4);
      c.px(x, y, i % 4 ? "#ffffff" : "#dff1ff");
      if (i % 5 === 0) c.px(wrap(x + 1, W), y, alpha("#ffffff", 0.6));
    }
  },
  dry(c, f, ph) {
    for (let i = 0; i < 12; i++) {
      const x = wrap(Math.round(rnd(i, 5) * W) + f * 10, W);
      const y = 2 + Math.round(rnd(i, 6) * 11 + Math.sin(ph + i));
      c.px(x, y, "#f7ecc0");
      c.px(wrap(x - 1, W), y, alpha("#f7ecc0", 0.6));
      c.px(wrap(x - 2, W), y, alpha("#f7ecc0", 0.3));
    }
  },
  wet(c, f, ph) {
    for (let i = 0; i < 9; i++) {
      const t = (f + i * 3) % 8;
      if (t >= 5) continue;
      const x = 3 + Math.round(rnd(i, 7) * (W - 8) + 2 * Math.sin(ph + i));
      const y = 2 + Math.round(rnd(i, 8) * 8 + 1.5 * Math.cos(ph + i * 2));
      sparkle(c, x, y, "#eaff7a", t === 2);
    }
  },
  fields(c, f, ph) {
    for (let i = 0; i < 3; i++) {
      const x = 22 + i * 22 + Math.round(4 * Math.sin(ph + i * 2));
      const y = 5 + i * 2 + Math.round(2 * Math.sin(ph * 2 + i));
      const wing = ["#ff9a2a", "#ffffff", "#6fa8ff"][i];
      const up = (f + i) % 2 === 0 ? 1 : 0;
      c.px(x, y, "#2a2a2a");
      c.px(x - 1, y - up, wing);
      c.px(x + 1, y - up, wing);
    }
    // ละอองเกสรลอยช้า ๆ วางเป็นคู่ห่างกันครึ่งความกว้าง จึงวนต่อกันพอดีแม้ขยับแค่ครึ่งจอต่อรอบ
    for (let i = 0; i < 7; i++) {
      for (const twin of [0, W / 2]) c.px(wrap(Math.round(rnd(i, 10) * W) + twin + f * 5, W), 2 + Math.round(rnd(i, 11) * 9), alpha("#fff6c0", 0.65));
    }
  },
  underground(c, f) {
    [6, 19, 33, 47, 58, 72].forEach((x, i) => {
      const y = wrap(4 + i * 3 + f * 2, H);
      if (y < 4) return;
      if (y >= 13) {
        c.px(x - 1, 13, alpha("#8fc4f2", 0.7));
        c.px(x + 1, 13, alpha("#8fc4f2", 0.7));
        return;
      }
      c.px(x, y, "#8fc4f2");
      c.px(x, y - 1, alpha("#8fc4f2", 0.45));
    });
  },
  otherworld(c, f, ph) {
    for (let i = 0; i < 11; i++) {
      const x = drift(i, ph, 14, 1.5);
      const y = fall(i, f, 15, -1);
      c.px(x, y, i % 4 === 3 ? "#c9a0ff" : i % 2 ? "#ffb23a" : "#ff6a1a");
    }
  },
  mystery(c, f) {
    for (let i = 0; i < 10; i++) {
      const t = (f + i * 3) % 8;
      if (t > 4) continue;
      sparkle(c, 3 + Math.round(rnd(i, 16) * (W - 7)), 2 + Math.round(rnd(i, 17) * 11), "#f0d04a", t === 2);
    }
  },
  festival(c, f, ph) {
    const colors = ["#ff7fb5", "#ffd83d", "#7ff2c8", "#6fa8ff", "#ffffff"];
    for (let i = 0; i < 14; i++) c.px(drift(i, ph, 20), fall(i, f, 21), colors[i % colors.length]);
  },
  reward(c, f) {
    for (let i = 0; i < 9; i++) {
      const t = (f + i * 3) % 8;
      if (t > 3) continue;
      sparkle(c, 3 + Math.round(rnd(i, 22) * (W - 7)), 2 + Math.round(rnd(i, 23) * 11), "#ffffff", t === 1 || t === 2);
    }
  },
};

for (const name of Object.keys(bg)) {
  anim(`toast_${name}_bg`, { w: W, h: H, frames: F, fps: 8 }, (c) => {
    const ph = c.phase * TAU;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) c.px(x, y, bg[name](x, y, c.frame, ph));
  });
  anim(`toast_${name}_fg`, { w: W, h: H, frames: F, fps: 8 }, (c) => fg[name](c, c.frame, c.phase * TAU));
}

// กรอบแบบปุ่มของเกม (164×36 วาดที่ขนาดจริง): ขอบเข้ม เงาบนซ้ายสว่าง เงาล่างขวาเข้ม ตรงกลางโปร่ง 160×32
sprite("toast_frame", { w: 164, h: 36 }, (c) => {
  c.box(0, 0, 164, 36, "#1e1e1f");
  c.hline(1, 1, 162, alpha("#ffffff", 0.5));
  c.vline(1, 2, 32, alpha("#ffffff", 0.3));
  c.hline(1, 34, 162, alpha("#000000", 0.5));
  c.vline(162, 2, 32, alpha("#000000", 0.3));
});
// เงาใต้ภาพและชื่อ: ทึบทางซ้าย จางไปทางขวา ให้ตัวหนังสืออ่านง่ายโดยไม่บังฉาก
sprite("toast_shade", { w: W, h: H }, (c) => {
  for (let x = 0; x < 58; x++) {
    const a = Math.round(Math.min(1, (58 - x) / 38) * 6) / 6;
    for (let y = 0; y < H; y++) c.px(x, y, alpha("#000000", 0.5 * a));
  }
});
// แสงกวาดเฉียงตอนการ์ดเลื่อนเข้า
sprite("toast_shine", { w: 12, h: H }, (c) => {
  for (let y = 0; y < H; y++) {
    const x = Math.floor((H - 1 - y) / 2);
    c.px(x, y, alpha("#ffffff", 0.2));
    c.hline(x + 1, y, 2, alpha("#ffffff", 0.45));
    c.px(x + 3, y, alpha("#ffffff", 0.2));
  }
});
// ป้ายมุมขวาบน: ขอบเข้ม 1 พิกเซล เนื้อสีทองสองโทน (ยืดตามความยาวข้อความในเกม)
sprite("toast_banner_edge", { w: 1, h: 1 }, (c) => c.px(0, 0, "#1e1e1f"));
sprite("toast_banner_fill", { w: 1, h: 2 }, (c) => {
  c.px(0, 0, "#ffe066");
  c.px(0, 1, "#f2b62a");
});
