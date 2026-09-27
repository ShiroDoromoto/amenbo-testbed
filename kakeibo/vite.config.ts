import preact from '@preact/preset-vite';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [preact()],
  test: {
    environment: 'jsdom',
    // e2e/ は Playwright で回す。
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
