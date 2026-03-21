import type { Metadata } from "next";

const siteName = "As Steve on TV";
const siteDescription =
  "A straight-faced editorial index of Steve, Stephen, Steven, and Stevie characters and people across TV, movies, and commercials.";

export function buildMetadata({
  title,
  description
}: {
  title: string;
  description?: string;
}): Metadata {
  const resolvedDescription = description ?? siteDescription;

  return {
    title,
    description: resolvedDescription,
    applicationName: siteName,
    openGraph: {
      title,
      description: resolvedDescription,
      siteName
    },
    twitter: {
      card: "summary",
      title,
      description: resolvedDescription
    }
  };
}

export const defaultMetadata = buildMetadata({
  title: siteName,
  description: siteDescription
});
