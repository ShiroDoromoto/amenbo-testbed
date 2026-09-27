import preact from '@preact/preset-vite';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  // GitHub Pages では https://<owner>.github.io/amenbo-testbed/ で配信する。開発サーバーは / のまま。
  base: command === 'build' ? '/amenbo-testbed/' : '/',
  plugins: [preact()],
  test: {
    environment: 'jsdom',
    // e2e/ は Playwright で回す。
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // 既定では CSS の中身が空になる。?raw で読む CSS だけ中身を残す（tokens.test.ts が使う）。
    css: { include: /\.css\?raw$/ },
  },
}));
