
import { connectToDatabase } from '../src/app/lib/mongoose';
import SharedLink from '../src/app/models/SharedLink';
import Metric from '../src/app/models/Metric';
import User from '../src/app/models/User';
import { v4 as uuidv4 } from 'uuid';

async function main() {
    await connectToDatabase();
    console.log('Connected to DB');

    // 1. Find a user and a metric
    const user = await User.findOne({});
    if (!user) {
        console.error('No user found');
        return;
    }
    console.log('User found:', user.email);

    const metric = await Metric.findOne({ user: user._id });
    if (!metric) {
        console.error('No metric found for user');
        // Create dummy if needed?
        return;
    }
    console.log('Metric found:', metric._id);

    // 2. Create SharedLink (simulate POST /share)
    const token = uuidv4();
    const sharedLink = await SharedLink.create({
        token,
        metricId: metric._id,
        userId: user._id,
        config: { liveUpdate: false }
    });
    console.log('SharedLink created:', sharedLink.token);

    // 3. Try access (simulate GET /public/publis/[token])
    const foundLink = await SharedLink.findOne({ token }).populate('userId');
    if (!foundLink) {
        console.error('SharedLink NOT found immediately after creation!');
        return;
    }
    const creator = foundLink.userId as any;
    console.log('SharedLink FOUND. Creator:', creator?.email);

    // 4. Check Metric access
    const foundMetric = await Metric.findById(foundLink.metricId);
    if (!foundMetric) {
        console.error('Metric NOT found via SharedLink reference');
    } else {
        console.log('Metric FOUND via SharedLink');
    }

    // Cleanup
    await SharedLink.deleteOne({ _id: sharedLink._id });
    console.log('Cleanup done');
}

main().catch(console.error).then(() => process.exit(0));
