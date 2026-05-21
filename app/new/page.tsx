import { getShowcaseData } from "@/lib/loginPreview";

import PublicShowcaseClient from "./PublicShowcaseClient";

export const dynamic = "force-dynamic";

export default async function NewShowcasePage() {
  const data = await getShowcaseData();

  return <PublicShowcaseClient data={data} />;
}
