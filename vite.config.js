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
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'Chrome >= 37', 'Android >= 5.0'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      polyfills: [
        'es.symbol',
        'es.array.iterator',
        'es.promise',
        'es.object.assign',
        'es.promise.finally',
        'es.global-this'
      ]
    }),
    autoStartProxyPlugin()
  ],
  build: {
    target: 'es2015',
    minify: 'terser',
    cssTarget: 'chrome37'
  }
})
