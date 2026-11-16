#!/usr/bin/env node
/**
 * 编码检测 + GBK→UTF-8 归一化副本生成（客户端代码目录混有 UTF-8/GBK 文件，乱码禁止直接提取事实）
 * 用法: node normalize-gbk.mjs <file> [file...]
 * 输出: 每个文件一行——`utf-8  <原路径>`（可直接 Read）或 `gbk    <副本路径> (源: <原路径>)`（副本为 UTF-8，Read 副本）
 * 副本写入 <tmp>/opencode/gbk-normalized/<basename>
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const outDir = path.join(os.tmpdir(), "opencode", "gbk-normalized");
fs.mkdirSync(outDir, { recursive: true });

for (const file of process.argv.slice(2)) {
    if (!fs.existsSync(file)) {
        console.log(`MISSING  ${file}`);
        continue;
    }
    const bytes = fs.readFileSync(file);
    let isUtf8 = true;
    try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        isUtf8 = false;
    }
    if (isUtf8) {
        console.log(`utf-8    ${file}`);
        continue;
    }
    let text;
    try {
        text = new TextDecoder("gbk").decode(bytes);
    } catch (err) {
        console.log(`UNSUPPORTED  ${file}  (${err.message})`);
        continue;
    }
    const copy = path.join(outDir, path.basename(file));
    fs.writeFileSync(copy, text, "utf-8");
    console.log(`gbk      ${copy}  (源: ${file})`);
}
