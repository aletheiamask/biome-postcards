// ตารางเนื้อหา แหล่งข้อมูลเดียวของทั้งแอดออน (แก้ที่นี่แล้วรัน npm run build)
// ห้ามเปลี่ยน id และ board ของแถวที่ปล่อยแล้ว (content/ids.lock.json)
// biomes เขียนโดยไม่มีคำนำหน้า minecraft: generator เติมให้
// rgb = สีหลัก [ท้องฟ้า, พื้น, จุดเด่น] ใช้กับภาพชั่วคราวและเป็นพาเลตตั้งต้นของภาพจริง

export const NAMESPACE = "bpc";

/** @typedef {"common"|"uncommon"|"rare"} Rarity */

export const CARDS = [
  { id: "plains", board: 1, rarity: "common", set: "fields", en: "Plains", th: "ทุ่งราบ", rgb: ["#8fc7ff", "#7cbd4b", "#ffd83d"],
    biomes: ["plains", "sunflower_plains"] },
  { id: "forest", board: 2, rarity: "common", set: "forests", en: "Forest", th: "ป่าไม้", rgb: ["#9ad0ff", "#4f9a35", "#2f6b22"],
    biomes: ["forest", "forest_hills", "birch_forest", "birch_forest_hills", "birch_forest_mutated", "birch_forest_hills_mutated"] },
  { id: "flower_forest", board: 3, rarity: "uncommon", set: "forests", en: "Flower Forest", th: "ป่าดอกไม้", rgb: ["#a8d8ff", "#5aa83c", "#ff7fb5"],
    biomes: ["flower_forest"] },
  { id: "dark_forest", board: 4, rarity: "uncommon", set: "forests", en: "Dark Forest", th: "ป่าทึบ", rgb: ["#6f8fa8", "#2f5a24", "#b0452c"],
    biomes: ["roofed_forest", "roofed_forest_mutated"] },
  { id: "pale_garden", board: 5, rarity: "rare", set: "forests", en: "Pale Garden", th: "สวนซีด", rgb: ["#b9bfc2", "#8d948c", "#e9ece6"],
    biomes: ["pale_garden"] },
  { id: "cherry_grove", board: 6, rarity: "uncommon", set: "forests", en: "Cherry Grove", th: "ดงซากุระ", rgb: ["#a9dcff", "#7fc65a", "#ffb3d9"],
    biomes: ["cherry_grove"] },
  { id: "meadow", board: 7, rarity: "uncommon", set: "fields", en: "Meadow", th: "ทุ่งหญ้าบนเขา", rgb: ["#9fd4ff", "#84cf6a", "#6fa8ff"],
    biomes: ["meadow"] },
  { id: "dappled_forest", board: 8, rarity: "uncommon", set: "forests", en: "Dappled Forest", th: "ป่าแสงลอด", rgb: ["#b5dcff", "#6aa63f", "#f2d06b"],
    biomes: ["dappled_forest"] },
  { id: "taiga", board: 9, rarity: "common", set: "fields", en: "Taiga", th: "ไทกา", rgb: ["#9cc4e8", "#4c7d4f", "#2b4f37"],
    biomes: ["taiga", "taiga_hills", "taiga_mutated", "mega_taiga", "mega_taiga_hills", "redwood_taiga_mutated", "redwood_taiga_hills_mutated"] },
  { id: "snowy_lands", board: 10, rarity: "common", set: "cold", en: "Snowy Lands", th: "ดินแดนหิมะ", rgb: ["#bcd9f5", "#f3f8fc", "#4a7a5c"],
    biomes: ["ice_plains", "ice_mountains", "cold_taiga", "cold_taiga_hills", "cold_taiga_mutated"] },
  { id: "ice_spikes", board: 11, rarity: "rare", set: "cold", en: "Ice Spikes", th: "ยอดน้ำแข็ง", rgb: ["#b4d6f7", "#eaf4fb", "#7fc4f2"],
    biomes: ["ice_plains_spikes"] },
  { id: "mountain_peaks", board: 12, rarity: "uncommon", set: "cold", en: "Mountain Peaks", th: "ยอดเขา", rgb: ["#a6ccf2", "#8a8f96", "#f4f8fb"],
    biomes: ["frozen_peaks", "jagged_peaks", "stony_peaks", "snowy_slopes", "grove"] },
  { id: "windswept_hills", board: 13, rarity: "common", set: "fields", en: "Windswept Hills", th: "เนินลมแรง", rgb: ["#a3c8ea", "#7e8a80", "#5f8f5a"],
    biomes: ["extreme_hills", "extreme_hills_edge", "extreme_hills_mutated", "extreme_hills_plus_trees", "extreme_hills_plus_trees_mutated"] },
  { id: "desert", board: 14, rarity: "common", set: "dry", en: "Desert", th: "ทะเลทราย", rgb: ["#9fd0ff", "#e6d28f", "#4f9a35"],
    biomes: ["desert", "desert_hills", "desert_mutated"] },
  { id: "savanna", board: 15, rarity: "common", set: "dry", en: "Savanna", th: "สะวันนา", rgb: ["#a6d2f7", "#b5b04a", "#8a6a3a"],
    biomes: ["savanna", "savanna_mutated", "savanna_plateau", "savanna_plateau_mutated"] },
  { id: "badlands", board: 16, rarity: "uncommon", set: "dry", en: "Badlands", th: "แบดแลนด์", rgb: ["#a9d3f5", "#c46a32", "#e8b25a"],
    biomes: ["mesa", "mesa_bryce", "mesa_plateau", "mesa_plateau_mutated", "mesa_plateau_stone", "mesa_plateau_stone_mutated"] },
  { id: "jungle", board: 17, rarity: "uncommon", set: "wet", en: "Jungle", th: "ป่าดิบชื้น", rgb: ["#8fd0f5", "#2f9a2c", "#1f6b23"],
    biomes: ["jungle", "jungle_hills", "jungle_mutated", "jungle_edge", "jungle_edge_mutated"] },
  { id: "bamboo_jungle", board: 18, rarity: "uncommon", set: "wet", en: "Bamboo Jungle", th: "ป่าไผ่", rgb: ["#93d2f2", "#4aa63a", "#a9d64f"],
    biomes: ["bamboo_jungle", "bamboo_jungle_hills"] },
  { id: "swamp", board: 19, rarity: "common", set: "wet", en: "Swamp", th: "หนองน้ำ", rgb: ["#8fa9b8", "#5a6b3a", "#3f5a4f"],
    biomes: ["swampland", "swampland_mutated"] },
  { id: "mangrove_swamp", board: 20, rarity: "uncommon", set: "wet", en: "Mangrove Swamp", th: "ป่าชายเลน", rgb: ["#93b5c4", "#5f7f3f", "#8a4a32"],
    biomes: ["mangrove_swamp"] },
  { id: "mushroom_fields", board: 21, rarity: "rare", set: "fields", en: "Mushroom Fields", th: "ทุ่งเห็ด", rgb: ["#a9c9f0", "#8a6f8f", "#d6453c"],
    biomes: ["mushroom_island", "mushroom_island_shore"] },
  { id: "beach", board: 22, rarity: "common", set: "fields", en: "Beach", th: "ชายหาด", rgb: ["#9fd4ff", "#f0e2a8", "#3f9fe0"],
    biomes: ["beach", "stone_beach", "cold_beach"] },
  { id: "ocean", board: 23, rarity: "common", set: "fields", en: "Ocean", th: "มหาสมุทร", rgb: ["#9fd0ff", "#2f6fd0", "#5fb0f0"],
    biomes: ["ocean", "deep_ocean", "warm_ocean", "deep_warm_ocean", "lukewarm_ocean", "deep_lukewarm_ocean", "cold_ocean", "deep_cold_ocean"] },
  { id: "frozen_ocean", board: 24, rarity: "uncommon", set: "cold", en: "Frozen Ocean", th: "มหาสมุทรน้ำแข็ง", rgb: ["#b9d9f5", "#3f6fb5", "#e6f2fb"],
    biomes: ["frozen_ocean", "deep_frozen_ocean", "legacy_frozen_ocean"] },
  { id: "lush_caves", board: 25, rarity: "uncommon", set: "underground", en: "Lush Caves", th: "ถ้ำเขียวชอุ่ม", rgb: ["#3a3f3a", "#5f9a3a", "#f08fc0"],
    biomes: ["lush_caves"] },
  { id: "dripstone_caves", board: 26, rarity: "uncommon", set: "underground", en: "Dripstone Caves", th: "ถ้ำหินย้อย", rgb: ["#3f3a35", "#8a6f5a", "#b59a80"],
    biomes: ["dripstone_caves"] },
  { id: "deep_dark", board: 27, rarity: "rare", set: "underground", en: "Deep Dark", th: "ความมืดลึก", rgb: ["#0f1a20", "#16303a", "#2fd0d0"],
    biomes: ["deep_dark"] },
  { id: "nether", board: 28, rarity: "uncommon", set: "otherworld", en: "Nether", th: "เนเธอร์", rgb: ["#5a1f1f", "#8a2f2a", "#f08a2a"],
    biomes: ["hell", "soulsand_valley", "basalt_deltas"] },
  { id: "nether_forests", board: 29, rarity: "uncommon", set: "otherworld", en: "Nether Forests", th: "ป่าเนเธอร์", rgb: ["#4a1a2a", "#b5303a", "#2fb5a6"],
    biomes: ["crimson_forest", "warped_forest"] },
  { id: "the_end", board: 30, rarity: "uncommon", set: "otherworld", en: "The End", th: "ดิเอนด์", rgb: ["#1a1026", "#d9d6a0", "#b05ad6"],
    biomes: ["the_end"] },
  { id: "sulfur_caves", board: 31, rarity: "uncommon", set: "underground", en: "Sulfur Caves", th: "ถ้ำกำมะถัน", rgb: ["#3a3a2a", "#b5a83a", "#f0e04a"],
    biomes: ["sulfur_caves"] },
];

// การ์ดพิเศษ ไม่นับในเป้าหมายหลัก
export const BONUS_CARDS = [
  { id: "mystery", board: 32, rarity: "rare", kind: "mystery", en: "Mysterious Land", th: "ดินแดนลึกลับ", rgb: ["#2a2440", "#5a4a8a", "#f0d04a"], biomes: [] },
  { id: "ice_caves", board: 33, rarity: "rare", kind: "biome", en: "Ice Caves", th: "ถ้ำน้ำแข็ง", rgb: ["#20303f", "#7fb5e0", "#e6f5ff"],
    biomes: ["ice_caves"], experimental: true, theme: "cold" },
  { id: "fest_new_year", board: 34, rarity: "rare", kind: "festival", en: "New Year", th: "ปีใหม่", rgb: ["#141a3a", "#2a2f5a", "#ffd83d"],
    biomes: [], window: ["12-28", "01-03"] },
  { id: "fest_songkran", board: 35, rarity: "rare", kind: "festival", en: "Songkran", th: "สงกรานต์", rgb: ["#8fd4ff", "#3fa9f0", "#fff0a0"],
    biomes: [], window: ["04-12", "04-16"] },
  { id: "fest_midyear", board: 36, rarity: "rare", kind: "festival", en: "Midsummer", th: "กลางปี", rgb: ["#ffc878", "#f09a3a", "#fff2b0"],
    biomes: [], window: ["06-20", "06-24"] },
  { id: "fest_halloween", board: 37, rarity: "rare", kind: "festival", en: "Halloween", th: "ฮาโลวีน", rgb: ["#2a1a3a", "#f08a2a", "#8ad04a"],
    biomes: [], window: ["10-25", "10-31"] },
];

// ไบโอมที่ไม่ให้การ์ด
export const IGNORED = ["river", "frozen_river"];

// ชุดสะสม (v1.0) ครบชุดได้บล็อกรางวัล 1 ชิ้น ครบทุกชุดได้ Traveler's Globe
export const SETS = [
  { id: "forests", en: "Forests", th: "ป่าไม้", reward: "trophy_forests", rewardEn: "Forest Bonsai", rewardTh: "บอนไซป่า", rgb: ["#4f9a35", "#8a5a2f"] },
  { id: "cold", en: "Frozen Lands", th: "ดินแดนหนาว", reward: "trophy_cold", rewardEn: "Frost Crystal", rewardTh: "ผลึกน้ำแข็ง", rgb: ["#7fc4f2", "#e6f5ff"] },
  { id: "dry", en: "Dry Lands", th: "ร้อนแห้ง", reward: "trophy_dry", rewardEn: "Desert Hourglass", rewardTh: "นาฬิกาทราย", rgb: ["#e6d28f", "#c46a32"] },
  { id: "wet", en: "Wetlands", th: "ชุ่มชื้น", reward: "trophy_wet", rewardEn: "Lily Pond Bowl", rewardTh: "อ่างบัว", rgb: ["#2f9a2c", "#3f9fe0"] },
  { id: "fields", en: "Fields and Coasts", th: "ทุ่งและชายฝั่ง", reward: "trophy_fields", rewardEn: "Seashell Keepsake", rewardTh: "เปลือกหอยที่ระลึก", rgb: ["#7cbd4b", "#f0e2a8"] },
  { id: "underground", en: "Underground", th: "ใต้พิภพ", reward: "trophy_underground", rewardEn: "Glow Geode", rewardTh: "หินเรืองแสง", rgb: ["#5a4a8a", "#2fd0d0"], light: 8 },
  { id: "otherworld", en: "Other Worlds", th: "ต่างมิติ", reward: "trophy_otherworld", rewardEn: "Portal Shard", rewardTh: "เศษประตูมิติ", rgb: ["#b05ad6", "#f08a2a"] },
];
export const GRAND_REWARD = { id: "traveler_globe", en: "Traveler's Globe", th: "ลูกโลกนักเดินทาง", rgb: ["#3f9fe0", "#ffd83d"], light: 4 };

// ของที่ระลึก (v1.x) need = จำนวนการ์ดหลักที่ต้องมี (0 = ครบทุกใบ)
export const SOUVENIRS = [
  { id: "souvenir_snow_globe", en: "Snow Globe", th: "ลูกแก้วหิมะ", need: 5, price: 4, rgb: ["#e6f5ff", "#7fc4f2"] },
  { id: "souvenir_cactus_pot", en: "Cactus Pot", th: "กระถางกระบองเพชร", need: 10, price: 6, rgb: ["#4f9a35", "#c46a32"] },
  { id: "souvenir_shell_jar", en: "Shell Jar", th: "โหลเปลือกหอย", need: 20, price: 8, rgb: ["#f0e2a8", "#ff9fb5"] },
  { id: "souvenir_golden_compass", en: "Golden Compass", th: "เข็มทิศทองคำ", need: 0, price: 12, rgb: ["#ffd83d", "#b5303a"] },
];

export const DYES = ["white", "light_gray", "gray", "black", "brown", "red", "orange", "yellow", "lime", "green", "cyan", "light_blue", "blue", "purple", "magenta", "pink"];
