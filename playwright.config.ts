import { defineConfig } from '@playwright/test';

const port = Number(process.env.CN_UI_PORT ?? 1421);

export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: true,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: 'msedge',
    headless: true,
    viewport: { width: 1100, height: 760 },
    serviceWorkers: 'block',
  },
  webServer: {
    command: `pnpm preview --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
