
import SharedLink from '../src/app/models/SharedLink';
import User from '../src/app/models/User';
import { connectToDatabase } from '../src/app/lib/mongoose';

async function main() {
    await connectToDatabase();

    // Find a valid token
    const link = await SharedLink.findOne({});
    if (!link) {
        console.log('No shared link found in DB to test.');
        return;
    }

    const url = `http://localhost:3000/publi-share/${link.token}`;
    console.log(`Testing URL: ${url}`);

    try {
        const res = await fetch(url);
        console.log(`Status: ${res.status}`);
        console.log(`Redirected: ${res.redirected}`);
        console.log(`Url: ${res.url}`);

        if (res.status === 200) {
            console.log('SUCCESS: Page is accessible.');
        } else {
            console.log('FAILURE: Page returned status', res.status);
            const text = await res.text();
            console.log('Body preview:', text.substring(0, 200));
        }

        // Also test API
        const apiUrl = `http://localhost:3000/api/public/publis/${link.token}`;
        console.log(`Testing API: ${apiUrl}`);
        const apiRes = await fetch(apiUrl);
        console.log(`API Status: ${apiRes.status}`);
        const apiJson = await apiRes.json();
        console.log('API Response:', JSON.stringify(apiJson).substring(0, 100));

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

main().then(() => process.exit(0));
