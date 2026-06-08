import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let errors = [];
page.on('pageerror', err => errors.push(err.message));

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { localStorage.clear(); });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });

await page.fill('input[placeholder="账号"]', 'changsha');
await page.fill('input[placeholder="密码"]', '123456');
await page.click('button:has-text("登 录")');
await page.waitForTimeout(3000);

const ta = page.locator('textarea');
await ta.fill('你好');
await page.waitForTimeout(300);

const send = page.locator('button:has-text("发送")').first();
if (!(await send.isDisabled())) {
  await send.click();
  console.log('Sent...');
  
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000);
    const rootHTML = await page.locator('#root').innerHTML();
    const hasBubble = rootHTML.includes('rounded-2xl');
    const hasContent = rootHTML.includes('你好！');
    if (hasContent) { console.log('✅ Reply visible at', i+1, 's'); break; }
    if (i === 14) console.log('⚠️ No reply after 15s. Bubbles:', hasBubble);
  }
}

console.log('Errors:', errors.join(' | ') || 'none');
console.log('Browser open');
