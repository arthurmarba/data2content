import { connectToDatabase } from '@/app/lib/mongoose';
import SharedLink from '@/app/models/SharedLink';

async function verify() {
    await connectToDatabase();
    const link = await SharedLink.findOne({});
    if (!link) {
        console.log('No shared link found.');
        return;
    }

    const token = link.token;
    const url = `http://localhost:3000/api/public/publis/${token}`;
    console.log(`Testing URL: ${url}`);

    try {
        const res = await fetch(url);
        const json = await res.json();

        if (json.data) {
            console.log('API Response Data Keys:', Object.keys(json.data));
            console.log('Format:', json.data.format);
            console.log('DailySnapshots Present:', !!json.data.dailySnapshots);
            console.log('Snapshots Length:', json.data.dailySnapshots?.length);
        } else {
            console.error('API Error:', json);
        }
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

verify();
