// ตรวจโมเดล 3 มิติจากสเปก: หน้าซ้อนระนาบเดียวกัน (FIGHT), หน้าที่ขาดแต่มองเห็น (HOLE), หน้าที่มีพิกเซลโปร่ง (ALPHA), uv หลุดขอบ (UV)
// ใช้: node tools/check-models.mjs [id] [--inner]  (รันจากรากโปรเจกต์ · ALPHA ของแก้ว/ใบบัว/ม่านประตู/ชายผ้าใบเป็นความตั้งใจ)
import { pathToFileURL } from "node:url";
const root = process.cwd();
const { MODELS } = await import(pathToFileURL(root + "/art/models.mjs"));
const { FACES } = await import(pathToFileURL(root + "/tools/models.mjs"));
const only = process.argv.slice(2).find((a) => !a.startsWith("--"));

const N = { north: [2, -1], south: [2, 1], west: [0, -1], east: [0, 1], down: [1, -1], up: [1, 1] };
const STEP = 0.25, EPS = 0.01;
for (const m of MODELS) {
  if (only && m.id !== only) continue;
  const { canvas, faces } = m.layout();
  const [W, H] = m.tex;
  const cubes = m.cubes.map((c, i) => ({ ...c, i, to: c.from.map((v, k) => v + c.size[k]) }));
  const inside = (p, skip) => cubes.some((c) => c.i !== skip && !c.opts.rot && [0, 1, 2].every((k) => p[k] > c.from[k] - 1e-9 && p[k] < c.to[k] + 1e-9) && [0, 1, 2].every((k) => p[k] > c.from[k] + 1e-6 && p[k] < c.to[k] - 1e-6));
  const out = [];
  // พิกัดจุดบนหน้า
  const facePts = (c, face) => {
    const [ax, dir] = N[face];
    const other = [0, 1, 2].filter((k) => k !== ax);
    const plane = dir > 0 ? c.to[ax] : c.from[ax];
    const pts = [];
    for (let a = c.from[other[0]] + STEP / 2; a < c.to[other[0]]; a += STEP)
      for (let b = c.from[other[1]] + STEP / 2; b < c.to[other[1]]; b += STEP) {
        const p = [0, 0, 0];
        p[ax] = plane + dir * EPS;
        p[other[0]] = a;
        p[other[1]] = b;
        pts.push(p);
      }
    return { ax, dir, plane, other, pts };
  };
  for (const c of cubes) {
    if (c.opts.rot) continue;
    for (const face of FACES) {
      const has = !!faces[c.i][face];
      const { ax, dir, plane, other, pts } = facePts(c, face);
      const exposed = pts.filter((p) => !inside(p, c.i)).length / pts.length;
      if (!has && exposed > 0.001 && !(face === "down" && plane === 0)) out.push(`HOLE  ${c.name}.${face} ขาดหน้า แต่โผล่ ${(exposed * 100).toFixed(0)}%`);
      if (has && exposed > 0) {
        // z-fight: หน้าทิศเดียวกันระนาบเดียวกันของกล่องอื่นทับซ้อน
        for (const d of cubes) {
          if (d.i <= c.i || d.opts.rot || !faces[d.i][face]) continue;
          const dp = dir > 0 ? d.to[ax] : d.from[ax];
          if (Math.abs(dp - plane) > 1e-6) continue;
          const ov = other.map((k) => Math.min(c.to[k], d.to[k]) - Math.max(c.from[k], d.from[k]));
          if (ov[0] > 1e-6 && ov[1] > 1e-6) out.push(`FIGHT ${c.name}.${face} ทับ ${d.name}.${face} ${ov[0]}×${ov[1]}`);
        }
        // เท็กซ์เจอร์โปร่ง
        const r = faces[c.i][face];
        if (c.opts.mi && (typeof c.opts.mi === "string" || c.opts.mi[face])) continue;
        const [u, v, w, h] = r;
        if (u < 0 || v < 0 || u + w > W || v + h > H) out.push(`UV    ${c.name}.${face} หลุดขอบ ${r}`);
        let clear = 0;
        for (let y = v; y < v + h; y++) for (let x = u; x < u + w; x++) if (canvas.get(x, y)[3] === 0) clear++;
        if (clear) out.push(`ALPHA ${c.name}.${face} โปร่ง ${clear}/${w * h} px (โผล่ ${(exposed * 100).toFixed(0)}%)`);
      }
      if (has && exposed === 0) out.push(`INNER ${c.name}.${face} มองไม่เห็น (เปลือง)`);
    }
  }
  console.log(`\n== ${m.id} (${cubes.length} กล่อง)`);
  for (const l of out) if (process.argv.includes("--inner") || !l.startsWith("INNER")) console.log("  " + l);
}
