import { test as base, expect } from '@playwright/test';
export { expect };
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => localStorage.setItem('gorodskoy-marshrut:tutorial:v1', JSON.stringify({ version: 1, step: 'done' })));
    await use(page);
  },
});
