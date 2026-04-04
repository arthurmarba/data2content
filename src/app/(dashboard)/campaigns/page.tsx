import CampaignsHub from "./CampaignsHub";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <CampaignsHub />
    </main>
  );
}
