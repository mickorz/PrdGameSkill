#!/usr/bin/env node
// build-html: 从 game-spec 构建离线 Interactive HTML PRD（单文件，数据内嵌，file:// 可运行）
// 用法: node scripts/build-html.mjs <game-spec 目录> <输出目录> [simulator 目录]
// 约束: 输出不依赖在线 API、资源相对路径、无未替换模板变量（导出前需跑 validate-html）
import yaml from "js-yaml";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function walkYamlFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkYamlFiles(p));
    else if (/\.(ya?ml)$/.test(entry.name)) out.push(p);
  }
  return out;
}
const readYaml = (f) => yaml.load(fs.readFileSync(f, "utf8"));

export function collectSpec(specDir) {
  const appData = {
    manifest: readYaml(path.join(specDir, "manifest.yaml")),
    game: {},
    requirements: [],
    ui: { pages: [], components: [], events: [], navigation: null },
    states: [],
    configs: [],
    tests: { cases: [], scenarios: [] },
    reviews: { openQuestions: null, decisionLog: null, completeness: null, consistency: null, approvalState: null },
    sourceMap: null,
    simulator: { enabled: false, code: "" },
  };
  for (const f of ["overview.yaml", "core-loop.yaml", "glossary.yaml"]) {
    const p = path.join(specDir, "game", f);
    if (fs.existsSync(p)) appData.game[f.replace(".yaml", "")] = readYaml(p);
  }
  for (const f of walkYamlFiles(path.join(specDir, "requirements"))) appData.requirements.push(readYaml(f));
  for (const f of walkYamlFiles(path.join(specDir, "data", "configs"))) appData.configs.push(readYaml(f));
  for (const f of walkYamlFiles(path.join(specDir, "requirements", "states"))) appData.states.push(readYaml(f));
  for (const f of walkYamlFiles(path.join(specDir, "ui", "pages"))) appData.ui.pages.push(readYaml(f));
  for (const f of walkYamlFiles(path.join(specDir, "ui", "components"))) appData.ui.components.push(readYaml(f));
  for (const f of walkYamlFiles(path.join(specDir, "ui", "interactions"))) appData.ui.events.push(readYaml(f));
  const nav = path.join(specDir, "ui", "navigation.yaml");
  if (fs.existsSync(nav)) appData.ui.navigation = readYaml(nav);
  for (const f of walkYamlFiles(path.join(specDir, "tests", "cases"))) appData.tests.cases.push(readYaml(f));
  for (const f of walkYamlFiles(path.join(specDir, "tests", "scenarios"))) appData.tests.scenarios.push(readYaml(f));
  for (const name of ["open-questions.json", "decision-log.json", "completeness.json", "consistency.json", "approval-state.json"]) {
    const p = path.join(specDir, "reviews", name);
    if (fs.existsSync(p)) appData.reviews[name.replace(".json", "").replace(/-(\w)/g, (_, c) => c.toUpperCase())] = JSON.parse(fs.readFileSync(p, "utf8"));
  }
  const map = path.join(specDir, "source", "source-map.json");
  if (fs.existsSync(map)) appData.sourceMap = JSON.parse(fs.readFileSync(map, "utf8"));
  return appData;
}

export function build(specDir, outDir, simulatorDir) {
  const appData = collectSpec(specDir);
  if (simulatorDir && fs.existsSync(simulatorDir)) {
    const engine = path.join(simulatorDir, "simulator.js");
    if (fs.existsSync(engine)) {
      appData.simulator.enabled = true;
      appData.simulator.code = fs.readFileSync(engine, "utf8");
    }
  }
  const template = fs.readFileSync(path.join(SCRIPT_DIR, "..", "assets", "html-template", "index.html"), "utf8");
  const dataLiteral = JSON.stringify(appData).replace(/<\/script/g, "<\\/script");
  const html = template.replace("/*__APP_DATA_JSON__*/null", () => dataLiteral);
  if (html.includes("/*__APP_DATA_JSON__*/null")) throw new Error("模板占位符替换失败");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "index.html");
  fs.writeFileSync(outFile, html);
  return outFile;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("用法: node scripts/build-html.mjs <game-spec 目录> <输出目录> [simulator 目录]");
    process.exit(2);
  }
  const outFile = build(args[0], args[1], args[2]);
  console.log("构建完成: " + outFile + " (" + (fs.statSync(outFile).size / 1024).toFixed(1) + " KB)");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
