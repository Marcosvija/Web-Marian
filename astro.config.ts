import { defineConfig } from 'astro/config';

const useTestFixtures = process.env.WEB_MARIAN_CONTENT_FIXTURES === '1';

export default defineConfig({
  output: 'static',
  cacheDir: useTestFixtures ? './node_modules/.astro-fixtures/' : './node_modules/.astro/',
  build: {
    format: 'directory',
  },
});
