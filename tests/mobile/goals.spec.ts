import { test, expect } from './fixtures';
import { createWorld } from '../../src/sim/world';
import { GOALS } from '../../src/sim/goals';
const key = 'gorodskoy-marshrut:stage2:v2';

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 640 }]) {
  test(`три задачи, объяснение, черновик, награда и сохранение ${viewport.width}`, async ({ page, context }) => {
    await page.setViewportSize(viewport); await page.goto('/');
    await page.getByRole('button', { name: 'Пауза', exact: true }).click();
    await expect(page.locator('#goal-board article')).toHaveCount(3);
    for (const slot of ['quick', 'medium', 'long']) {
      const card = page.locator(`[data-goal-slot="${slot}"]`);
      await expect(card).toBeVisible();
      expect(await card.evaluate(el => {
        const b = el.getBoundingClientRect();
        return b.x >= 0 && b.y >= 0 && b.right <= innerWidth && b.bottom <= innerHeight && el.scrollWidth <= el.clientWidth;
      })).toBe(true);
    }
    await page.screenshot({ path: `artifacts/goals-${viewport.width}.png` });
    for (const slot of ['medium','long']) {
      await page.locator('#goal-open-'+slot).click();
      await expect(page.locator('#modal')).toContainText(slot === 'medium' ? 'только новые перевозки' : 'одновременно обслуживаться');
      await page.locator('#close').click();
    }
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const initial = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
    const title = await page.locator('#demand-direction').textContent();
    await page.locator('#demand-suggest').click(); await expect(page.locator('#selection button')).toHaveCount(2);
    await page.locator('#cancel').click(); await page.getByRole('button', { name: 'Карта', exact: true }).click();
    await expect(page.locator('#goal-count-quick')).toHaveText('0 / 1');
    await expect(page.locator('#demand-direction')).toHaveText(title!);
    await page.locator('#demand-suggest').click(); await page.locator('#confirm').click();
    await expect(page.locator('#goal-celebration')).toContainText('выполнено! +2 500 ₽');
    await page.getByRole('button', { name: 'Карта', exact: true }).click();
    await expect(page.locator('#demand-direction')).not.toHaveText(title!);
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
    expect(saved.goals.completed).toBe(1); expect(saved.goals.earned).toBe(GOALS.quick.reward);
    expect(saved.money).toBe(initial.money - 4000 + GOALS.quick.reward);
    await context.setOffline(false); await page.reload();
    await expect(page.locator('#goal-board article')).toHaveCount(3);
    await expect(page.locator('#goal-celebration')).toBeHidden();
    const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
    expect(restored.goals).toEqual(saved.goals);
    await page.locator('#debug-toggle').click();
    await expect(page.locator('#engagement-debug')).toContainText('Наград: 0 · активных задач: 3');
  });
}

test('перевозки завершают задачу без нажатий, показывают награду и обнуляют новый прогресс', async ({ page }) => {
  const w = createWorld(); w.served = GOALS.medium.passengers - 1;
  await page.addInitScript(({key,w}) => localStorage.setItem(key, JSON.stringify(w)), {key,w});
  await page.goto('/'); await page.locator('#debug-toggle').click();
  await expect(page.locator('#goal-celebration')).toContainText('выполнено! +6 000 ₽');
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await expect(page.locator('#engagement-debug')).toContainText('Наград: 1 · активных задач: 3');
  expect(Number(await page.locator('#goal-progress-medium').getAttribute('value'))).toBeLessThan(10);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved.goals.completed).toBe(1); expect(saved.goals.active[1].baseline).toBeGreaterThanOrEqual(GOALS.medium.passengers);
});
