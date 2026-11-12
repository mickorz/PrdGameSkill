// 一次性分析脚本：核对 UI 交互基准对 42319 代码文件的覆盖度
const fs = require('fs');
const path = require('path');

const CLIENT = 'input-ui/xuanwulobby/assets/42319';
const RULE_DIR = '.claude/skills/ui-interaction-prd-extract/references/rules/hzmj_ui_interaction';

const all = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.ts')) all.push(p.split(path.sep).join('/'));
  }
})(CLIENT);

let ruleText = '';
let clauseTotal = 0;
for (const f of fs.readdirSync(RULE_DIR)) {
  const t = fs.readFileSync(path.join(RULE_DIR, f), 'utf8');
  ruleText += t;
  clauseTotal += (t.match(/^\d+\. /gm) || []).length;
}

const mentioned = all.filter((f) => ruleText.includes(path.basename(f)));
const unmentioned = all.filter((f) => !ruleText.includes(path.basename(f)));

console.log('代码文件总数:', all.length);
console.log('基准中提及的文件数:', mentioned.length);
console.log('未在基准中出现的文件数:', unmentioned.length);
console.log('基准条款总数(编号列表项):', clauseTotal);
console.log();
const dirCount = {};
for (const f of unmentioned) {
  const dir = f.replace(CLIENT + '/', '').split('/').slice(0, 2).join('/');
  dirCount[dir] = (dirCount[dir] || 0) + 1;
}
console.log('未覆盖文件按目录分布:');
Object.entries(dirCount)
  .sort((a, b) => b[1] - a[1])
  .forEach(([d, c]) => console.log(' ', d, c));
console.log();
console.log('未覆盖文件清单(前 30):');
unmentioned.slice(0, 30).forEach((f) => console.log(' ', f.replace(CLIENT + '/', '')));
