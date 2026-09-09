import { handleMarketplaceGet, handleMarketplacePost } from '@/app/lib/instagram/marketplaceHttp';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = handleMarketplaceGet;
export const POST = handleMarketplacePost;
