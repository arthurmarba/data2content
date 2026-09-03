import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent('<h1>Hello Data2Content</h1>');
  const buffer = await page.screenshot();
  console.log('Screenshot buffer length:', buffer.length);
  await browser.close();
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
