import { test, expect } from '@playwright/test';
const tutorialKey='gorodskoy-marshrut:tutorial:v1';
for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  test(`обучение действиями: новая линия, продление и повтор без сброса ${viewport.width}`,async({page})=>{
    await page.setViewportSize(viewport);
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('#app')).toHaveAttribute('data-tutorial-step','welcome');
    await page.screenshot({path:`artifacts/tutorial-welcome-${viewport.width}.png`});
    await page.locator('[data-tutorial="next"]').click();
    await page.locator('[data-tutorial="next"]').click();
    await page.locator('#layer-demand').click();
    await expect(page.locator('#app')).toHaveAttribute('data-tutorial-step','plan');
    await page.locator('#demand-suggest').click();
    await expect(page.locator('#app')).toHaveAttribute('data-tutorial-step','build');
    await page.screenshot({path:`artifacts/tutorial-build-${viewport.width}.png`});
    await page.locator('#confirm').click();
    await expect(page.locator('#app')).toHaveAttribute('data-tutorial-step','layers');
    // Return to map so the real controls are visible above the panel.
    await page.locator('[data-tab="map"]').click();
    await page.locator('#layer-load').click();await page.locator('#layer-complaints').click();
    await page.locator('[data-tab="finance"]').click();
    await expect(page.locator('#app')).toHaveAttribute('data-tutorial-step','extend');
    await page.locator('[data-tab="routes"]').click();await page.locator('[data-extend="1"]').click();
    await expect(page.locator('#app')).toHaveAttribute('data-tutorial-step','extendBuild');
    await expect(page.locator('#confirm')).toBeDisabled();
    await page.getByRole('button',{name:'Больница',exact:true}).click();
    await expect(page.locator('#selection .draft-added')).toHaveCount(1);
    await page.screenshot({path:`artifacts/tutorial-extend-${viewport.width}.png`});
    await page.locator('#confirm').click();
    await expect(page.locator('#app')).toHaveAttribute('data-tutorial-step','ready');
    await page.locator('[data-tutorial="next"]').click();
    await expect(page.locator('#tutorial')).toBeHidden();
    await page.getByRole('button',{name:'Пауза',exact:true}).click();
    await page.reload();await expect(page.locator('#tutorial')).toBeHidden();
    await page.locator('#help').click();await page.locator('#tutorial-replay').click();
    await expect(page.locator('#tutorial')).toBeVisible();
    await page.locator('[data-tutorial="skip"]').click();
    await page.locator('[data-tab="routes"]').click();await expect(page.locator('.route-card')).toHaveCount(2);
    expect(errors).toEqual([]);
  });
}
test('возобновляет обучение, отменяет черновик при выходе и переживает офлайн',async({page,context})=>{
  await page.goto('/');await page.locator('[data-tutorial="next"]').click();
  await page.reload();await expect(page.locator('#app')).toHaveAttribute('data-tutorial-step','camera');
  await context.setOffline(true);await page.locator('[data-tutorial="next"]').click();
  await page.locator('#layer-demand').click();await page.locator('#demand-suggest').click();
  await page.locator('[data-tutorial="skip"]').click();
  await expect(page.locator('#build-bar')).toBeHidden();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).step,tutorialKey)).toBe('done');
});
