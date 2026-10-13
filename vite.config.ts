import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, Plugin } from 'vite';
import pkg from './package.json';

// ビルド・デプロイ実行日 (JST: YYYY-MM-DD)
const getBuildDateTime = () => {
  try {
    const jstFormatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return jstFormatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

// LINT.IfChange(aistudio_media_plugin)
function aistudioMediaPlugin(): Plugin {
  return {
    name: 'vite-plugin-aistudio-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/assets/aistudio/')) {
          const rawPath = req.url.split('?')[0].split('#')[0];
          try {
            const decodedPath = decodeURIComponent(rawPath);
            const relativePath = decodedPath.replace(/^\//, '');
            const aistudioDir = path.resolve(
              __dirname,
              'public',
              'assets',
              'aistudio',
            );
            const filePath = path.resolve(__dirname, 'public', relativePath);
            if (
              filePath.startsWith(aistudioDir + path.sep) &&
              fs.existsSync(filePath) &&
              fs.statSync(filePath).isFile()
            ) {
              const ext = path.extname(filePath).toLowerCase();
              const mimeMap: Record<string, string> = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.bmp': 'image/bmp',
                '.ico': 'image/x-icon',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogv': 'video/ogg',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.pdf': 'application/pdf',
              };
              res.setHeader(
                'Content-Type',
                mimeMap[ext] || 'application/octet-stream',
              );
              res.setHeader('Cache-Control', 'no-cache');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch {
            // Fall through if URI decoding or file access fails
          }
        }
        next();
      });
    },
  };
}
// LINT.ThenChange(//depot/google3/java/com/google/alkali/boq/makersuite/applet_dev_service/templates/initializers/react_theme/vite.config.ts:aistudio_media_plugin)

function versionManifestPlugin(): Plugin {
  return {
    name: 'vite-plugin-version-manifest',
    closeBundle() {
      try {
        const pkgPath = path.resolve(__dirname, 'package.json');
        let version = '1.1.0';
        if (fs.existsSync(pkgPath)) {
          const data = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          if (data.version) version = data.version;
        }
        const buildDate = getBuildDateTime();
        const manifest = {
          version,
          buildDate,
          builtAt: new Date().toISOString(),
        };
        const manifestJson = JSON.stringify(manifest, null, 2) + '\n';

        const distDir = path.resolve(__dirname, 'dist');
        if (fs.existsSync(distDir)) {
          fs.writeFileSync(path.join(distDir, 'version.json'), manifestJson, 'utf-8');
          const distPkg = {
            name: 'react-example',
            version,
            type: 'module',
          };
          fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify(distPkg, null, 2) + '\n', 'utf-8');
        }

        const publicDir = path.resolve(__dirname, 'public');
        if (fs.existsSync(publicDir)) {
          fs.writeFileSync(path.join(publicDir, 'version.json'), manifestJson, 'utf-8');
        }
      } catch (e) {
        console.error('[VersionManifestPlugin] Failed to write version manifest:', e);
      }
    },
  };
}

const getPackageVersion = (): string => {
  try {
    const pkgPath = path.resolve(__dirname, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const data = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (data.version) return data.version;
    }
  } catch {}
  return '1.1.0';
};

export default defineConfig(() => {
  const currentVersion = getPackageVersion();
  const buildDate = getBuildDateTime();
  return {
    plugins: [react(), tailwindcss(), aistudioMediaPlugin(), versionManifestPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(currentVersion),
      __APP_BUILD_DATE__: JSON.stringify(buildDate),
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
