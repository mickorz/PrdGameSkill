// build-symbol-index.mjs —— 服务端源码符号索引（确定性扫描，无 LLM）
// 职责：
//   1. 扫描三个只读目录（相对 srcRoot）：game_hzmj/common_game、game_hzmj/hzmj_server、mah_frame，
//      递归 *.h/*.cpp（*.pb.h/*.pb.cc protobuf 生成文件排除，单独计数——访问器噪音占约 2/3），
//      提取四类符号（OSG-W4 S2.0：agent 按 Atom 查索引再按需 read，不遍历目录）：
//      - class/struct 定义（行尾分号的前置声明跳过；template 前缀类不识别，已知限制）
//      - 类方法定义（返回类型可省的 Qualifier::Name(...)，含构造/析构/operator；
//        签名跨行时向后 8 行内「先见 { 后见 ;」才算定义，声明与列首调用以 ; 先到为准被排除）
//      - 自由函数定义（[inline|static|virtual|explicit|constexpr] 返回类型 + 函数名(...)，
//        排除关键字行；模板函数不识别，已知限制）
//      - 配置项 json_key（config.contains("key")，记录所在函数与上方
//        「// key | 类型 | 取值范围 | 默认值 | 说明」注释元数据，供 S2.2 配置默认值核对）
//   2. 落盘 symbol-index.json（UTF-8、1 空格缩进；file 为相对 srcRoot 的正斜杠路径；
//      确定性：文件按路径排序、符号按行序，date 由参数传入）
//   3. query 子命令：按名称/限定名子串查询（可按 kind 过滤），打印 kind + file:line 供定位
// 已知限制（v1）：跨行调用若先见 {（如 lambda 实参）会被误记为定义；字符串字面量中的 {/; 不感知
// 可导入：export buildSymbolIndex / querySymbols（不退进程）
// CLI：
//   node build-symbol-index.mjs build <srcRoot> <outJson> <date>
//   node build-symbol-index.mjs query <indexJson> <term> [class|method|function|config-key]
// 退出码：0 成功；1 参数错误 / 目录缺失 / 无匹配
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// 三目录相对 srcRoot（xiaoshanmj 等 4 个变体不扫，见 T0 调查报告 §1）
const ROOTS = ['game_hzmj/common_game', 'game_hzmj/hzmj_server', 'mah_frame']
const EXTENSIONS = new Set(['.h', '.cpp', '.cc', '.cxx'])
// protobuf 生成文件（*.pb.h / *.pb.cc）是访问器噪音（占符号量约 2/3），不计入索引，单独计数
const GENERATED_RE = /\.pb\.(h|cpp|cc|cxx)$/

// 自由函数名排除的关键字（控制流/转型/宏常見形态，防语句行误判）
const KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'else', 'do', 'case', 'default',
  'sizeof', 'new', 'delete', 'using', 'namespace', 'template', 'typedef', 'decltype',
  'static_cast', 'reinterpret_cast', 'const_cast', 'dynamic_cast', 'throw', 'try',
  'alignof', 'offsetof', 'defined', 'operator', 'friend', 'enum', 'extern',
])

const CLASS_RE = /^(?:class|struct)\s+([A-Za-z_]\w*)/
const METHOD_RE = /^(?:[A-Za-z_][\w:<>,\s\*&]*?\s)?([A-Za-z_]\w*)::((?:~[A-Za-z_]\w*|operator[^\s(]+|[A-Za-z_]\w*))\s*\(/
const FUNCTION_RE = /^(?:inline\s+|static\s+|virtual\s+|explicit\s+|constexpr\s+)*([A-Za-z_][\w:<>,\s\*&]*?)\s+([A-Za-z_]\w*)\s*\(/
const CONFIG_RE = /config\.contains\("([a-z_0-9]+)"\)/g

// 递归收集文件，按相对路径排序保证确定性
const listFiles = (absRoot, relRoot) => {
  const out = []
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name)
      if (ent.isDirectory()) walk(abs)
      else if (EXTENSIONS.has(path.extname(ent.name))) out.push(abs)
    }
  }
  walk(absRoot)
  return out
    .map((abs) => ({ abs, rel: relRoot + '/' + path.relative(absRoot, abs).split(path.sep).join('/') }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
}

// 签名跨行判定：从 startIdx 行起向后最多 8 行，先见 { 为定义，先见 ; 为声明/调用
const looksLikeDefinition = (lines, startIdx) => {
  for (let j = startIdx; j < Math.min(lines.length, startIdx + 8); j++) {
    const brace = lines[j].indexOf('{')
    const semi = lines[j].indexOf(';')
    if (brace >= 0 && (semi < 0 || brace < semi)) return true
    if (semi >= 0) return false
  }
  return false
}

// 配置项元数据：向上最多找 6 行的「// key | 类型 | 取值范围 | 默认值 | 说明」注释
const extractMeta = (lines, lineIdx, key) => {
  const metaRe = new RegExp('^\\s*//\\s*' + key + '\\s*\\|(.*)$')
  for (let j = lineIdx - 1; j >= Math.max(0, lineIdx - 6); j--) {
    const m = lines[j].match(metaRe)
    if (m) {
      const parts = m[1].split('|').map((s) => s.trim())
      return { type: parts[0] || null, range: parts[1] || null, default: parts[2] || null, desc: parts.slice(3).join('|') || null }
    }
  }
  return null
}

export const buildSymbolIndex = (srcRoot, date) => {
  const problems = []
  const absRoot = path.resolve(srcRoot)
  if (!fs.existsSync(absRoot) || !fs.statSync(absRoot).isDirectory()) {
    return { ok: false, problems: ['srcRoot 不是目录：' + absRoot], output: null }
  }
  if (!date) problems.push('缺少 date 参数')

  const all = []
  for (const r of ROOTS) {
    const abs = path.join(absRoot, r)
    if (!fs.existsSync(abs)) problems.push('扫描目录缺失：' + r)
    else all.push(...listFiles(abs, r))
  }
  if (problems.length) return { ok: false, problems, output: null }

  // protobuf 生成文件单独计数不进索引
  const files = []
  let excludedGenerated = 0
  for (const f of all) {
    if (GENERATED_RE.test(path.basename(f.rel))) excludedGenerated++
    else files.push(f)
  }

  const symbols = []
  const stats = { files: files.length, excludedGenerated, classes: 0, methods: 0, functions: 0, configKeys: 0, symbols: 0 }

  for (const f of files) {
    let text = fs.readFileSync(f.abs, 'utf8')
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    const lines = text.split(/\r?\n/)
    let currentFn = null
    const seenConfig = new Set()

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      const t = raw.trim()
      if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('#')) continue

      // 配置项 json_key（全索引仅 game_logic.cpp 有此形态，仍按通用规则扫）
      for (const m of raw.matchAll(CONFIG_RE)) {
        const key = m[1]
        const dedupe = f.rel + '|' + (currentFn || '-') + '|' + key
        if (seenConfig.has(dedupe)) continue
        seenConfig.add(dedupe)
        const entry = { kind: 'config-key', name: key, file: f.rel, line: i + 1, in: currentFn }
        const meta = extractMeta(lines, i, key)
        if (meta) entry.meta = meta
        symbols.push(entry)
        stats.configKeys++
      }

      // class/struct 定义（行尾 ; 的前置声明跳过）
      const cm = t.match(CLASS_RE)
      if (cm) {
        if (!t.endsWith(';')) {
          symbols.push({ kind: 'class', name: cm[1], file: f.rel, line: i + 1 })
          stats.classes++
        }
        continue
      }

      // 类方法定义（列首/返回类型前缀的 Qualifier::Name(...)）
      const mm = t.match(METHOD_RE)
      if (mm) {
        if (looksLikeDefinition(lines, i)) {
          symbols.push({ kind: 'method', qualifier: mm[1], name: mm[2], file: f.rel, line: i + 1 })
          currentFn = mm[1] + '::' + mm[2]
          stats.methods++
        }
        continue
      }

      // 自由函数定义（返回类型 + 函数名(...)）
      const fm = t.match(FUNCTION_RE)
      if (fm && !KEYWORDS.has(fm[2])) {
        if (looksLikeDefinition(lines, i)) {
          symbols.push({ kind: 'function', name: fm[2], file: f.rel, line: i + 1 })
          currentFn = fm[2]
          stats.functions++
        }
      }
    }
  }

  stats.symbols = symbols.length
  const output = { date, srcRoot: absRoot.split(path.sep).join('/'), roots: ROOTS, stats, symbols }
  return { ok: true, problems: [], output }
}

// 查询：term 对 name / qualifier::name 做不区分大小写子串匹配，kind 可选过滤
export const querySymbols = (index, term, kind) => {
  if (!index || !Array.isArray(index.symbols)) return []
  const needle = String(term).toLowerCase()
  return index.symbols.filter((s) => {
    if (kind && s.kind !== kind) return false
    const full = (s.qualifier ? s.qualifier + '::' : '') + s.name
    return full.toLowerCase().includes(needle)
  })
}

const main = () => {
  const [cmd, a, b, c] = process.argv.slice(2)
  if (cmd === 'build') {
    if (!a || !b || !c) {
      console.error('用法：node build-symbol-index.mjs build <srcRoot> <outJson> <date>')
      process.exit(1)
    }
    const r = buildSymbolIndex(a, c)
    if (!r.ok) {
      console.error('[失败] 符号索引构建失败：\n' + r.problems.map((p) => '  - ' + p).join('\n'))
      process.exit(1)
    }
    fs.mkdirSync(path.dirname(path.resolve(b)), { recursive: true })
    fs.writeFileSync(b, JSON.stringify(r.output, null, 1) + '\n', 'utf8')
    const s = r.output.stats
    console.log('[成功] 符号索引已写入 ' + b)
    console.log(
      '  文件 ' + s.files + '（排除 pb 生成 ' + s.excludedGenerated + '）/ class ' + s.classes + ' / 方法 ' + s.methods +
      ' / 自由函数 ' + s.functions + ' / 配置项 ' + s.configKeys + ' / 合计 ' + s.symbols,
    )
    process.exit(0)
  }
  if (cmd === 'query') {
    if (!a || !b) {
      console.error('用法：node build-symbol-index.mjs query <indexJson> <term> [class|method|function|config-key]')
      process.exit(1)
    }
    const index = JSON.parse(fs.readFileSync(a, 'utf8'))
    const hits = querySymbols(index, b, c)
    if (!hits.length) {
      console.error('[失败] 无匹配符号：' + b + (c ? '（kind=' + c + '）' : ''))
      process.exit(1)
    }
    for (const s of hits) {
      const label = (s.qualifier ? s.qualifier + '::' : '') + s.name
      let extra = ''
      if (s.kind === 'config-key') {
        extra = s.meta ? '  in=' + s.in + '  type=' + s.meta.type + '  range=' + s.meta.range + '  default=' + s.meta.default : '  in=' + s.in
      }
      console.log('[' + s.kind + '] ' + label + '  ' + s.file + ':' + s.line + extra)
    }
    console.log('共 ' + hits.length + ' 条匹配')
    process.exit(0)
  }
  console.error('用法：node build-symbol-index.mjs build <srcRoot> <outJson> <date> | query <indexJson> <term> [kind]')
  process.exit(1)
}

// 直接运行（非被 import）才执行 CLI
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
