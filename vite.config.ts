import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import dns from 'dns'
import { readFileSync } from 'node:fs'

dns.setDefaultResultOrder('verbatim');

const manifest = JSON.parse(readFileSync('./public/manifest.json', 'utf-8'));

function cacheBustPlugin(): Plugin {
  return {
    name: 'cache-bust-html',
    enforce: 'post',
    transformIndexHtml(html) {
      const ts = Date.now();
      return html.replace(/(src|href)="([^"]+\.(js|css))"/g, (_m, attr, url) => `${attr}="${url}?v=${ts}"`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cacheBustPlugin()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(manifest.version || '0.0.0') },
  server: {
    port: 3000,
    cors: true,
  },
})
