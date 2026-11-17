import { test, expect, type Page } from '@playwright/test';
import { createWorld, step } from '../../src/sim/world';
import { E } from '../../src/sim/config';
import { C } from '../../src/sim/development';
const key='gorodskoy-marshrut:stage2:v2';
async function prepare(page:Page,world:ReturnType<typeof createWorld>){
  await page.addInitScript(({key,world})=>{
    const scenario=sessionStorage.getItem('living-scenario');if(scenario){localStorage.setItem(key,scenario);sessionStorage.removeItem('living-scenario');return;}
    if(sessionStorage.getItem('living-fixture'))return;sessionStorage.setItem('living-fixture','yes');
    localStorage.setItem(key,JSON.stringify(world));
    localStorage.setItem('gorodskoy-marshrut:settings:v1',JSON.stringify({version:1,quality:'high',time:'day',sound:false}));
  },{key,world});
  await page.goto('/');await page.getByRole('button',{name:'Пауза',exact:true}).click();
  await expect(page.locator('canvas')).toBeVisible();
}
test('стройка, новый квартал, маршрут к нему и отчёт о населении',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const w=createWorld();step(w,E.minutesPerDay*C.constructionDays);
  await prepare(page,w);await page.locator('#zoom-out').click();await page.locator('#zoom-out').click();
  await expect(page.locator('.stop-label')).toHaveCount(13);
  await page.locator('#growth').click();await expect(page.locator('#modal')).toContainText('Жители прибывают каждый игровой день');
  await expect(page.locator('#modal')).toContainText('Восточный квартал');await expect(page.locator('#modal')).toContainText('Такси:');await page.locator('#close').click();
  await page.screenshot({path:'artifacts/living-new-quarter.png'});
  await page.getByRole('button',{name:'Восточный квартал',exact:true}).click();
  await page.getByRole('button',{name:'Заречье',exact:true}).click();await expect(page.locator('#selection')).toContainText('Восточный квартал');
  await page.locator('#confirm').click();await expect(page.locator('.route-card')).toHaveCount(2);
  expect(errors).toEqual([]);
});
test('снег, ливень, ремонт, матч и ночное видение в пределах бюджета графики',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const w=createWorld();step(w,5);w.event={id:'snow',until:10000};w.nextEvent={id:'match',at:11000};
  await prepare(page,w);await page.locator('#debug-toggle').click();
  await page.waitForTimeout(1600);await page.screenshot({path:'artifacts/living-snow.png'});
  for(const id of ['rain','repair','match']){
    await page.evaluate(({key,id})=>{const saved=JSON.parse(localStorage.getItem(key)!);saved.event={id,until:10000};saved.nextEvent={id:'fair',at:11000};sessionStorage.setItem('living-scenario',JSON.stringify(saved));},{key,id});
    await page.reload();await page.getByRole('button',{name:'Пауза',exact:true}).click();await page.locator('#debug-toggle').click();
    await page.locator('#zoom-in').click();await page.locator('#zoom-in').click();
    await expect(page.locator('#map')).toHaveAttribute('data-event',id);
    await page.waitForTimeout(1600);await page.screenshot({path:`artifacts/living-${id}.png`});
    const stats=(await page.locator('#debug').textContent())!;console.log('LIVING_CITY_'+id,stats);
    const budget=stats.match(/(\d+) calls · (\d+) triangles/)!;expect(Number(budget[1])).toBeLessThanOrEqual(150);expect(Number(budget[2])).toBeLessThanOrEqual(200000);
  
  }
  for(const layer of ['demand','load','complaints']){
    await page.locator('#layer-'+layer).click();await expect(page.locator('#map')).toHaveAttribute('data-layers',layer);
    expect(await page.locator('#map').evaluate(el=>{
      const effect=getComputedStyle(el,'::after');
      return effect.content!=='none'&&effect.backgroundImage!=='none'&&effect.pointerEvents==='none';
    })).toBe(true);
    await page.screenshot({path:`artifacts/living-layer-${layer}.png`});await page.locator('#layer-'+layer).click();
  }
  await expect.poll(()=>page.locator('#map').getAttribute('data-people').then(Number)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('крупный город: 60 машин, пешеходы и ливень при приближении',async({page})=>{
  const w=createWorld();w.routes[0].vehicles=60;w.fleet=w.fleets.marshrutka=60;
  w.districts.forEach(d=>d.population*=50);w.demand.fill(60);w.queues.forEach(q=>q.fill(5));
  w.event={id:'rain',until:10000};w.nextEvent={id:'match',at:11000};w.mobility.taxi=30;
  await prepare(page,w);for(let i=0;i<7;i++)await page.locator('#zoom-in').click();
  await page.locator('#debug-toggle').click();await page.waitForTimeout(1600);
  await expect(page.locator('#map')).toHaveAttribute('data-vehicles','60');
  await expect(page.locator('#map')).toHaveAttribute('data-taxis','8');
  const people=Number(await page.locator('#map').getAttribute('data-people'));expect(people).toBeGreaterThan(0);expect(people).toBeLessThanOrEqual(96);
  const stats=(await page.locator('#debug').textContent())!;console.log('LIVING_CITY_STRESS',stats);
  const budget=stats.match(/(\d+) calls · (\d+) triangles/)!;expect(Number(budget[1])).toBeLessThanOrEqual(150);expect(Number(budget[2])).toBeLessThanOrEqual(200000);
  await page.screenshot({path:'artifacts/living-street-detail.png'});
});
