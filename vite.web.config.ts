import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'web'),
  base: '/',
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, 'web/dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        // Critical for SSE: disable response buffering so streams flow directly
        selfHandleResponse: true,
        on: {
          proxyReq: (proxyReq, req, res) => {
            proxyReq.on('error', (err) => {
              console.error('[vite proxy] proxyReq error:', err);
              if (!res.headersSent) {
                res.writeHead(502);
              }
              res.end();
            });
          },
          proxyRes: (proxyRes, req, res) => {
            // Pipe the response directly without buffering
            proxyRes.on('error', (err) => {
              console.error('[vite proxy] proxyRes error:', err);
            });
            // Copy headers
            const rawHeaders = proxyRes.rawHeaders;
            for (let i = 0; i < rawHeaders.length; i += 2) {
              res.setHeader(rawHeaders[i], rawHeaders[i + 1]);
            }
            res.writeHead(proxyRes.statusCode);
            proxyRes.pipe(res);
          },
          error: (err, req, res) => {
            console.error('[vite proxy] error:', err);
            if (!res.headersSent) {
              res.writeHead(502);
            }
            res.end();
          },
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'web/src'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    exclude: ['lucide-react'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
});
