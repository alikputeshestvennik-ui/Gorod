import { test, expect } from '@playwright/test';
test('телефон: маршрут, резерв, офлайн и сохранение',async({page,context})=>{
  const errors:string[]=[],external:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173'))external.push(r.url());});
  await page.goto('/');await expect(page.locator('#population')).toHaveText('5 000');
  await page.getByRole('button',{name:'Пауза',exact:true}).click();
  await page.locator('#debug-toggle').click();
  await expect(page.locator('#debug')).toHaveText(/^[1-9]\d* FPS · \d+ calls · \d+ triangles$/);
  console.log('GRAPHICS',await page.locator('#debug').textContent());
  await page.screenshot({path:'artifacts/portrait.png',fullPage:true});
  await page.getByRole('button',{name:'Создать маршрут',exact:false}).click();
  await page.getByRole('button',{name:'Больница',exact:true}).click();await page.getByRole('button',{name:'Заречье',exact:true}).click();
  await expect(page.locator('#confirm')).toContainText('4 000');await page.locator('#confirm').click();
  await expect(page.locator('.route-card')).toHaveCount(2);
  await page.getByRole('button',{name:'Автопарк',exact:true}).click();await expect(page.locator('#panel')).toContainText('В резерве: 0');
  await page.getByRole('button',{name:'Купить',exact:false}).click();await expect(page.locator('#panel')).toContainText('В резерве: 1');
  await page.reload();await page.getByRole('button',{name:'Пауза',exact:true}).click();await expect(page.locator('.route-card')).toHaveCount(2);
  await context.setOffline(true);await page.getByRole('button',{name:'Финансы',exact:true}).click();await expect(page.locator('#panel')).toContainText('Билет: 35 ₽');
  await page.setViewportSize({width:844,height:390});await page.screenshot({path:'artifacts/landscape.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);expect(external).toEqual([]);
});
test('поврежденное сохранение и запрет отмены нового города',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('gorodskoy-marshrut:stage1:v1','{"version":99}'));
  await page.goto('/');await expect(page.locator('#toast')).toContainText('Сохранение повреждено');
  await page.getByRole('button',{name:'Новый город',exact:true}).click();await expect(page.locator('#modal')).toBeVisible();
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
  await expect(page.locator('.route-card')).toHaveCount(1);
});
