/**
 * Build the WebView diff viewer bundle.
 *
 * Bundles webview-diff/index.tsx into a single self-contained HTML file with
 * all JS inlined, then exports it as a TypeScript string constant. The output
 * at assets/diff-viewer.ts is gitignored and imported by DiffWebView.
 *
 * Also builds an unminified debug HTML file (assets/diff-viewer-debug.html)
 * with mock data and ReactNativeWebView stubs for testing in a regular browser
 * with devtools. Also gitignored.
 *
 * Uses a Bun plugin to alias "shiki" to a slim shim (webview-diff/slim-shiki.js)
 * that only includes the languages and themes we need, reducing the bundle
 * from ~10MB to ~3MB.
 *
 * Run with: bun scripts/build-webview-html.ts
 */

import { resolve } from 'path'

const shimPath = resolve(import.meta.dir, '../webview-diff/slim-shiki.js')

const shikiPlugin = {
  name: 'slim-shiki',
  setup(build: any) {
    build.onResolve({ filter: /^shiki$/ }, (args: any) => {
      // Don't redirect when imported from the shim itself
      if (args.importer?.includes('slim-shiki')) return
      return { path: shimPath }
    })
  },
}

// ---------------------------------------------------------------------------
// Production build (minified, exported as TS string constant)
// ---------------------------------------------------------------------------

const result = await Bun.build({
  entrypoints: ['webview-diff/index.tsx'],
  target: 'browser',
  minify: true,
  plugins: [shikiPlugin],
})

if (!result.success) {
  console.error('Build failed:')
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

const rawJs = await result.outputs[0].text()

// Escape </script> inside the JS so it doesn't break the enclosing <script> tag
const js = rawJs.replaceAll('</script>', '<\\/script>')

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #FAFAF9; font-family: monospace; overflow-x: hidden; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
    @media (prefers-color-scheme: dark) { body { background: #0C0A09; } }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>${js}<\/script>
</body>
</html>`

await Bun.write(
  'assets/diff-viewer.ts',
  `// Auto-generated — do not edit. Run: bun scripts/build-webview-html.ts\nexport default ${JSON.stringify(html)};\n`,
)

const sizeMB = (html.length / 1024 / 1024).toFixed(1)
console.log(`Built assets/diff-viewer.ts (${sizeMB} MB)`)

// ---------------------------------------------------------------------------
// Debug build (unminified, standalone HTML with mock data for browser testing)
// ---------------------------------------------------------------------------

const debugResult = await Bun.build({
  entrypoints: ['webview-diff/index.tsx'],
  target: 'browser',
  minify: false,
  plugins: [shikiPlugin],
})

if (!debugResult.success) {
  console.error('Debug build failed:')
  for (const log of debugResult.logs) {
    console.error(log)
  }
  process.exit(1)
}

const debugRawJs = await debugResult.outputs[0].text()
const debugJs = debugRawJs.replaceAll('</script>', '<\\/script>')

const debugHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0C0A09; font-family: monospace; overflow-x: hidden; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    // Stub ReactNativeWebView so postMessage doesn't crash
    window.ReactNativeWebView = {
      postMessage(data) { console.log('[postToNative]', JSON.parse(data)); }
    };

    // Pre-inject mock diffs so the viewer loads immediately
    window.__INITIAL_DIFFS__ = {
      colorScheme: 'dark',
      diffs: [
        {
          file: 'src/app.ts',
          before: 'const greeting = "hello";\\nconsole.log(greeting);\\n\\nfunction add(a, b) {\\n  return a + b;\\n}\\n\\nexport default add;\\n',
          after: 'const greeting = "hello world";\\nconsole.log(greeting);\\nconsole.log("done");\\n\\nfunction add(a: number, b: number): number {\\n  return a + b;\\n}\\n\\nexport function subtract(a: number, b: number): number {\\n  return a - b;\\n}\\n\\nexport default add;\\n',
        },
      ],
    };
  <\/script>
  <script>${debugJs}<\/script>
  <script>
    // Simulate showing the first file after a short delay
    setTimeout(() => {
      window.postMessage(JSON.stringify({ type: 'showFile', file: 'src/app.ts' }));
    }, 500);
  <\/script>
</body>
</html>`

await Bun.write('assets/diff-viewer-debug.html', debugHtml)

const debugSizeMB = (debugHtml.length / 1024 / 1024).toFixed(1)
console.log(`Built assets/diff-viewer-debug.html (${debugSizeMB} MB)`)
