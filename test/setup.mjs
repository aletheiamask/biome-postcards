// โหลดก่อนเทสต์ทุกไฟล์ (node --import): ชี้ @minecraft/server และ server-ui ไปที่ตัวแทนใน test/mock
import { registerHooks } from "node:module";

const map = {
  "@minecraft/server": new URL("./mock/server.js", import.meta.url).href,
  "@minecraft/server-ui": new URL("./mock/server-ui.js", import.meta.url).href,
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (map[specifier]) return { url: map[specifier], shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
