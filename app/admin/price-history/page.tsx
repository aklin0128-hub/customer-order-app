import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPriceHistoryRedirect({ searchParams }: Props) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  qs.set("section", "price");

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => qs.append(key, v));
    } else {
      qs.set(key, value);
    }
  }

  redirect(`/admin/price-compare?${qs.toString()}`);
}
