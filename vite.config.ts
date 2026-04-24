import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Plugin to proxy external image URLs (avoids CORS for MiniMax/Aliyun OSS)
function corsImageProxy() {
  return {
    name: 'cors-image-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/proxy-image', async (req: any, res: any) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const imageUrl = url.searchParams.get('url');
          if (!imageUrl) {
            res.statusCode = 400;
            res.end('Missing url parameter');
            return;
          }
          const response = await fetch(imageUrl);
          if (!response.ok) {
            res.statusCode = response.status;
            res.end(`Upstream error: ${response.statusText}`);
            return;
          }
          const buffer = Buffer.from(await response.arrayBuffer());
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.end(buffer);
        } catch (e: any) {
          res.statusCode = 500;
          res.end(`Proxy error: ${e.message}`);
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), tailwindcss(), corsImageProxy()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
