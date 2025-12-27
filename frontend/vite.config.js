import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, copyFileSync, mkdirSync, cpSync } from 'fs';

// Получаем __dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  build: {
    outDir: '../public',
    emptyOutDir: false, // Не удалять существующие файлы
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/main.js'),
        profile: resolve(__dirname, 'src/profile.js'),
        card: resolve(__dirname, 'src/card.js'),
        swipe: resolve(__dirname, 'src/swipe.js'),
        match: resolve(__dirname, 'src/match.js'),
        api: resolve(__dirname, 'src/api.js'),
        'user-actions': resolve(__dirname, 'src/user-actions.js'),
        'mock-api': resolve(__dirname, 'src/mock-api.js'),
        'function_descriptions': resolve(__dirname, 'src/function_descriptions.js'),
        'function_ids': resolve(__dirname, 'src/function_ids.js'),
        utils: resolve(__dirname, 'src/utils.js'),
        pro: resolve(__dirname, 'src/pro.js'),
        'pro-modal': resolve(__dirname, 'src/pro-modal.js'),
      },
      output: {
        entryFileNames: 'js/[name].[hash].js',
        chunkFileNames: 'js/chunks/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          // CSS не обрабатывается через Vite, копируется отдельно
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
            return `img/[name].[hash].${ext}`;
          }
          return `[name].[hash].${ext}`;
        },
      },
    },
  },
  publicDir: 'public', // Статические файлы из frontend/public/ будут скопированы в public/
  plugins: [
    {
      name: 'generate-hash-map',
      writeBundle(options, bundle) {
        // Генерируем hash-map.json из bundle
        const hashMap = {};
        
        // Обрабатываем все выходные файлы
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (chunk.type === 'chunk' && chunk.isEntry) {
            // Извлекаем имя без хеша и расширения
            const nameMatch = fileName.match(/^js\/([^.]+)\./);
            if (nameMatch) {
              hashMap[nameMatch[1]] = fileName.replace('js/', '');
            }
          }
          // CSS файлы не обрабатываются через Vite, копируются отдельно
        }
        
        // Записываем hash-map.json
        const hashMapPath = resolve(options.dir || '../public', 'hash-map.json');
        writeFileSync(hashMapPath, JSON.stringify(hashMap, null, 2));
        console.log('✅ Generated hash-map.json');
      }
    },
    {
      name: 'copy-index-html',
      closeBundle() {
        // Копируем index.html в public/ после сборки
        const indexHtmlPath = resolve(__dirname, 'index.html');
        const publicIndexHtmlPath = resolve(__dirname, '../public/index.html');
        try {
          // Создаем директорию public, если её нет
          const publicDir = resolve(__dirname, '../public');
          mkdirSync(publicDir, { recursive: true });
          copyFileSync(indexHtmlPath, publicIndexHtmlPath);
          console.log('✅ Copied index.html to public/');
        } catch (error) {
          console.error('❌ Error copying index.html:', error);
        }
      }
    },
    {
      name: 'copy-css-files',
      closeBundle() {
        // Копируем CSS файлы из src/css/ в public/css/ после сборки
        const cssSourceDir = resolve(__dirname, 'src/css');
        const cssTargetDir = resolve(__dirname, '../public/css');
        try {
          // Создаем директорию, если её нет
          mkdirSync(cssTargetDir, { recursive: true });
          // Копируем всю директорию css
          cpSync(cssSourceDir, cssTargetDir, { recursive: true });
          console.log('✅ Copied CSS files to public/css/');
        } catch (error) {
          console.error('❌ Error copying CSS files:', error);
        }
      }
    }
  ]
});
