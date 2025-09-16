import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = (searchParams.get('slug') || '').trim();
    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findOne({ mediaKitSlug: slug }).select('_id').lean();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ userId: String(user._id) });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to resolve user id' }, { status: 500 });
  }
}

