import path from "node:path";

const WRITE_FORBIDDEN = ["content", "app", "public"];

/** Study extracts and SSA rows stay out of the public app and the authored archive. */
export function assertPrivateResearchPath(repoRoot: string, targetPath: string) {
  const resolved = path.resolve(targetPath);
  const root = path.resolve(repoRoot);

  for (const folder of WRITE_FORBIDDEN) {
    const forbidden = path.join(root, folder);

    if (resolved === forbidden || resolved.startsWith(forbidden + path.sep)) {
      throw new Error(
        `Refusing to write research data under ${resolved}. SSA rows and study credits stay out of the public app.`
      );
    }
  }
}

/** Validated aggregates may be published only under the public studies directory. */
export function assertStudyPublishPath(repoRoot: string, targetPath: string) {
  const resolved = path.resolve(targetPath);
  const allowed = path.join(path.resolve(repoRoot), "content", "public", "studies");

  if (resolved !== allowed && !resolved.startsWith(allowed + path.sep)) {
    throw new Error(
      `Refusing to publish study aggregates to ${resolved}. Validated study files belong under content/public/studies.`
    );
  }
}

/** The public index is a convenience sample and cannot be the study frame. */
export function assertStudyCatalogPath(repoRoot: string, catalogPath: string) {
  const resolved = path.resolve(catalogPath);
  const content = path.join(path.resolve(repoRoot), "content");

  if (resolved === content || resolved.startsWith(content + path.sep)) {
    throw new Error(
      `Refusing to build a study population from ${resolved}. The public index is not a study denominator.`
    );
  }
}
