import "dotenv/config";
import { defineConfig } from 'vitest/config';
import path from 'path';
import { testDatabaseUrl } from './tests/test-database-url';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // A separate Postgres database, force-reset and seeded per run (tests/global-setup.ts);
    // never the dev or production database. Set TEST_DATABASE_URL to point at it.
    env: { DATABASE_URL: testDatabaseUrl() },
    globalSetup: ['./tests/global-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
