
import { chromium } from 'playwright';

async function testPdf() {
    console.log('Starting browser...');
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({
        viewport: { width: 1200, height: 1600 },
        deviceScaleFactor: 2,
        locale: 'pt-BR',
    });

    const page = await context.newPage();
    const url = 'https://data2content.ai/mediakit/livia-linhares?print=1'; // Test with production URL
    console.log(`Navigating to ${url}...`);
    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
        console.log('Page loaded. Generating PDF...');
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
        });
        console.log(`PDF generated. Size: ${pdf.length} bytes`);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

testPdf();
