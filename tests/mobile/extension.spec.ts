import {test,expect} from './fixtures';
for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  test(`продление с обоих концов, отмена и сохранение ${viewport.width}`,async({page,context})=>{
    await page.setViewportSize(viewport);await page.goto('/');
    await page.getByRole('button',{name:'Пауза',exact:true}).click();
    await page.locator('[data-tab="routes"]').click();await page.locator('[data-extend="1"]').click();
    await expect(page.locator('#confirm')).toBeDisabled();
    await expect(page.locator('#selection button:disabled')).toHaveCount(4);
    if(viewport.width>viewport.height){
      // Move the eastern stops out from under the landscape editor using a real finger gesture.
      const cdp=await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:300,id:1}]});
      for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200-i*20,y:300,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await expect.poll(async()=>(await page.getByRole('button',{name:'Заречье',exact:true}).boundingBox())!.x).toBeLessThan(400);
      await expect(page.locator('#selection button')).toHaveCount(4);
    }
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
