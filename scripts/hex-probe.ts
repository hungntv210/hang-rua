/**
 * Kính lúp hex: xem byte quanh một chuỗi hoặc quanh một offset.
 *
 *   npx tsx scripts/hex-probe.ts <file> str "PlayerID" [số lần]
 *   npx tsx scripts/hex-probe.ts <file> at 11783594 [số byte]
 *
 * Công cụ dò định dạng, không phải phần của ứng dụng. Giữ lại trong repo vì lần
 * sau muốn hiểu thêm một vùng nào đó thì cần đúng thứ này.
 */

import { readFileSync } from "node:fs";

function dump(bytes: Uint8Array, start: number, length: number): void {
  const from = Math.max(0, start);
  const to = Math.min(bytes.length, start + length);

  for (let line = from; line < to; line += 16) {
    const end = Math.min(line + 16, to);
    let hex = "";
    let ascii = "";
    for (let i = line; i < end; i += 1) {
      hex += bytes[i].toString(16).padStart(2, "0").toUpperCase() + " ";
      const b = bytes[i];
      ascii += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".";
    }
    console.log(
      `${line.toString().padStart(10)}  ${hex.padEnd(48)} |${ascii}|`,
    );
  }
}

function findAll(bytes: Uint8Array, needle: string, limit: number): number[] {
  const pat = new Uint8Array(needle.length);
  for (let i = 0; i < needle.length; i += 1) pat[i] = needle.charCodeAt(i);

  const hits: number[] = [];
  for (let i = 0; i <= bytes.length - pat.length && hits.length < limit; i += 1) {
    if (bytes[i] !== pat[0]) continue;
    let j = 1;
    while (j < pat.length && bytes[i + j] === pat[j]) j += 1;
    if (j === pat.length) hits.push(i);
  }
  return hits;
}

const [, , path, mode, arg, extra] = process.argv;
const file = readFileSync(path);
const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);

if (mode === "str") {
  const limit = extra ? Number(extra) : 3;
  const hits = findAll(bytes, arg, limit);
  console.log(`"${arg}": ${hits.length} lần (giới hạn ${limit})\n`);
  for (const hit of hits) {
    console.log(`--- offset ${hit} ---`);
    dump(bytes, hit - 32, 32 + arg.length + 48);
    console.log();
  }
} else if (mode === "at") {
  dump(bytes, Number(arg), extra ? Number(extra) : 256);
} else {
  console.log("mode phải là 'str' hoặc 'at'");
}
