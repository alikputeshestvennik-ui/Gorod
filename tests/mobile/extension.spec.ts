import {test,expect} from './fixtures';
for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  test(`продление с обоих концов, отмена и сохранение ${viewport.width}`,async({page})=>{
    await page.setViewportSize(viewport);await page.goto('/');
    await page.getByRole('button',{name:'Пауза',exact:true}).click();
    await page.locator('[data-tab="routes"]').click();await page.locator('[data-extend="1"]').click();
    await expect(page.locator('#confirm')).toBeDisabled();
    await expect(page.locator('#selection button:disabled')).toHaveCount(4);
    await page.getByRole('button',{name:'Больница',exact:true}).click();
    await expect(page.locator('#confirm')).toContainText('500');
    await page.locator('#draft-end').selectOption('start');
    await page.getByRole('button',{name:'Заречье',exact:true}).click();
    await expect(page.locator('#selection .draft-added')).toHaveCount(2);
    await expect(page.locator('#confirm')).toContainText('1 000');
    await page.locator('#undo').click();await expect(page.locator('#selection .draft-added')).toHaveCount(1);
    await page.locator('#cancel').click();
    await expect(page.locator('.route-card p').first()).toHaveText('Вокзал → Старый город → Площадь Мира → Рынок');
    await page.locator('[data-extend="1"]').click();
    await page.getByRole('button',{name:'Больница',exact:true}).click();
    await page.locator('#draft-end').selectOption('start');await page.getByRole('button',{name:'Заречье',exact:true}).click();
    await page.locator('#confirm').click();
    await expect(page.locator('.route-card')).toHaveCount(1);
    await expect(page.locator('.route-card p').first()).toHaveText('Заречье → Вокзал → Старый город → Площадь Мира → Рынок → Больница');
    await expect(page.locator('.route-card')).toContainText('Машин: 1');
    await page.reload();await page.locator('[data-tab="routes"]').click();
    await expect(page.locator('.route-card p').first()).toContainText('Рынок → Больница');
  });
}
