import { redirect } from "next/navigation";

export default async function SearchPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nextParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const resolved = Array.isArray(value) ? value[0] : value;

    if (resolved) {
      nextParams.set(key, resolved);
    }
  });

  redirect(nextParams.toString() ? `/?${nextParams.toString()}` : "/");
}
