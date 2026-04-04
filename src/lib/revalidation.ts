export type RevalidationPayload = {
  tags: string[];
  slugs?: string[];
  collectionSlugs?: string[];
};

function getRevalidateUrl() {
  return process.env.REVALIDATE_URL ?? (process.env.SITE_URL ? `${process.env.SITE_URL}/api/internal/revalidate-artifacts` : null);
}

export async function applyRevalidation(payload: RevalidationPayload) {
  const { revalidatePath, revalidateTag } = await import("next/cache");

  for (const tag of payload.tags) {
    revalidateTag(tag);
  }

  for (const slug of payload.slugs ?? []) {
    revalidatePath(`/steves/${slug}`);
  }

  for (const slug of payload.collectionSlugs ?? []) {
    revalidatePath(`/collections/${slug}`);
  }

  revalidatePath("/");
}

export async function triggerRemoteRevalidation(payload: RevalidationPayload) {
  const revalidateUrl = getRevalidateUrl();
  const secret = process.env.REVALIDATE_SECRET;

  if (!revalidateUrl || !secret) {
    return { triggered: false };
  }

  const response = await fetch(revalidateUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Revalidation request failed: ${response.status} ${response.statusText}`);
  }

  return {
    triggered: true
  };
}
