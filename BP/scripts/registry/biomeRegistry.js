// แปลง biome id เป็นการ์ด โมดูลบริสุทธิ์ ห้าม import @minecraft/server
import { CARDS, IGNORED } from "./cards.generated.js";

const byBiome = new Map();
const byId = new Map();
const byBoard = new Map();
for (const c of CARDS) {
  byId.set(c.id, c);
  byBoard.set(c.board, c);
  for (const b of c.biomes) byBiome.set(b, c);
}
const ignored = new Set(IGNORED);

export const MAIN = CARDS.filter((c) => !c.bonus);
export const MAIN_TOTAL = MAIN.length;
export const MYSTERY = byId.get("mystery");
export const FESTIVALS = CARDS.filter((c) => c.kind === "festival");
export const MYSTERY_PREFIX = "mystery:";

export const cardById = (id) => byId.get(id);
export const cardByBoard = (n) => byBoard.get(n);
/** การ์ดของคีย์ในคอลเลกชัน (คีย์การ์ดลึกลับคือ mystery:<biome id>) */
export const cardForKey = (key) => (key.startsWith(MYSTERY_PREFIX) ? MYSTERY : byId.get(key));

/**
 * หาการ์ดของไบโอม คืน null ถ้าไบโอมนั้นไม่ให้การ์ด
 * ไบโอมที่ไม่มีในตาราง (จากแอดออนอื่น หรือเกมรุ่นใหม่กว่า) ได้การ์ดลึกลับ 1 ใบต่อ biome id
 * @returns {{card: object, key: string, bio?: string} | null}
 */
export function lookup(biomeId, mystery = true) {
  if (typeof biomeId !== "string" || ignored.has(biomeId)) return null;
  const card = byBiome.get(biomeId);
  if (card) return { card, key: card.id };
  if (!mystery || !MYSTERY) return null;
  return { card: MYSTERY, key: `${MYSTERY_PREFIX}${biomeId}`, bio: biomeId };
}

/** เทียบตารางกับรายชื่อไบโอมของเกม ใช้ตอนโหลดโลกและในคำสั่ง /bpc:biomes */
export function auditBiomes(gameIds) {
  const game = new Set(gameIds);
  const missing = [];
  const experimentalOff = [];
  for (const c of CARDS) for (const b of c.biomes) if (!game.has(b)) (c.experimental ? experimentalOff : missing).push(b);
  return {
    total: gameIds.length,
    mapped: gameIds.filter((id) => byBiome.has(id)).length,
    ignored: gameIds.filter((id) => ignored.has(id)).length,
    unknown: gameIds.filter((id) => !byBiome.has(id) && !ignored.has(id)),
    missing,
    experimentalOff,
  };
}
