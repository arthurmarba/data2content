// src/app/dashboard/page.tsx
import { redirect } from "next/navigation";

import HomeClientPage from "./home/HomeClientPage";

interface searchParams {
  [key: string]: string | string[] | undefined;
}

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<searchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = new URLSearchParams();
  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => query.append(key, v));
  });

  if (query.get("board") === "post-creation") {
    query.delete("board");
    const queryString = query.toString();
    redirect(queryString ? `/calendar?${queryString}` : "/calendar");
  }

  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <HomeClientPage />
    </main>
  );
}
