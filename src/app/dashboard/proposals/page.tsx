import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type LegacyProposalsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function LegacyProposalsPage({ searchParams = {} }: LegacyProposalsPageProps) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === "string") {
      params.set(key, value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    }
  });

  const query = params.toString();
  redirect(query ? `/campaigns?${query}` : "/campaigns");
}
