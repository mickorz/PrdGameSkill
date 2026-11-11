# chrome-use download-url 下载弹确认窗问题

## 问题现象

用 `chrome-use download-url <url> <path>` 下载飞书缺陷附件/图片时，Chrome 每次都弹出"保存文件"确认对话框（选择保存位置），必须手动点击才能继续，批量下载 200+ 张图无法自动化。

## 排查过程

1. `chrome-use download-url --help`：该命令通过 ab-connect 触发 Chrome 原生下载流程，`<path>` 只是下载完成后把文件移动过去。
2. Chrome 原生下载是否弹窗由浏览器设置控制：设置 -> 下载 -> "下载前询问每个文件的保存位置"（Ask where to save each file before downloading）。该开关开启时，任何来源的下载（包括 CDP 触发的）都会弹保存对话框。
3. CDP 有 `Browser.setDownloadBehavior`（behavior=allow + downloadPath）可绕过该设置，但 chrome-use CLI 未暴露此配置，无法从命令行关闭弹窗。

## 根因

`download-url` 走的是 Chrome 原生下载管线，受用户"下载前询问保存位置"设置约束；chrome-use 没有提供关闭该行为 的接口，所以每次下载必然弹窗等人工确认。

## 解决方案

不走 Chrome 下载机制，改用 `chrome-use eval` 在页面上下文里 `fetch`（自带登录态 cookies）拿图片字节，转 base64 返回给 CLI，再在本地解码写盘。全程零弹窗：

```bash
# 1. 页面内 fetch 转 base64（脚本文件避免 shell 转义问题）
cat > /tmp/fetch-img.js << 'EOF'
(async () => {
  const r = await fetch("<图片URL>", {credentials: 'include'});
  const bytes = new Uint8Array(await r.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
})()
EOF

# 2. eval 执行并以 JSON 输出（stdout 重定向，注意 Windows Python 的路径映射）
chrome-use eval --file /tmp/fetch-img.js --json > /tmp/eval-out.json

# 3. 本地解码写盘
python - << 'PYEOF'
import json, base64
d = json.load(open(r'C:\Users\<用户>\AppData\Local\Temp\eval-out.json', encoding='utf-8'))
data = base64.b64decode(d['data']['result'])
open(r'E:\...\out.jpg', 'wb').write(data)
PYEOF
```

已验证规模：
- 34KB 描述截图：base64 45,776 字符，完整传出，解码后字节一致
- 632KB 附件 JPG：base64 843,652 字符，完整传出，解码后 632,738 字节与 `download-url` 人工确认下载的结果完全一致

## 预防/注意事项

1. **git-bash /tmp 与 Windows Python 路径不通**：`--json > /tmp/x.json` 写的是 git-bash 的 /tmp（实际映射 `C:\Users\<用户>\AppData\Local\Temp`），Windows 原生 Python 打不开 `/tmp/x.json`，需用 Windows 路径读取。
2. **JSON 结构**：eval --json 返回 `{success, data: {origin, result}, error, timing}`，base64 在 `data.result`。
3. **图片真实格式**：飞书 goapi 链接下载的内容实际格式以 `file` 命令检测结果为准（.png 后缀可能实际是 JPEG），批量保存时按文件头魔数判断扩展名。
4. **超大文件上限**：base64 走 CDP 消息回传，单次 eval 已验证 843KB 字符串无截断；超过几 MB 的附件建议先取长度再分块取回（window 变量缓存 + slice 分段）。
5. **URL 时效**：飞书 goapi 下载链接带签名，随页面会话生成；需在缺陷详情页打开的同一 session 里抓取页面上的 img src 再 fetch，不要复用隔天导出的 xlsx 里的旧链接（xlsx 里的附件链接已过期 403/404 时需回详情页重新取）。
