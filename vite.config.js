import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig({
  base: '/qwebRE/',
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
    })
  ],
  build: {
    // Keep modern bundle conservative for embedded WebView engines.
    target: 'es2015',
    minify: 'terser',
    cssTarget: 'chrome30'
  }
})
