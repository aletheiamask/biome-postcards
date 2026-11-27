#!/usr/bin/env node
// คัดลอก BP/RP ไปโฟลเดอร์ development packs ของ Minecraft ในเครื่องนี้ (ไม่แตะโลกของผู้เล่น)
// ใช้: node tools/deploy.mjs [--force] [--check]   (--check = ตรวจด่านอย่างเดียว ไม่คัดลอกอะไร)
//
// ด่านกันเกมค้าง: ภาษาไทยของแอดออนมีอยู่ในแพ็กนี้เท่านั้น และใช้ได้เมื่อแพ็กอยู่ใน Global Resources
// ถ้าเกมเลือกภาษาไทยอยู่ แล้วแพ็กรุ่นที่ Global Resources อ้างถึงถูกแทนด้วยรุ่นอื่น เกมอาจหาภาษาไม่เจอและค้างตอนโหลด
// สคริปต์จึงหยุดก่อน ให้สลับภาษาในเกมเป็น English แล้วรันใหม่ (--force = ข้ามด่านนี้)
import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PACK } from "../content/pack.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const USERS = join(process.env.APPDATA ?? "", "Minecraft Bedrock", "Users");
const COM = join(USERS, "Shared", "games", "com.mojang");
const force = process.argv.includes("--force");
const checkOnly = process.argv.includes("--check");
if (!existsSync(COM)) {
  console.error(`ไม่พบโฟลเดอร์ของเกม: ${COM}`);
  process.exit(1);
}

/** ผู้ใช้ในเครื่องที่เลือกภาษาไทยและเปิดแพ็กนี้ใน Global Resources ด้วยรุ่นที่ต่างจากรุ่นที่กำลังจะ deploy */
function thaiFromOtherVersion() {
  const version = PACK.version.join(".");
  const hits = [];
  for (const user of readdirSync(USERS)) {
    const dir = join(USERS, user, "games", "com.mojang", "minecraftpe");
    const options = join(dir, "options.txt");
    const packs = join(dir, "global_resource_packs.json");
    if (!existsSync(options) || !existsSync(packs)) continue;
    if (!/^game_language:th_TH\s*$/m.test(readFileSync(options, "utf8"))) continue;
    let list = [];
    try {
      list = JSON.parse(readFileSync(packs, "utf8"));
    } catch {
      continue; // ไฟล์ของเกมอ่านไม่ได้: ไม่มีข้อมูลพอจะหยุด
    }
    const mine = Array.isArray(list) ? list.find((p) => p?.pack_id === PACK.uuids.rp) : undefined;
    if (mine && (mine.version ?? []).join(".") !== version) hits.push((mine.version ?? []).join("."));
  }
  return hits;
}

const blocked = force ? [] : thaiFromOtherVersion();
if (blocked.length) {
  console.error(
    [
      `deploy หยุด: เกมเลือกภาษาไทยอยู่ และ Global Resources ใช้แพ็กนี้รุ่น ${blocked.join(", ")} (กำลังจะวางรุ่น ${PACK.version.join(".")})`,
      "ภาษาไทยมาจากแพ็กนี้เท่านั้น ถ้าเปลี่ยนรุ่นขณะเลือกภาษาไทยอยู่ เกมอาจค้างตอนโหลด",
      "ทำตามนี้: 1) ในเกม Settings → Language → English  2) รัน npm run deploy อีกครั้ง",
      "          3) Settings → Global Resources เปิดแพ็กรุ่นใหม่  4) เลือกภาษาไทยกลับ",
      "ข้ามด่านนี้: node tools/deploy.mjs --force",
    ].join("\n"),
  );
  process.exit(1);
}

if (checkOnly) {
  console.log("deploy check ok: วางแพ็กได้");
  process.exit(0);
}
for (const [src, dir, name] of [["BP", "development_behavior_packs", "BiomePostcards_BP"], ["RP", "development_resource_packs", "BiomePostcards_RP"]]) {
  const dst = join(COM, dir, name);
  rmSync(dst, { recursive: true, force: true });
  cpSync(join(ROOT, src), dst, { recursive: true });
}
console.log(`deploy ok: ${COM}`);
