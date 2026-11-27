// ตัวรายงานผลเทสต์: ผ่าน = บรรทัดเดียว พิมพ์รายละเอียดเฉพาะเทสต์ที่ตก
export default async function* reporter(source) {
  let passed = 0;
  const failures = [];
  for await (const event of source) {
    if (event.data?.details?.type === "suite") continue;
    if (event.type === "test:pass") passed++;
    if (event.type === "test:fail") {
      const err = event.data.details?.error;
      const text = String(err?.cause?.message ?? err?.message ?? err).slice(0, 600);
      failures.push(`FAIL ${event.data.name} (${event.data.file ?? ""}:${event.data.line ?? ""})\n  ${text}`);
    }
  }
  if (failures.length) yield `${failures.join("\n")}\n`;
  yield `tests: ${passed} passed, ${failures.length} failed\n`;
}
