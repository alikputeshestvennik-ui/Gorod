import { test, expect } from './fixtures';
const key='gorodskoy-marshrut:stage2:v2';
for(const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:640}]){
  test(`свободная карта, автопарк над черновиком и автобус с первого дня ${viewport.width}`,async({page,context})=>{
    await page.setViewportSize(viewport);await page.goto('/');
    await page.getByRole('button',{name:'Пауза',exact:true}).click();
    await expect(page.locator('#goal-board')).toBeHidden();
    await expect(page.locator('#satisfaction')).toBeHidden();
    if(viewport.width>viewport.height)expect((await page.locator('.zoom').boundingBox())!.x).toBeGreaterThan(viewport.width*.8);
    await page.locator('#stats-toggle').click();await expect(page.locator('#satisfaction')).toBeVisible();
    await page.locator('#stats-toggle').click();
    await page.locator('#debug-toggle').click();await expect(page.locator('#debug')).toBeVisible();
    await expect(page.locator('#engagement-debug')).toBeHidden();
    await page.screenshot({path:`artifacts/compact-map-${viewport.width}.png`});
    await page.locator('[data-tab="routes"]').click();await page.locator('[data-assign="1"]').click();
    await page.locator('[data-action="build"]').click();
    await expect(page.locator('#draft-mode')).toHaveValue('marshrutka');
    if(viewport.width>viewport.height){
      const cdp=await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:300,id:1}]});
      for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200-i*20,y:300,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await expect.poll(async()=>(await page.getByRole('button',{name:'Заречье',exact:true}).boundingBox())!.x).toBeLessThan(400);
    }
    await page.getByRole('button',{name:'Больница',exact:true}).click();
    await page.getByRole('button',{name:'Заречье',exact:true}).click();
    await expect(page.locator('#confirm')).toBeDisabled();
    const draft=await page.locator('#selection').textContent();
    await page.locator('#draft-fleet').click();
    await expect(page.locator('#build-bar')).toBeHidden();
    await expect(page.locator('aside')).toBeVisible();
    await page.locator('[data-buy="bus"]').click();
    await expect(page.locator('[data-plan="bus"]')).toBeVisible();
    await page.screenshot({path:`artifacts/compact-fleet-${viewport.width}.png`});
    await page.locator('[data-tab="map"]').click();
    await expect(page.locator('#selection')).toHaveText(draft!);
    await page.locator('#draft-mode').selectOption('bus');
    await expect(page.locator('#confirm')).toBeEnabled();await page.locator('#confirm').click();
    await expect(page.locator('.route-card').nth(1)).toContainText('Автобус');
    await page.locator('[data-remove="2"]').click();await page.locator('#remove-confirm').click();
    await page.locator('[data-change-mode="1:bus"]').click();
    await expect(page.locator('.route-card')).toContainText('Автобус');
    await expect(page.locator('.route-card')).toContainText('Машин: 1');
    await page.reload();await page.locator('[data-tab="routes"]').click();
    await expect(page.locator('.route-card')).toContainText('Автобус');
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);
    expect(saved.routes[0].mode).toBe('bus');expect(saved.routes[0].vehicles).toBe(1);
    expect(saved.fleets.marshrutka).toBe(2);
  });
}
test('автопарк сразу создаёт автобусный черновик',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Пауза',exact:true}).click();
  await page.locator('[data-tab="fleet"]').click();await page.locator('[data-buy="bus"]').click();
  await page.locator('[data-plan="bus"]').click();
  await expect(page.locator('aside')).toBeHidden();await expect(page.locator('#draft-mode')).toHaveValue('bus');
  await page.getByRole('button',{name:'Больница',exact:true}).click();await page.getByRole('button',{name:'Заречье',exact:true}).click();
  await page.locator('#confirm').click();await expect(page.locator('.route-card').nth(1)).toContainText('Автобус');
});

test('быстрая задача использует автобус при отсутствии резервных маршруток',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Пауза',exact:true}).click();
  await page.locator('[data-tab="routes"]').click();await page.locator('[data-assign="1"]').click();
  await page.locator('[data-tab="fleet"]').click();await page.locator('[data-buy="bus"]').click();
  await page.locator('[data-tab="map"]').click();await page.locator('#goal-toggle').click();
  await expect(page.locator('#demand-suggest')).toHaveText('Проложить');await page.locator('#demand-suggest').click();
  await expect(page.locator('#draft-mode')).toHaveValue('bus');await page.locator('#confirm').click();
  await expect(page.locator('.route-card').nth(1)).toContainText('Автобус');
});
