#!/usr/bin/env node
// วงจรตรวจด้วยตา: เปิดเซิร์ฟเวอร์ทดสอบค้างไว้ ให้ Minecraft บนเครื่องนี้เชื่อมต่อ
// แล้วส่งคำสั่งจากคอนโซลของเซิร์ฟเวอร์สลับกับจับภาพหน้าต่างเกม (ไม่ต้องมีคนกดในเกม)
//
// ใช้: node tools/look.mjs prep              ตั้งค่าเกมสำหรับการตรวจ (ต้องปิดเกมก่อน) สำรอง options.txt ไว้
//      node tools/look.mjs restore           คืน options.txt เดิม (ต้องปิดเกมก่อน)
//      node tools/look.mjs sync [--fresh] [--lab]   build ด้วยเลข patch ใหม่ แล้วติดตั้งลงโลก bpc-look (--fresh = สร้างโลกและเวทีใหม่)
//      node tools/look.mjs sync --scripts    คัดลอกเฉพาะสคริปต์ (ใช้คู่กับคำสั่ง reload ไม่ต้องเข้าโลกใหม่)
//      node tools/look.mjs serve             เปิดเซิร์ฟเวอร์ค้างไว้ (รันเป็นงานเบื้องหลัง)
//      node tools/look.mjs do "<ขั้น>" ...    ส่งขั้นตอนให้ serve ทำตามลำดับ แล้วพิมพ์ผล
//      node tools/look.mjs stop | status
//      node tools/look.mjs game "<ขั้น>" ...  ทางที่ใช้ได้จริง: ขับเกมที่เปิดโลกในเครื่อง ไม่ใช้เซิร์ฟเวอร์ (client เข้าเซิร์ฟเวอร์ทดสอบไม่ได้)
//
// ขั้นตอนของ game (เกมต้องเปิดอยู่ ยกเว้น !start):
//   "/คำสั่ง" หรือข้อความ = พิมพ์ลงแชต   "!sync" คัดลอก RP+BP ลง development packs ของเกม (มีผลเมื่อเข้าโลกใหม่ ไม่ต้องปิดเกม)
//   "!start" เปิดเกม   "!play" กด Enter ที่หน้าแรก (ไปหน้ารายการโลก)   "!enter" คลิกโลกแรกในรายการ แล้วรอจนสคริปต์ของแอดออนโหลด
//   "!leave" Esc → Save & Quit   "!reenter" = !leave + !enter (ใช้หลัง !sync)
//   "!shot" "!burst" "!sleep" "!click" "!rclick" "!key ESC,F1" "!clientlog" ใช้เหมือน do   "!chat" / "!closechat" เปิดและปิดหน้าแชต
//   ตำแหน่งคลิกของ !enter / !leave ตั้งตามหน้าจอของเกม 1.26.63 (ปรับที่ GAME_UI ถ้าเกมเปลี่ยนหน้าจอ)
//
// ขั้นตอนของ do:
//   "คำสั่งคอนโซล"  "คำสั่ง@3" (หน่วง 3 วินาที)  "คำสั่ง@~ข้อความ" (รอจน log มีข้อความ)
//   "!join [วินาที]"                 เปิดลิงก์ minecraft:// ให้เกมเข้าเซิร์ฟเวอร์ แล้วรอจนผู้เล่นเกิด
//   "!shot ชื่อ [ส่วน] [ตัวคูณ]"       จับภาพ 1 ภาพ → .dev/shots/ชื่อ.png
//   "!burst ชื่อ จำนวน มิลลิวินาที [ส่วน] [ตัวคูณ] [คอลัมน์]"   หลายเฟรมรวมเป็นแผ่นเดียว
//   "!sleep วินาที"  "!rclick [มิลลิวินาที]"  "!click x,y"  "!esc"  "!enter"  "!focus"  "!clientlog [regex]"  "!waitlog ข้อความ [วินาที]"
//   ส่วน = full|tr|tl|top|center|hotbar|left|right หรือ "x,y,w,h" เป็นสัดส่วน 0..1
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEV = join(ROOT, ".dev");
const LOOK = join(DEV, "look");
const SHOTS = join(DEV, "shots");
const BDS = join(DEV, "bds");
const WORLD = "bpc-look";
const PORT = 19140;
const QUEUE = join(LOOK, "queue");
const DONE = join(LOOK, "done");
const PID = join(LOOK, "serve.pid");
const BACKUP = join(LOOK, "options.backup.txt");
const GAME_DATA = join(process.env.APPDATA ?? "", "Minecraft Bedrock");
const OPTIONS = { content_log_file: "1", pause_menu_on_focus_lost: "0" };
const REGIONS = {
  full: "0,0,1,1", tr: "0.55,0,0.45,0.3", tl: "0,0,0.5,0.4", top: "0,0,1,0.35", center: "0.2,0.08,0.6,0.84",
  hotbar: "0.3,0.86,0.4,0.14", left: "0,0,0.5,1", right: "0.5,0,0.5,1",
};
const NOISE = /AutoCompaction|^ *$|NO LOG FILE|Session ID|Build ID|Branch:|Commit ID|Configuration:|IPv[46] supported|Level Name|Game mode|Difficulty|Version:|Opening level|Pack Stack|Quit correctly|Stopping server|Starting Server|=====|#####|VANILLA WORLD|Content logging|Contents of server.properties|Profiler config|CDN config|Accepting clients|signaling service|TELEMETRY|Telemetry|telemetry|To enable this feature|to the server.properties|Server stop requested|debugger|Network port|Running AutoCompaction|(INFO|WARN|ERROR)] *$/;

const [cmd, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")).map(([k, v]) => [k, v ?? true]));
const positional = rest.filter((a) => !a.startsWith("--"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const d of [LOOK, SHOTS, QUEUE, DONE]) mkdirSync(d, { recursive: true });

const gameRunning = () => /Minecraft\.Windows/i.test(spawnSync("tasklist", ["/FI", "IMAGENAME eq Minecraft.Windows.exe", "/NH"], { encoding: "utf8" }).stdout ?? "");
const serveAlive = () => {
  if (!existsSync(PID)) return false;
  try {
    process.kill(Number(readFileSync(PID, "utf8")), 0);
    return true;
  } catch {
    return false;
  }
};

function optionsFile() {
  const users = join(GAME_DATA, "Users");
  const found = [];
  for (const u of existsSync(users) ? readdirSync(users) : []) {
    const f = join(users, u, "games", "com.mojang", "minecraftpe", "options.txt");
    if (existsSync(f)) found.push({ f, t: statSync(f).mtimeMs });
  }
  if (!found.length) throw new Error("ไม่พบ options.txt ของเกม");
  return found.sort((a, b) => b.t - a.t)[0].f;
}
const readOption = (text, key) => new RegExp(`^${key}:(.*)$`, "m").exec(text)?.[1]?.trim();

function prep() {
  if (gameRunning()) throw new Error("เกมยังเปิดอยู่ ปิด Minecraft ก่อนแล้วรันใหม่");
  const file = optionsFile();
  let text = readFileSync(file, "utf8");
  if (!existsSync(BACKUP)) copyFileSync(file, BACKUP);
  const changed = [];
  for (const [k, v] of Object.entries(OPTIONS)) {
    const cur = readOption(text, k);
    if (cur === v) continue;
    text = cur === undefined ? `${text.replace(/\s*$/, "")}\n${k}:${v}\n` : text.replace(new RegExp(`^${k}:.*$`, "m"), `${k}:${v}`);
    changed.push(`${k} ${cur ?? "(ไม่มี)"} → ${v}`);
  }
  writeFileSync(file, text);
  console.log(`prep ok: ${changed.length ? changed.join(", ") : "ค่าตรงอยู่แล้ว"} · สำรองไว้ที่ .dev/look/options.backup.txt`);
}

function restore() {
  if (gameRunning()) throw new Error("เกมยังเปิดอยู่ ปิด Minecraft ก่อนแล้วรันใหม่");
  if (!existsSync(BACKUP)) return console.log("restore: ไม่มีไฟล์สำรอง (ไม่ได้เปลี่ยนอะไรไว้)");
  // คืนเฉพาะค่าที่ prep เปลี่ยน ค่าอื่นที่ผู้ใช้ปรับในเกมระหว่างนั้นยังอยู่
  const file = optionsFile();
  const old = readFileSync(BACKUP, "utf8");
  let text = readFileSync(file, "utf8");
  const back = [];
  for (const k of Object.keys(OPTIONS)) {
    const was = readOption(old, k);
    if (was === undefined || readOption(text, k) === was) continue;
    text = text.replace(new RegExp(`^${k}:.*$`, "m"), `${k}:${was}`);
    back.push(`${k} → ${was}`);
  }
  writeFileSync(file, text);
  rmSync(BACKUP);
  console.log(`restore ok: ${back.length ? back.join(", ") : "ไม่มีค่าที่ต้องคืน"}`);
}

function node(args, env = {}) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...env } });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  if (r.status !== 0) throw new Error(`${args.join(" ")} ล้ม:\n${out}`);
  return out.split(/\r?\n/).pop();
}

function sync() {
  const bp = join(BDS, "development_behavior_packs");
  if (flags.scripts) {
    cpSync(join(ROOT, "BP", "scripts"), join(bp, "BiomePostcards_BP", "scripts"), { recursive: true });
    for (const f of readdirSync(join(ROOT, "testpack", "scripts"))) copyFileSync(join(ROOT, "testpack", "scripts", f), join(bp, "bpc_testpack", "scripts", f));
    return console.log('sync scripts ok (ใช้ do "reload" ให้เซิร์ฟเวอร์โหลดสคริปต์ใหม่)');
  }
  if (serveAlive()) throw new Error("serve ยังรันอยู่ สั่ง stop ก่อน sync");
  const patchFile = join(LOOK, "patch");
  const patch = (existsSync(patchFile) ? Number(readFileSync(patchFile, "utf8")) : 0) + 1;
  writeFileSync(patchFile, String(patch));
  const env = { BPC_PATCH: String(patch), ...(flags.lab ? { BPC_UI_LAB: "1" } : {}) };
  const built = node(["tools/build.mjs"], env);
  const fresh = Boolean(flags.fresh) || !existsSync(join(BDS, "worlds", WORLD, "level.dat"));
  const setup = node(["tools/bds.mjs", "setup", `--world=${WORLD}`, "--testpack=look", "--look", ...(fresh ? ["--fresh"] : [])], env);
  const staged = fresh ? ` · ${node(["tools/bds.mjs", "stage", `--world=${WORLD}`, "--timeout=240"], env)}` : "";
  console.log(`sync ok: patch ${patch}${flags.lab ? " (หน้าทดลอง UI)" : ""} · ${built} · ${setup}${staged}`);
}

// ---------- serve ----------
function shot(args) {
  const r = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(ROOT, "tools", "shot.ps1"), ...args], { encoding: "utf8" });
  return `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split(/\r?\n/).filter(Boolean).pop() ?? "shot: ไม่มีผลลัพธ์";
}
const region = (name) => REGIONS[name ?? "full"] ?? name;

let clientLogPos = new Map();
function clientLog(filter) {
  const dir = join(GAME_DATA, "logs");
  const files = existsSync(dir) ? readdirSync(dir).map((n) => join(dir, n)).filter((f) => statSync(f).isFile()) : [];
  if (!files.length) return ["clientlog: ยังไม่มีไฟล์ log ของเกม"];
  const newest = files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  const text = readFileSync(newest, "utf8");
  const from = clientLogPos.get(newest) ?? 0;
  clientLogPos.set(newest, text.length);
  const re = new RegExp(filter ?? "bpc|\\[UI\\]|\\[Json\\]|\\[Scripting\\]|\\[Texture\\]|\\[Geometry\\]|\\[Blocks\\]|\\[Item\\]|\\[Molang\\]|\\[Rendering\\]|error|warn", "i");
  const all = text.slice(from).split(/\r?\n/).filter((l) => l.trim() && re.test(l));
  // error ของ item custom component ฝั่ง client ขึ้นทุกครั้งที่เข้าโลก (U11) นับรวมเป็นบรรทัดเดียว
  const schema = (l) => l.includes("Error Parsing Item 'bpc:") || l.includes("is not present in the Schema");
  const lines = filter ? all : all.filter((l) => !schema(l));
  const known = all.length - lines.length;
  // บรรทัดซ้ำนับรวม
  const count = new Map();
  for (const l of lines) {
    const key = l.replace(/^\d\d:\d\d:\d\d\S*\s*/, "");
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  const out = [...count].map(([l, n]) => (n > 1 ? `${l}  (×${n})` : l));
  return [`clientlog: ${out.length} บรรทัดใหม่ที่เกี่ยวข้อง${known ? ` + error ของ item custom component ที่รู้อยู่แล้ว ${known} บรรทัด (U11)` : ""} (${newest.split(/[\\/]/).pop()})`, ...out.slice(0, 60)];
}

function serve() {
  if (serveAlive()) throw new Error("serve รันอยู่แล้ว");
  writeFileSync(PID, String(process.pid));
  const logFile = join(LOOK, "serve.log");
  writeFileSync(logFile, "");
  const proc = spawn(join(BDS, "bedrock_server.exe"), [], { cwd: BDS, stdio: ["pipe", "pipe", "pipe"] });
  const lines = [];
  let pending = "";
  let started = false;
  let stopping = false;
  const onData = (chunk) => {
    pending += chunk.toString("utf8");
    const parts = pending.split(/\r?\n/);
    pending = parts.pop();
    for (const line of parts) {
      lines.push(line);
      appendFileSync(logFile, `${line}\n`);
      if (/Server started/.test(line)) started = true;
    }
  };
  proc.stdout.on("data", onData);
  proc.stderr.on("data", onData);
  proc.on("close", (code) => {
    rmSync(PID, { force: true });
    console.log(`serve จบ: exit ${code}`);
    process.exit(0);
  });
  const waitFor = async (text, from, secs) => {
    for (let i = 0; i < secs * 5; i++) {
      if (lines.slice(from).some((l) => l.includes(text))) return true;
      await sleep(200);
    }
    return false;
  };

  async function runStep(step, out) {
    if (!step.startsWith("!")) {
      const at = step.lastIndexOf("@");
      const tail = at > 0 ? step.slice(at + 1) : "";
      const timed = tail !== "" && !Number.isNaN(Number(tail));
      const awaited = tail.startsWith("~");
      const text = timed || awaited ? step.slice(0, at) : step;
      const from = lines.length;
      proc.stdin.write(`${text}\n`);
      if (awaited) {
        if (!(await waitFor(tail.slice(1), from, 120))) out.push(`ERROR รอ "${tail.slice(1)}" ไม่สำเร็จ`);
      } else await sleep(1000 * (timed ? Number(tail) : 1));
      out.push(`> ${text}`, ...lines.slice(from).filter((l) => !NOISE.test(l)).map((l) => `  ${l.replace(/^\[[^\]]*\]\s*/, "")}`));
      return;
    }
    const [op, ...a] = step.slice(1).split(/\s+/);
    if (op === "sleep") await sleep(1000 * Number(a[0] ?? 1));
    else if (op === "shot") out.push(shot(["-Out", join(SHOTS, `${a[0]}.png`), "-Region", region(a[1]), "-Scale", a[2] ?? "1"]));
    else if (op === "burst") out.push(shot(["-Out", join(SHOTS, `${a[0]}.png`), "-Count", a[1] ?? "6", "-IntervalMs", a[2] ?? "300", "-Region", region(a[3]), "-Scale", a[4] ?? "1", "-Cols", a[5] ?? "4"]));
    else if (op === "rclick") out.push(shot(["-Action", "rclick", "-HoldMs", a[0] ?? "60"]));
    else if (op === "esc" || op === "enter" || op === "focus") out.push(shot(["-Action", op]));
    else if (op === "click") out.push(shot(["-Action", "click", "-At", a[0] ?? "0.5,0.5"]));
    else if (op === "clientlog") out.push(...clientLog(a.join(" ") || undefined));
    else if (op === "waitlog") {
      const secs = Number(a[a.length - 1]);
      const text = (Number.isNaN(secs) ? a : a.slice(0, -1)).join(" ");
      out.push(`waitlog "${text}": ${(await waitFor(text, 0, Number.isNaN(secs) ? 60 : secs)) ? "พบ" : "ไม่พบ"}`);
    } else if (op === "join") {
      const from = lines.length;
      spawn("powershell", ["-NoProfile", "-Command", `Start-Process 'minecraft://connect/?serverUrl=127.0.0.1&serverPort=${PORT}'`], { stdio: "ignore" });
      const ok = await waitFor("Player Spawned", from, Number(a[0] ?? 150));
      out.push(`join: ${ok ? "ผู้เล่นเข้าโลกแล้ว" : "ยังไม่เข้า (หมดเวลา)"}`, ...lines.slice(from).filter((l) => /Player|allowlist|Allowlist|kick|disconnect/i.test(l)).map((l) => `  ${l.replace(/^\[[^\]]*\]\s*/, "")}`));
    } else if (op === "stop") {
      stopping = true;
      proc.stdin.write("stop\n");
      out.push("stop: ส่งคำสั่งปิดเซิร์ฟเวอร์แล้ว");
    } else out.push(`ERROR ไม่รู้จักขั้น !${op}`);
  }

  (async () => {
    for (let i = 0; i < 600 && !started; i++) await sleep(200);
    console.log(started ? "serve พร้อม: เซิร์ฟเวอร์ขึ้นแล้ว" : "serve: เซิร์ฟเวอร์ไม่ขึ้นใน 120 วินาที");
    while (!stopping) {
      const jobs = readdirSync(QUEUE).filter((n) => n.endsWith(".json")).sort();
      if (!jobs.length) {
        await sleep(250);
        continue;
      }
      const file = join(QUEUE, jobs[0]);
      let job;
      try {
        job = JSON.parse(readFileSync(file, "utf8"));
      } catch {
        await sleep(100); // ยังเขียนไม่เสร็จ
        continue;
      }
      rmSync(file);
      const out = [];
      for (const step of job.steps) {
        try {
          await runStep(step, out);
        } catch (e) {
          out.push(`ERROR ${step}: ${e}`);
        }
      }
      writeFileSync(join(DONE, `${job.id}.json`), JSON.stringify(out));
    }
  })();
}

// ---------- game: ขับเกมที่เปิดโลกในเครื่อง ----------
const GAME_UI = { firstWorld: "0.17,0.5", saveAndQuit: "0.29,0.69", pauseProbe: "0.15,0.325;0.15,0.69;0.44,0.69;0.15,0.57", chatProbe: "0.25,0.035;0.75,0.035;0.6,0.035;0.5,0.94;0.3,0.94" };
const probe = (at) => (/probe: (.*)/.exec(shot(["-Action", "probe", "-At", at]))?.[1] ?? "").trim().split(" ").filter(Boolean).map((t) => t.split(",").map(Number));
/** หน้าแชตเปิดอยู่หรือไม่: แถบหัวเรื่องสีเทาอ่อนพาดเต็มขอบบน */
function chatShowing() {
  // สีตายตัวของหน้าแชต: แถบหัวเรื่อง 198 และช่องพิมพ์ 94 (ฉากในโลกที่เป็นสีเทาจึงไม่ถูกนับผิด)
  const pts = probe(GAME_UI.chatProbe);
  const is = (c, v) => c.length === 3 && c.every((n) => Math.abs(n - v) <= 4);
  return pts.length === 5 && pts.slice(0, 3).every((c) => is(c, 198)) && pts.slice(3).every((c) => is(c, 94));
}
// หน้าหยุดเกมขึ้นอยู่หรือไม่: ปุ่ม Resume Game และ Save & Quit เป็นสีเทาอ่อนสีเดียวกัน
function pauseShowing() {
  // ปุ่มของหน้าหยุดเกมเป็นสีเทา 198 ตายตัว (Resume Game, Browse Add-ons, Save & Quit)
  const pts = probe(GAME_UI.pauseProbe);
  return pts.length === 4 && pts.every((c) => c.length === 3 && c.every((n) => Math.abs(n - 198) <= 4));
}
function devPackDirs() {
  const base = join(GAME_DATA, "Users", "Shared", "games", "com.mojang");
  return { rp: join(base, "development_resource_packs", "BiomePostcards_RP"), bp: join(base, "development_behavior_packs", "BiomePostcards_BP") };
}
function newestClientLog() {
  const dir = join(GAME_DATA, "logs");
  const files = existsSync(dir) ? readdirSync(dir).map((n) => join(dir, n)).filter((x) => statSync(x).isFile()) : [];
  return files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}
async function waitClient(text, from, secs) {
  for (let i = 0; i < secs * 2; i++) {
    const file = newestClientLog();
    if (file && readFileSync(file, "utf8").slice(from.file === file ? from.size : 0).includes(text)) return true;
    await sleep(500);
  }
  return false;
}
async function gameSteps(steps) {
  const out = [];
  const act = (...args) => out.push(shot(args));
  for (const step of steps) {
    if (!step.startsWith("!")) {
      // พิมพ์ลงแชต: ถ้าหน้าแชตค้างอยู่ (ข้อความธรรมดาไม่ปิดหน้าแชต) วางข้อความได้เลย ไม่กด T ซ้ำ (จะกลายเป็นตัวอักษร t นำหน้า)
      act("-Action", chatShowing() ? "paste" : "type", "-Text", step);
      await sleep(600);
      for (let i = 0; i < 3 && chatShowing(); i++) {
        act("-Action", "key", "-Text", "ESC");
        await sleep(700);
      }
      continue;
    }
    const [op, ...a] = step.slice(1).split(/\s+/);
    if (op === "sleep") await sleep(1000 * Number(a[0] ?? 1));
    else if (op === "sync") {
      const { rp, bp } = devPackDirs();
      for (const [from, to] of [[join(ROOT, "RP"), rp], [join(ROOT, "BP"), bp]]) {
        rmSync(to, { recursive: true, force: true });
        cpSync(from, to, { recursive: true });
      }
      out.push("sync: คัดลอก RP + BP ลง development packs ของเกมแล้ว");
    } else if (op === "start") {
      if (!gameRunning()) spawn("powershell", ["-NoProfile", "-Command", "Start-Process 'minecraft:'"], { stdio: "ignore" });
      for (let i = 0; i < 120 && !/focus=True/.test(shot(["-Action", "focus"])); i++) await sleep(1000);
      await sleep(1000 * Number(a[0] ?? 25));
      out.push(`start: เกม${gameRunning() ? "เปิดแล้ว" : "ไม่ขึ้น"}`);
    } else if (op === "play") {
      act("-Action", "key", "-Text", "ENTER");
      await sleep(4000);
    } else if (op === "enter") {
      const file = newestClientLog();
      const from = { file, size: file ? readFileSync(file, "utf8").length : 0 };
      act("-Action", "click", "-At", GAME_UI.firstWorld);
      // เกมเขียน log เป็นก้อน: โลกที่ไม่มี error บรรทัด [bpc] อาจยังไม่ถูกเขียนลงไฟล์ จึงรอไม่เกิน 20 วินาทีแล้วไปต่อ
      const ok = await waitClient("[bpc] v", from, Number(a[0] ?? 20));
      await sleep(6000);
      out.push(`enter: ${ok ? "สคริปต์ของแอดออนโหลดแล้ว" : "รอครบเวลาแล้ว (ยังไม่เห็นบรรทัด [bpc] ใน log ซึ่งเป็นปกติเมื่อ log ยังไม่ถูกเขียนลงไฟล์)"}`);
    } else if (op === "leave") {
      // Esc ปิดหน้าจออื่นที่ค้างอยู่ก่อน (แชต ฟอร์ม) จึงกดซ้ำจนกว่าหน้าหยุดเกมจะขึ้น
      let paused = pauseShowing();
      for (let i = 0; i < 4 && !paused; i++) {
        act("-Action", "key", "-Text", "ESC");
        await sleep(1500);
        paused = pauseShowing();
      }
      if (!paused) {
        out.push("ERROR leave: หน้าหยุดเกมไม่ขึ้น");
        break;
      }
      act("-Action", "click", "-At", GAME_UI.saveAndQuit);
      await sleep(8000);
    } else if (op === "reenter") {
      const o = await gameSteps(["!leave", "!enter"]);
      out.push(...o);
      if (o.some((l) => l.startsWith("ERROR"))) break;
    } else if (op === "shot") act("-Out", join(SHOTS, `${a[0]}.png`), "-Region", region(a[1]), "-Scale", a[2] ?? "1");
    else if (op === "burst") act("-Out", join(SHOTS, `${a[0]}.png`), "-Count", a[1] ?? "6", "-IntervalMs", a[2] ?? "300", "-Region", region(a[3]), "-Scale", a[4] ?? "1", "-Cols", a[5] ?? "4");
    else if (op === "click") act("-Action", "click", "-At", a[0] ?? "0.5,0.5");
    else if (op === "rclick") act("-Action", "rclick", "-HoldMs", a[0] ?? "60");
    else if (op === "key") act("-Action", "key", "-Text", a.join(""));
    else if (op === "chat") {
      // เปิดหน้าแชตค้างไว้ให้จับภาพข้อความย้อนหลัง ปิดด้วย !closechat
      if (!chatShowing()) act("-Action", "key", "-Text", "T");
      await sleep(1200);
    } else if (op === "closechat") {
      for (let i = 0; i < 3 && chatShowing(); i++) {
        act("-Action", "key", "-Text", "ESC");
        await sleep(700);
      }
    }
    else if (op === "clientlog") out.push(...clientLog(a.join(" ") || undefined));
    else out.push(`ERROR ไม่รู้จักขั้น !${op}`);
  }
  return out;
}

async function doSteps(steps) {
  if (!serveAlive()) throw new Error("serve ไม่ได้รันอยู่ (node tools/look.mjs serve)");
  const id = `${Date.now()}-${process.pid}`;
  writeFileSync(join(QUEUE, `${id}.json`), JSON.stringify({ id, steps }));
  const result = join(DONE, `${id}.json`);
  const limit = Number(flags.timeout ?? 600) * 4;
  for (let i = 0; i < limit && !existsSync(result); i++) await sleep(250);
  if (!existsSync(result)) throw new Error("do: หมดเวลารอผล");
  await sleep(50);
  const out = JSON.parse(readFileSync(result, "utf8"));
  rmSync(result);
  console.log(out.join("\n"));
  if (out.some((l) => l.startsWith("ERROR"))) process.exitCode = 1;
}

try {
  if (cmd === "prep") prep();
  else if (cmd === "restore") restore();
  else if (cmd === "sync") sync();
  else if (cmd === "serve") serve();
  else if (cmd === "do") await doSteps(positional);
  else if (cmd === "game") {
    const out = await gameSteps(positional);
    console.log(out.join("\n"));
    if (out.some((l) => l.startsWith("ERROR"))) process.exitCode = 1;
  } else if (cmd === "stop") await doSteps(["!stop"]);
  else if (cmd === "status") {
    const opt = readFileSync(optionsFile(), "utf8");
    console.log(`status: serve ${serveAlive() ? "รันอยู่" : "ปิด"} · เกม ${gameRunning() ? "เปิดอยู่" : "ปิด"} · patch ${existsSync(join(LOOK, "patch")) ? readFileSync(join(LOOK, "patch"), "utf8") : 0} · ${Object.keys(OPTIONS).map((k) => `${k}=${readOption(opt, k)}`).join(" ")} · สำรอง options ${existsSync(BACKUP) ? "มี" : "ไม่มี"}`);
  } else {
    console.error("ใช้: look.mjs prep|restore|sync|serve|do|game|stop|status (ดูหัวไฟล์)");
    process.exit(1);
  }
} catch (e) {
  console.error(`look ล้ม: ${e.message ?? e}`);
  process.exit(1);
}
