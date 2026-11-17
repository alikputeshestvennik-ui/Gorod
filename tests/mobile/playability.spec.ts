import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`редактор: пустое место двигает карту, слои доступны ${viewport.width}`, async ({ page, context }) => {
    await page.setViewportSize(viewport); await page.goto('/');
    await page.getByRole('button', { name: 'Пауза', exact: true }).click();
    await page.getByRole('button', { name: 'Маршруты', exact: true }).click();
    await page.locator('[data-edit="1"]').click();
    for (const id of ['rotate-left','rotate-right','zoom-in','zoom-out','recenter']) {
      expect(await page.locator('#'+id).evaluate(el=>{
        const b=el.getBoundingClientRect();
        return b.x>=0&&b.y>=0&&b.right<=innerWidth&&b.bottom<=innerHeight&&
          el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));
      }), `camera button ${id} is reachable`).toBe(true);
    }
    const draft = await page.locator('#selection').textContent();
    const stop = page.getByRole('button', { name: 'Больница', exact: true });
    const before = (await stop.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    // The left edge is empty ground in both orientations, outside map tools.
    const y = viewport.height === 390 ? 300 : 340;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 4, y, id: 1 }] });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: 4 + i * 7, y: y - i * 3, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => Math.abs((await stop.boundingBox())!.x - before.x)).toBeGreaterThan(10);
    await expect(page.locator('#selection')).toHaveText(draft!);
    for (const layer of ['demand', 'load', 'complaints']) await page.locator('#layer-' + layer).click();
    await expect(page.locator('#map')).toHaveAttribute('data-layers', 'demand load complaints');
    await page.locator('#zoom-in').click(); await page.locator('#recenter').click();
    await expect(page.locator('#selection')).toHaveText(draft!);
    await page.screenshot({ path: `artifacts/editor-pan-${viewport.width}.png` });
  });
}

test('спрос объясняет направления и создаёт только черновик; темп измеряется офлайн', async ({ page, context }) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#debug-toggle').click();
  await expect(page.locator('#demand-direction')).toContainText('→');
  await expect(page.locator('#demand-direction')).toContainText('поездок/ч');
  await page.locator('#demand-details').click();
  await expect(page.locator('#modal .city-district')).toHaveCount(5);
  await expect(page.locator('#modal')).toContainText('Спрос не равен очереди');
  await page.locator('#close').click();
  await context.setOffline(true);
  await expect(page.locator('#engagement-debug')).toContainText('активных задач: 0');
  await page.waitForTimeout(22000);
  await expect(page.locator('#engagement-debug')).toContainText('Событий: 1');
  const baseline = await page.locator('#engagement-debug').textContent();
  console.log('PACING_BEFORE_DECISION', baseline);
  await page.locator('#demand-suggest').click();
  await expect(page.locator('#selection button')).toHaveCount(2);
  await page.locator('#confirm').click();
  await expect(page.locator('.route-card')).toHaveCount(2);
  await expect(page.locator('#engagement-debug')).toContainText(/без решения: [0-2] с/);
  await page.getByRole('button', { name: 'Карта', exact: true }).click();
  // Measure roughly one minute of active foreground play at ×1.
  await page.waitForTimeout(40000);
  const after = await page.locator('#engagement-debug').textContent();
  console.log('PACING_AFTER_DECISION', after);
  console.log('GRAPHICS_PLAYABILITY', await page.locator('#debug').textContent());
  await page.screenshot({ path: 'artifacts/playability-demand-pacing.png' });
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.waitForTimeout(600);
  const paused = await page.locator('#engagement-debug').textContent();
  await page.waitForTimeout(1100);
  await expect(page.locator('#engagement-debug')).toHaveText(paused!);
  await page.getByRole('button', { name: 'Скорость 4', exact: true }).click();
  await expect(page.locator('[data-speed="4"]')).toHaveClass('active');
  expect(errors).toEqual([]);
});
