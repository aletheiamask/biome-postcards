#!/usr/bin/env node
// เซิร์ฟเวอร์ทดสอบ (Bedrock Dedicated Server ใน .dev/bds) เปิดเฉพาะเฟส 1 และเฟส 8
// ใช้: node tools/bds.mjs setup [--world=ชื่อ] [--testpack | --testpack=gametest] [--exp=a,b] [--fresh]
//      node tools/bds.mjs run [--wait=วินาที] [--raw] "คำสั่ง" "คำสั่ง@หน่วงวินาที" ...
//      node tools/bds.mjs export [--world=ชื่อ] [--name="ชื่อที่แสดง"] [--embed] [ชื่อไฟล์]   → dist/<ชื่อไฟล์>.mcworld (--embed = ใส่แพ็กไว้ในโลก)
//      node tools/bds.mjs showcase   → สร้างโลกตัวอย่างสำหรับตรวจด้วยตา แล้วส่งออกเป็น dist/BiomePostcards-Showcase.mcworld (มีแพ็กอยู่ในโลก)
//      node tools/bds.mjs stage --world=ชื่อ   → สร้างเวทีของโลกตัวอย่างในโลกนั้น (ใช้กับ tools/look.mjs)
// setup --look = โลกสำหรับให้ client จริงเข้ามาตรวจ (creative, ส่ง RP ให้ client, testpack=look ใช้ server-ui ได้)
// run พิมพ์เฉพาะบรรทัดที่เกี่ยวกับแอดออน log เต็มอยู่ที่ .dev/bds-last.log
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import * as T from "../content/cards.js";
import { PACK } from "../content/pack.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BDS = join(ROOT, ".dev", "bds");
const [cmd, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")).map(([k, v]) => [k, v ?? true]));
const positional = rest.filter((a) => !a.startsWith("--"));
const flags0 = (k) => flags[k];
const WORLD = String(flags0("world") ?? (cmd === "showcase" ? "bpc-showcase" : "bpc-test"));
const WORLD_DIR = join(BDS, "worlds", WORLD);
const TEST_UUID = "5d6f0b0e-2a44-4c3e-9d2b-7f1e5b1c0a11";
const BETA_SERVER = "2.12.0-beta"; // รุ่น beta ของ @minecraft/server ที่ตรงกับ BDS 1.26.63
const TEST_MODULE_UUID = "0c1b6c2e-7a55-4a39-8c0f-3d2e9a4b6f22";

if (!existsSync(join(BDS, "bedrock_server.exe"))) {
  console.error("ไม่พบ .dev/bds/bedrock_server.exe (ดาวน์โหลด Bedrock Dedicated Server สำหรับ Windows จาก https://www.minecraft.net/en-us/download/server/bedrock แล้วแตกไฟล์ลง .dev/bds)");
  process.exit(1);
}

// ---------- level.dat (NBT little-endian) เปิด experiment ----------
function readTag(buf, off) {
  const type = buf.readUInt8(off++);
  if (type === 0) return { type, end: off };
  const nl = buf.readUInt16LE(off);
  const name = buf.toString("utf8", off + 2, off + 2 + nl);
  const [value, end] = readPayload(buf, off + 2 + nl, type);
  return { type, name, value, end };
}
function readPayload(buf, off, type) {
  const raw = (n) => [buf.subarray(off, off + n), off + n];
  switch (type) {
    case 1: return raw(1);
    case 2: return raw(2);
    case 3: case 5: return raw(4);
    case 4: case 6: return raw(8);
    case 7: return raw(4 + buf.readInt32LE(off));
    case 8: return raw(2 + buf.readUInt16LE(off));
    case 11: return raw(4 + buf.readInt32LE(off) * 4);
    case 12: return raw(4 + buf.readInt32LE(off) * 8);
    case 9: {
      const et = buf.readUInt8(off);
      const n = buf.readInt32LE(off + 1);
      off += 5;
      const items = [];
      for (let i = 0; i < n; i++) {
        const [v, e] = readPayload(buf, off, et);
        items.push(v);
        off = e;
      }
      return [{ et, items }, off];
    }
    case 10: {
      const entries = [];
      for (;;) {
        const t = readTag(buf, off);
        off = t.end;
        if (t.type === 0) break;
        entries.push(t);
      }
      return [entries, off];
    }
    default: throw new Error(`NBT type ${type} ไม่รองรับ`);
  }
}
function writePayload(type, value) {
  if (type === 9) {
    const head = Buffer.alloc(5);
    head.writeUInt8(value.et, 0);
    head.writeInt32LE(value.items.length, 1);
    return Buffer.concat([head, ...value.items.map((v) => writePayload(value.et, v))]);
  }
  if (type === 10) return Buffer.concat([...value.map(writeTag), Buffer.from([0])]);
  return value;
}
function writeTag(t) {
  const name = Buffer.from(t.name, "utf8");
  const head = Buffer.alloc(3);
  head.writeUInt8(t.type, 0);
  head.writeUInt16LE(name.length, 1);
  return Buffer.concat([head, name, writePayload(t.type, t.value)]);
}
function editLevelDat(edit) {
  const file = join(WORLD_DIR, "level.dat");
  const buf = readFileSync(file);
  const root = readTag(buf, 8);
  edit(root);
  const body = writeTag(root);
  const head = Buffer.alloc(8);
  buf.copy(head, 0, 0, 4);
  head.writeInt32LE(body.length, 4);
  writeFileSync(file, Buffer.concat([head, body]));
}
const nbtString = (text) => {
  const b = Buffer.from(text, "utf8");
  const len = Buffer.alloc(2);
  len.writeUInt16LE(b.length, 0);
  return Buffer.concat([len, b]);
};
function enableExperiments(names) {
  editLevelDat((root) => {
  let exp = root.value.find((t) => t.name === "experiments");
  if (!exp) root.value.push((exp = { type: 10, name: "experiments", value: [] }));
  for (const n of [...names, "experiments_ever_used", "saved_with_toggled_experiments"]) {
    const cur = exp.value.find((t) => t.name === n);
    if (cur) cur.value = Buffer.from([1]);
    else exp.value.push({ type: 1, name: n, value: Buffer.from([1]) });
  }
  });
}
// โลกสำหรับตรวจด้วยตา: โหมดสร้างสรรค์ + เปิดคำสั่ง
function creativeTags(root) {
  const int = (v) => {
    const b = Buffer.alloc(4);
    b.writeInt32LE(v, 0);
    return b;
  };
  const mode = root.value.find((t) => t.name === "GameType");
  if (mode) mode.value = int(1);
  const cheats = root.value.find((t) => t.name === "commandsEnabled");
  if (cheats) cheats.value = Buffer.from([1]);
}
// ส่งออกโลกเป็น .mcworld ให้เปิดในเกมจริง (แพ็กอยู่ใน development packs ไม่ฝังในโลก)
function exportWorld(displayName, outFile, stamp) {
  editLevelDat((root) => {
    const name = root.value.find((t) => t.name === "LevelName");
    if (name) name.value = nbtString(displayName);
    if (flags.creative) creativeTags(root);
  });
  writeFileSync(join(WORLD_DIR, "levelname.txt"), displayName);
  const files = {};
  const walk = (dir, prefix) => {
    for (const n of readdirSync(dir)) {
      const f = join(dir, n);
      if (statSync(f).isDirectory()) walk(f, `${prefix}${n}/`);
      else if (n !== "LOCK") files[`${prefix}${n}`] = new Uint8Array(readFileSync(f));
    }
  };
  walk(WORLD_DIR, "");
  // --embed: ใส่แพ็กไว้ในโลกด้วย ผู้ตรวจจึงเปิดโลกได้เลยโดยไม่ต้องติดตั้งหรือเปลี่ยนแพ็กในเครื่อง
  if (flags.embed) {
    walk(join(ROOT, "BP"), "behavior_packs/BiomePostcards_BP/");
    walk(join(ROOT, "RP"), "resource_packs/BiomePostcards_RP/");
  }
  // stamp: เลขท้ายเวอร์ชันของแพ็กในโลก เกมจำแพ็กตาม uuid + เวอร์ชัน ถ้าทุก build เป็น 0.10.0 เหมือนกัน
  // เกมจะใช้ชุดที่โหลดไว้ก่อน (จากโลกที่นำเข้ารอบก่อน) แทนชุดใหม่ในโลกนี้
  if (stamp) {
    const ours = new Set([PACK.uuids.bp, PACK.uuids.rp]);
    const same = (v) => Array.isArray(v) && v.join(".") === PACK.version.join(".");
    const fix = (o) => {
      if (Array.isArray(o)) return o.forEach(fix);
      if (!o || typeof o !== "object") return;
      if (ours.has(o.uuid ?? o.pack_id) && same(o.version)) o.version = [PACK.version[0], PACK.version[1], stamp];
      Object.values(o).forEach(fix);
    };
    for (const name of ["world_behavior_packs.json", "world_resource_packs.json", "behavior_packs/BiomePostcards_BP/manifest.json", "resource_packs/BiomePostcards_RP/manifest.json"]) {
      if (!files[name]) continue;
      const json = JSON.parse(Buffer.from(files[name]).toString("utf8"));
      fix(json);
      files[name] = new Uint8Array(Buffer.from(JSON.stringify(json, null, 2)));
    }
  }
  const zip = zipSync(files, { level: 6 });
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, zip);
  return zip.length;
}

// ---------- ติดตั้ง ----------
function setProps(pairs) {
  const file = join(BDS, "server.properties");
  let text = readFileSync(file, "utf8");
  for (const [k, v] of Object.entries(pairs)) {
    const re = new RegExp(`^#?${k}=.*$`, "m");
    text = re.test(text) ? text.replace(re, `${k}=${v}`) : `${text}\n${k}=${v}\n`;
  }
  writeFileSync(file, text);
}
function installPacks(testpack) {
  const bp = join(BDS, "development_behavior_packs");
  const rp = join(BDS, "development_resource_packs");
  for (const d of [join(bp, "BiomePostcards_BP"), join(rp, "BiomePostcards_RP"), join(bp, "bpc_testpack")]) rmSync(d, { recursive: true, force: true });
  cpSync(join(ROOT, "BP"), join(bp, "BiomePostcards_BP"), { recursive: true });
  cpSync(join(ROOT, "RP"), join(rp, "BiomePostcards_RP"), { recursive: true });
  const packs = [{ pack_id: PACK.uuids.bp, version: PACK.version }];
  if (testpack) {
    // แพ็กทดสอบ: testpack=gametest ใช้ Beta API (ผู้เล่นจำลอง), testpack=look ใช้ server-ui กับผู้เล่นจริง นอกนั้นใช้ API stable
    const gametest = testpack === "gametest";
    const look = testpack === "look";
    const dir = join(bp, "bpc_testpack");
    cpSync(join(ROOT, "testpack"), dir, { recursive: true });
    writeFileSync(join(dir, "scripts", "flags.js"), `export const GAMETEST = ${gametest};
export const LOOK = ${look};
`);
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({
      format_version: 2,
      header: { name: "BPC Testpack", description: "dev only", uuid: TEST_UUID, version: [1, 0, 0], min_engine_version: PACK.minEngine },
      modules: [{ type: "script", language: "javascript", uuid: TEST_MODULE_UUID, entry: "scripts/main.js", version: [1, 0, 0] }],
      dependencies: gametest
        ? [{ module_name: "@minecraft/server", version: BETA_SERVER }, { module_name: "@minecraft/server-gametest", version: "1.0.0-beta" }]
        : Object.entries(PACK.modules).filter(([name]) => look || name === "@minecraft/server").map(([module_name, version]) => ({ module_name, version })),
    }, null, 2));
    packs.push({ pack_id: TEST_UUID, version: [1, 0, 0] });
  }
  mkdirSync(WORLD_DIR, { recursive: true });
  writeFileSync(join(WORLD_DIR, "world_behavior_packs.json"), JSON.stringify(packs, null, 2));
  writeFileSync(join(WORLD_DIR, "world_resource_packs.json"), JSON.stringify([{ pack_id: PACK.uuids.rp, version: PACK.version }], null, 2));
}

// ---------- รันเซิร์ฟเวอร์ ----------
const NOISE = /AutoCompaction|^ *$|NO LOG FILE|Session ID|Build ID|Branch:|Commit ID|Configuration:|IPv[46] supported|Level Name|Game mode|Difficulty|Version:|Opening level|Pack Stack|Server started|Quit correctly|Stopping server|Starting Server|=====|#####|VANILLA WORLD|Content logging|Contents of server.properties|Profiler config|CDN config|Accepting clients|signaling service|Allow list|allowlist|allow list|TELEMETRY|Telemetry|telemetry|To enable this feature|to the server.properties|Server stop requested|debugger|Network port|(INFO|WARN|ERROR)] *$/;
function runServer(commands, { wait = 3, raw = false } = {}) {
  return new Promise((resolve) => {
    const proc = spawn(join(BDS, "bedrock_server.exe"), [], { cwd: BDS, stdio: ["pipe", "pipe", "pipe"] });
    const lines = [];
    let pending = "";
    let started = false;
    let cmdStart = -1;
    const limit = Number(flags.timeout ?? 180);
    const timeout = setTimeout(() => {
      lines.push(`[bds.mjs] ERROR หมดเวลา ${limit} วินาที บังคับปิด`);
      proc.kill();
    }, limit * 1000);
    // รอจนมีบรรทัดใหม่ที่มีข้อความนี้ (ไม่เกิน 150 วินาที)
    const waitFor = async (text, from) => {
      for (let i = 0; i < 750; i++) {
        if (lines.slice(from).some((l) => l.includes(text))) return;
        await new Promise((r) => setTimeout(r, 200));
      }
      lines.push(`[bds.mjs] ERROR รอ "${text}" ไม่สำเร็จ`);
    };
    const feed = async () => {
      cmdStart = lines.length;
      for (const c of commands) {
        // "คำสั่ง@3" = หน่วง 3 วินาที, "คำสั่ง@~ข้อความ" = รอจนคอนโซลมีข้อความนั้น
        const at = c.lastIndexOf("@");
        const tail = at > 0 ? c.slice(at + 1) : "";
        const timed = tail !== "" && !Number.isNaN(Number(tail));
        const awaited = tail.startsWith("~");
        const text = timed || awaited ? c.slice(0, at) : c;
        const from = lines.length;
        lines.push(`> ${text}`);
        proc.stdin.write(`${text}\n`);
        if (awaited) await waitFor(tail.slice(1), from);
        else await new Promise((r) => setTimeout(r, 1000 * (timed ? Number(tail) : 1)));
      }
      await new Promise((r) => setTimeout(r, 1000 * wait));
      proc.stdin.write("stop\n");
    };
    const onData = (chunk) => {
      pending += chunk.toString("utf8");
      const parts = pending.split(/\r?\n/);
      pending = parts.pop();
      for (const line of parts) {
        lines.push(line);
        if (!started && /Server started/.test(line)) {
          started = true;
          feed();
        }
      }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("close", (code) => {
      clearTimeout(timeout);
      writeFileSync(join(ROOT, ".dev", "bds-last.log"), lines.join("\n"));
      const shown = raw ? lines : lines.filter((l, i) => {
        if (NOISE.test(l)) return false;
        if (/\b(ERROR|WARN)\b|bpc|\[Scripting\]/i.test(l)) return true;
        return cmdStart >= 0 && i >= cmdStart;
      });
      const bad = lines.filter((l) => !NOISE.test(l) && /\b(ERROR|WARN)\b/.test(l)).length;
      resolve({ code, started, shown, bad });
    });
  });
}

async function setupWorld() {
  setProps({
    "level-name": WORLD,
    "level-seed": "20261110",
    gamemode: "survival",
    difficulty: "peaceful",
    "allow-cheats": "true",
    "online-mode": "true",
    "server-port": "19140",
    "server-portv6": "19141",
    "enable-lan-visibility": "false",
    "content-log-file-enabled": "true",
    "content-log-console-output-enabled": "true",
    // โลก look: client จริงต้องได้ RP จากเซิร์ฟเวอร์ และเข้าได้เฉพาะคนที่อยู่ใน allowlist
    "texturepack-required": flags.look ? "true" : "false",
    "allow-list": "true",
    ...(flags.look ? { gamemode: "creative", "default-player-permission-level": "operator" } : { "default-player-permission-level": "member" }),
  });
  if (flags.fresh) rmSync(WORLD_DIR, { recursive: true, force: true });
  installPacks(flags.testpack);
  if (flags.testpack === "gametest") flags.exp = [flags.exp, "gametest"].filter(Boolean).join(",");
  let note = "";
  if (!existsSync(join(WORLD_DIR, "level.dat"))) {
    const r = await runServer([], { wait: 1 });
    note = r.started ? " · สร้างโลกใหม่แล้ว" : " · สร้างโลกไม่สำเร็จ (ดู .dev/bds-last.log)";
  }
  if (flags.exp) {
    enableExperiments(String(flags.exp).split(","));
    note += ` · เปิด experiment ${flags.exp}`;
  }
  if (flags.look) editLevelDat(creativeTags);
  return note;
}

// โลกตัวอย่างสำหรับตรวจด้วยตาในเกมจริง: บอร์ด 4 ทิศบนเสากลาง, กำแพงที่แขวนการ์ดครบทุกใบ, ของตกแต่ง, แผงขาย และหีบของทดสอบ
function showcaseCommands() {
  const board = (x, y, z, index, foil, facing) =>
    `setblock ${x} ${y} ${z} bpc:pin_board ["bpc:page"=${index >> 4},"bpc:slot"=${index & 15},"bpc:foil"=${foil},"minecraft:cardinal_direction"="${facing}"]`;
  const cards = [...T.CARDS, ...T.BONUS_CARDS];
  const trinkets = [...T.SETS.map((s) => s.reward), T.GRAND_REWARD.id, ...T.SOUVENIRS.map((s) => s.id)];
  const chest = ["bpc:album 1", "bpc:blank_postcard 16", "bpc:pin_board 8", "minecraft:frame 8", "minecraft:emerald 64", "bpc:souvenir_stand 2",
    "bpc:postcard_plains 1", "bpc:postcard_cherry_grove_foil 1", "bpc:postcard_mystery 1", "bpc:postcard_fest_songkran 1", "bpc:postcard_deep_dark 1", "bpc:postcard_sulfur_caves 1"];
  const list = [
    "fill -8 150 -8 8 150 10 smooth_stone",
    "fill -1 151 -1 1 153 1 quartz_block",
    board(0, 152, -2, 1, false, "north"),
    board(1, 152, -2, 6, true, "north"),
    board(-1, 152, -2, 0, false, "north"),
    board(0, 152, 2, 27, false, "south"),
    board(-2, 152, 0, 30, false, "west"),
    board(2, 152, 0, 31, false, "east"),
    "fill -6 151 9 6 153 9 quartz_block",
    ...cards.map((c, i) => board(-6 + (i % 13), 153 - Math.floor(i / 13), 8, c.board, false, "north")),
    // ของตกแต่งหันหน้าเข้าหาลาน (ทิศตะวันออก)
    ...trinkets.map((id, i) => `setblock -7 151 ${-5 + i} bpc:${id} ["minecraft:cardinal_direction"="east"]`),
    "setblock 6 151 -4 bpc:souvenir_stand",
    "setblock 6 151 -2 chest",
    ...chest.map((item, i) => `replaceitem block 6 151 -2 slot.container ${i} ${item}`),
    "setworldspawn 0 151 -5",
    "gamerule dodaylightcycle false",
    "gamerule doweathercycle false",
    "gamerule domobspawning false",
    "time set 6000",
  ];
  return ["tickingarea add circle 0 150 0 3 show@6", ...list.map((c) => `${c}@0.25`), "testforblock 0 152 -2 bpc:pin_board", "testforblock 4 151 8 bpc:pin_board"];
}

if (cmd === "setup") {
  const note = await setupWorld();
  console.log(`setup ok: ติดตั้งแพ็ก${flags.testpack ? " + testpack" : ""}${note}`);
} else if (cmd === "showcase") {
  flags.fresh = true;
  flags.creative = true;
  flags.embed = true;
  await setupWorld();
  const r = await runServer(showcaseCommands(), { wait: 4 });
  const found = r.shown.filter((l) => l.includes("Successfully found the block")).length;
  const out = join(ROOT, "dist", "BiomePostcards-Showcase.mcworld");
  // ชื่อโลกมีเวลา build ต่อท้าย ผู้ตรวจจะได้แยกโลกที่นำเข้าใหม่ออกจากโลกรุ่นเดียวกันที่นำเข้าไปก่อนแล้ว
  const now = new Date();
  const two = (n) => String(n).padStart(2, "0");
  const built = `${two(now.getMonth() + 1)}${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}`;
  const stamp = Number(built.replace("-", "")); // MMDDHHMM
  const size = exportWorld(`Biome Postcards Showcase ${PACK.version.join(".")} (build ${built})`, out, stamp);
  console.log(`showcase ${found === 2 && r.bad === 0 ? "ok" : "มีปัญหา (ดู .dev/bds-last.log)"}: ${out} ${(size / 1024).toFixed(0)} KB · บรรทัด WARN/ERROR ${r.bad}`);
} else if (cmd === "stage") {
  const r = await runServer(showcaseCommands(), { wait: 4 });
  const found = r.shown.filter((l) => l.includes("Successfully found the block")).length;
  console.log(`stage ${found === 2 && r.bad === 0 ? "ok" : "มีปัญหา (ดู .dev/bds-last.log)"}: โลก ${WORLD} · บรรทัด WARN/ERROR ${r.bad}`);
  process.exitCode = found === 2 ? 0 : 1;
} else if (cmd === "run") {
  const r = await runServer(positional, { wait: Number(flags.wait ?? 3), raw: Boolean(flags.raw) });
  if (r.shown.length) console.log(r.shown.join("\n"));
  console.log(`run ${r.started ? "ok" : "ล้ม (เซิร์ฟเวอร์ไม่ขึ้น)"}: exit ${r.code} · บรรทัด WARN/ERROR ${r.bad}`);
  process.exitCode = r.started ? 0 : 1;
} else if (cmd === "export") {
  const out = join(ROOT, "dist", `${positional[0] ?? WORLD}.mcworld`);
  const size = exportWorld(String(flags.name ?? WORLD), out);
  console.log(`export ok: ${out} ${(size / 1024).toFixed(0)} KB`);
} else {
  console.error("ใช้: bds.mjs setup|run|export|showcase|stage (ดูหัวไฟล์)");
  process.exit(1);
}
