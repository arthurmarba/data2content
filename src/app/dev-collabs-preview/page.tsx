// ⚠️ DESCARTÁVEL — preview da tela COMPLETA de Collabs sem login. Gateado a
// non-production. Será removido após a verificação visual.
import { notFound } from "next/navigation";
import { DevCollabsPreviewClient } from "./DevCollabsPreviewClient";

export const dynamic = "force-dynamic";

export default function DevCollabsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevCollabsPreviewClient />;
}
