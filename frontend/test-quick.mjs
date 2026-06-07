import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', e => console.log('💥', e.message));
p.on('console', m => { if (m.type()==='log' && m.text().includes('[chatStream]')) console.log('📡', m.text().slice(0,120)); });

await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
await p.fill('input[placeholder="账号"]', 'changsha');
await p.fill('input[placeholder="密码"]', '123456');
await p.click('button:has-text("登 录")');
await p.waitForTimeout(3000);

const ta = p.locator('textarea');
await ta.fill('你好');
await ta.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })));
await p.waitForTimeout(500);

const send = p.locator('button:has-text("发送")');
if (!await send.first().isDisabled()) {
  await send.first().click();
  console.log('✅ SEND clicked');
  await p.waitForTimeout(10000);
  
  const root = await p.locator('#root').innerHTML();
  console.log('Root has "你好":', root.includes('你好'));
  console.log('Root len:', root.length);
  console.log('Root last 500:', root.slice(-500));
}

console.log('Done');
await b.close();
