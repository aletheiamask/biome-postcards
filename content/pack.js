// ข้อมูลแพ็ก ห้ามเปลี่ยน uuid หลังปล่อยเวอร์ชันแรก
export const PACK = {
  name: "Biome Postcards",
  description: "Collect a postcard from every biome. By Tacoparoni (Marwin5411-Winner, pipothai).",
  version: [1, 0, 1], // 1.0.0 = รุ่นแจกจ่ายรุ่นแรก ids ล็อกแล้วใน content/ids.lock.json · 1.0.1 แก้โมเดล 3 มิติ
  minEngine: [1, 26, 50],
  formatVersion: "1.26.50",
  authors: ["Tacoparoni", "Marwin5411-Winner", "pipothai"],
  license: "All Rights Reserved",
  url: "https://tarcoparoni.ropmuang.workers.dev/biome-postcards",
  modules: { "@minecraft/server": "2.10.0", "@minecraft/server-ui": "2.2.0" },
  uuids: {
    bp: "f4e07b0c-b0fd-4c76-8a82-0a080ce25151",
    bpData: "f44f466f-c5cc-4d65-8035-3958c47b2c34",
    bpScript: "94535f60-90b8-4d01-a624-f16580db4f83",
    rp: "258846a1-89e5-4570-b214-12c8796aa681",
    rpModule: "850820a8-75b7-45ce-8cfe-976bfd9e0207",
  },
};

// รุ่นพัฒนา: ตั้ง BPC_PATCH=<เลข> เพื่อเปลี่ยนเลขตัวท้ายของเวอร์ชัน ให้ client โหลดแพ็กใหม่จากเซิร์ฟเวอร์ทดสอบ
// (tools/look.mjs ตั้งให้เอง) ก่อน commit ต้อง build ใหม่โดยไม่มีตัวแปรนี้
const devPatch = globalThis.process?.env?.BPC_PATCH;
if (devPatch) PACK.version = [PACK.version[0], PACK.version[1], Number(devPatch)];
