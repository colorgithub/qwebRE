import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

// 获取当前文件的目录路径
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 创建自动启动代理服务器的插件
function autoStartProxyPlugin() {
  return {
    name: 'auto-start-proxy',
    configureServer(server) {
      // 在开发服务器启动时启动代理
      const proxyPath = path.resolve(__dirname, 'image-proxy.cjs')
      console.log('Starting image proxy server...')
      
      // 使用 spawn 启动 Node.js 进程
      const proxyProcess = spawn('node', [proxyPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      })
      
      proxyProcess.stdout.on('data', (data) => {
        console.log(`[Proxy] ${data.toString().trim()}`)
      })
      
      proxyProcess.stderr.on('data', (data) => {
        console.error(`[Proxy Error] ${data.toString().trim()}`)
      })
      
      proxyProcess.on('close', (code) => {
        console.log(`Proxy server exited with code ${code}`)
      })
      
      // 在服务器关闭时清理代理进程
      server.httpServer.on('close', () => {
        console.log('Stopping proxy server...')
        proxyProcess.kill()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    legacy({
      // Cover older Android System WebView (KitKat era).
      targets: ['Chrome >= 30', 'Android >= 4.4'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      polyfills: [
        'es.symbol',
        'es.array.iterator',
        'es.array.filter',
        'es.array.map',
        'es.array.reduce',
        'es.array.find',
        'es.array.includes',
        'es.promise',
        'es.object.assign',
        'es.object.keys',
        'es.promise.finally',
        'es.global-this',
        'es.string.includes',
        'es.string.starts-with',
        'es.string.ends-with'
      ]
    }),
    autoStartProxyPlugin()
  ],
  build: {
    // Keep modern bundle conservative for embedded WebView engines.
    target: 'es2015',
    minify: 'terser',
    cssTarget: 'chrome30'
  }
})
