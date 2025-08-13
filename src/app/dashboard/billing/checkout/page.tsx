import { cookies } from "next/headers";
import CheckoutPage from "../CheckoutPage";

export const dynamic = "force-dynamic";

// This is now a Server Component to read cookies on the server.
export default function Page() {
  // Read the affiliate cookie on the server.
  const cookieStore = cookies();
  const affiliateCode = cookieStore.get("d2c_ref")?.value || null;

  // Pass the code to the client component.
  return <CheckoutPage affiliateCode={affiliateCode} />;
}
