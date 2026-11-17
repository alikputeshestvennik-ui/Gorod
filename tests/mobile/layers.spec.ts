import { test, expect } from './fixtures';

const layers = ['demand', 'load', 'complaints'];
for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`независимые слои: все сочетания, редактор и офлайн ${viewport.width}`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Пауза', exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const save = await page.evaluate(() => localStorage.getItem('gorodskoy-marshrut:stage2:v2'));
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Маршруты', exact: true }).click();
    await page.locator('[data-edit="1"]').click();
    const draft = await page.locator('#selection').textContent();
    let previous = 0;
    // Gray code visits all eight combinations by pressing one button at a time.
    for (const mask of [1, 3, 2, 6, 7, 5, 4, 0]) {
      const index = Math.log2(mask ^ previous);
      await page.locator('#layer-' + layers[index]).click();
      const active = layers.filter((_, i) => mask & (1 << i));
      await expect(page.locator('#map')).toHaveAttribute('data-layers', active.join(' '));
      for (const [i, layer] of layers.entries()) {
        const enabled = Boolean(mask & (1 << i));
        const button = page.locator('#layer-' + layer);
        await expect(button).toHaveAttribute('aria-pressed', String(enabled));
        await expect(page.locator(`[data-legend="${layer}"]`)).toBeVisible({ visible: enabled });
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(await page.locator(`.stop-label [data-value="${layer}"]`).evaluateAll(
          (nodes, enabled) => nodes.length > 0 && nodes.every(node => (node as HTMLElement).hidden === !enabled), enabled,
        )).toBe(true);
      }
      await expect(page.locator('#layer-legend')).toBeVisible({ visible: mask !== 0 });
      await expect(page.locator('#selection')).toHaveText(draft!);
      if (mask === 7) {
        // Legend must push the event banner down instead of covering its button.
        const legend = (await page.locator('#layer-legend').boundingBox())!;
        const event = (await page.locator('#event-banner').boundingBox())!;
        expect(event.y).toBeGreaterThanOrEqual(legend.y + legend.height);
        await page.screenshot({ path: `artifacts/layers-combined-editor-${viewport.width}.png` });
      }
      previous = mask;
    }
    // Combined layers stay enabled when closing the editor or opening settings.
    for (const layer of layers) await page.locator('#layer-' + layer).click();
    await page.locator('#cancel').click();
    await page.getByRole('button', { name: 'Карта', exact: true }).click();
    await page.locator('#settings').click();
    await page.locator('#time-of-day').selectOption('night');
    await page.locator('#close').click();
    await expect(page.locator('#map')).toHaveAttribute('data-layers', layers.join(' '));
    await page.locator('#debug-toggle').click();
    await expect(page.locator('#debug')).toHaveText(/^[1-9]\d* FPS/);
    const stats = (await page.locator('#debug').textContent())!;
    console.log(`GRAPHICS_COMBINED_LAYERS_${viewport.width}`, stats);
    const budget = stats.match(/(\d+) calls · (\d+) triangles/)!;
    expect(Number(budget[1])).toBeLessThanOrEqual(150);
    expect(Number(budget[2])).toBeLessThanOrEqual(200000);
    await page.screenshot({ path: `artifacts/layers-combined-night-${viewport.width}.png` });
    expect(await page.evaluate(() => localStorage.getItem('gorodskoy-marshrut:stage2:v2'))).toBe(save);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
