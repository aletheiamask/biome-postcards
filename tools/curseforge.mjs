// อัปโหลด dist/BiomePostcards-<ver>.mcaddon ขึ้นโปรเจกต์ CurseForge (Minecraft Bedrock) ที่สร้างบนเว็บไว้แล้ว
// ใช้: $env:CF_TOKEN="<token>"; node tools/curseforge.mjs <projectId> [--dry]
// token สร้างที่ https://authors.curseforge.com/#/api-tokens  ห้ามเขียน token ลงไฟล์ใดใน repo
// Upload API: https://support.curseforge.com/support/solutions/articles/9000197321-curseforge-upload-api
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PACK } from "../content/pack.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://minecraft-bedrock.curseforge.com";
const [projectId] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = process.argv.includes("--dry");
const token = process.env.CF_TOKEN;
if (!token || !/^\d+$/.test(projectId ?? "")) {
  console.error("ใช้: CF_TOKEN=<token> node tools/curseforge.mjs <projectId> [--dry]");
  process.exit(1);
}
const VER = PACK.version.join(".");
const name = `BiomePostcards-${VER}.mcaddon`;
// เวอร์ชันเกมที่ติ๊ก: ตั้งแต่ minEngine ขึ้นไป (ชื่อในระบบ CurseForge เป็น 26.50, 26.60 …)
const [, minMajor, minMinor] = PACK.minEngine; // [1, 26, 50] → 26.50

const res = await fetch(`${BASE}/api/game/versions`, { headers: { "X-Api-Token": token } });
if (!res.ok) throw new Error(`game/versions ${res.status}`);
const versions = (await res.json()).filter((v) => {
  const m = /^(\d+)\.(\d+)$/.exec(v.name);
  return m && (+m[1] > minMajor || (+m[1] === minMajor && +m[2] >= minMinor));
});
if (!versions.length) throw new Error("ไม่พบเวอร์ชันเกมที่ตรงกับ minEngine");

const changelog = /```markdown\n([\s\S]*?)```/.exec(readFileSync(join(ROOT, "docs/release/listing.md"), "utf8").split("## Changelog")[1] ?? "")?.[1];
if (!changelog) throw new Error("ไม่พบ changelog ใน docs/release/listing.md");
const metadata = { changelog, changelogType: "markdown", displayName: `Biome Postcards ${VER}`, gameVersions: versions.map((v) => v.id), releaseType: "release" };
console.log(`โปรเจกต์ ${projectId} · ${name} · เกม ${versions.map((v) => v.name).join(", ")}`);
if (dry) {
  console.log(JSON.stringify(metadata, null, 2));
  process.exit(0);
}
const form = new FormData();
form.append("metadata", JSON.stringify(metadata));
form.append("file", new Blob([readFileSync(join(ROOT, "dist", name))]), name);
const up = await fetch(`${BASE}/api/projects/${projectId}/upload-file`, { method: "POST", headers: { "X-Api-Token": token }, body: form });
const body = await up.text();
if (!up.ok) throw new Error(`upload ${up.status}: ${body}`);
console.log(`อัปโหลดแล้ว file id ${JSON.parse(body).id} (รอ CurseForge ตรวจ ปกติไม่กี่วัน)`);
