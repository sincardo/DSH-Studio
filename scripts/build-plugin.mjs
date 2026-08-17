import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const id = 'dsh-studio-appearance'

// 客户端 bundle 必须包装为 __ModuleLoader__.load({ id, factory }) 的 CJS 工厂形式
// （模块系统原样供应文件，裸 ESM 无法注册，会报 "loaded without registering"）。
await build({
  entryPoints: [path.join(root, 'plugins/dsh-studio-appearance/src/client.tsx')],
  bundle: true,
  outfile: path.join(root, 'plugins/dsh-studio-appearance/lib/client.js'),
  format: 'cjs',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  banner: {
    js: `window.__ModuleLoader__.load({\n\tid: "${id}",\n\tfactory: (require) => {\n\t\tvar module = { exports: {} };\n\t\tvar exports = module.exports;\n\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });\n`
  },
  footer: {
    js: `\n\t\treturn module.exports;\n\t}\n});\n`
  },
  sourcemap: false,
  logLevel: 'info'
})

console.log('[build-plugin] dsh-studio-appearance client 构建完成（CJS 工厂包装）')
