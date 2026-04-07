// src/app/dashboard/page.tsx
import { redirect } from "next/navigation";

interface searchParams {
  [key: string]: string | string[] | undefined;
}

export default function DashboardHomePage({ searchParams }: { searchParams: searchParams }) {
  const query = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach(v => query.append(key, v));
  });

  const queryString = query.toString();
  redirect(queryString ? `/?${queryString}` : "/");
}
