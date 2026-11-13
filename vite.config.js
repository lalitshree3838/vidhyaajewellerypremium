import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiMiddleware } from './api-middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function copyDirRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function staticAssetsPlugin() {
  return {
    name: 'copy-static-assets-to-dist',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      // Directories that must be available in production deployment
      const directories = ['categories', 'products', 'videos', 'data', 'api'];
      for (const dir of directories) {
        const srcDir = path.resolve(__dirname, dir);
        const destDir = path.resolve(outDir, dir);
        if (fs.existsSync(srcDir)) {
          copyDirRecursiveSync(srcDir, destDir);
        }
      }

      // Root media assets and server config
      const files = [
        '.htaccess',
        'google-pay-logo.svg',
        'google-pay-mark.svg',
        'hero section image.png',
        'hero-section-image-final.jpg',
        'vidhyaa-home-hero.jpg'
      ];
      for (const file of files) {
        const srcFile = path.resolve(__dirname, file);
        const destFile = path.resolve(outDir, file);
        if (fs.existsSync(srcFile)) {
          fs.copyFileSync(srcFile, destFile);
        }
      }

      // Copy assets directory contents to dist/assets
      const srcAssets = path.resolve(__dirname, 'assets');
      const destAssets = path.resolve(outDir, 'assets');
      if (fs.existsSync(srcAssets)) {
        fs.mkdirSync(destAssets, { recursive: true });
        const assetEntries = fs.readdirSync(srcAssets, { withFileTypes: true });
        for (const entry of assetEntries) {
          if (!entry.isDirectory()) {
            const destPath = path.join(destAssets, entry.name);
            fs.copyFileSync(path.join(srcAssets, entry.name), destPath);
          }
        }
      }
    }
  };
}

function apiServerPlugin() {
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      server.middlewares.use(handleApiMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleApiMiddleware);
    }
  };
}

export default defineConfig({
  plugins: [apiServerPlugin(), staticAssetsPlugin()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    watch: {
      ignored: ['**/videos/**', '**/data/**', '**/api/**', '**/dist/**', '**/scripts/**']
    }
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 12000,
  }
});
