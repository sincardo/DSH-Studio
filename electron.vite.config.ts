import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        // preload 必须为 CJS（沙箱化 preload 不支持 ESM），输出为 .cjs
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  }
})
