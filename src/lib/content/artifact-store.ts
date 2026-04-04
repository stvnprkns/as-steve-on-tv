import { put } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getContentPath } from "@/src/lib/utils/fs";

export type ArtifactFile = {
  path: string;
  body: string;
  contentType?: string;
};

const localRoot = getContentPath("public");

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function getRemoteArtifactUrl(relativePath: string) {
  if (!process.env.ARTIFACT_BASE_URL) {
    return null;
  }

  return `${normalizeBaseUrl(process.env.ARTIFACT_BASE_URL)}/${relativePath}`;
}

export async function readArtifactText(relativePath: string, tags: string[]) {
  const remoteUrl = getRemoteArtifactUrl(relativePath);

  if (remoteUrl) {
    const response = await fetch(remoteUrl, {
      next: {
        tags,
        revalidate: 60 * 60 * 24 * 365
      }
    });

    if (response.ok) {
      return response.text();
    }

    if (response.status !== 404) {
      throw new Error(`Artifact fetch failed for ${remoteUrl}: ${response.status} ${response.statusText}`);
    }
  }

  return readFile(path.join(localRoot, relativePath), "utf8");
}

async function readExistingArtifactText(relativePath: string) {
  try {
    return await readArtifactText(relativePath, ["archive"]);
  } catch {
    return null;
  }
}

async function writeLocalArtifact(relativePath: string, body: string) {
  const absolutePath = path.join(localRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, body, "utf8");
}

async function uploadRemoteArtifact(file: ArtifactFile) {
  if (!process.env.ARTIFACT_WRITE_TOKEN) {
    return;
  }

  await put(file.path, file.body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    token: process.env.ARTIFACT_WRITE_TOKEN,
    contentType: file.contentType ?? "application/json; charset=utf-8"
  });
}

export async function writeArtifactFiles(files: ArtifactFile[]) {
  const changedPaths: string[] = [];

  for (const file of files) {
    const existing = await readExistingArtifactText(file.path);

    if (existing === file.body) {
      continue;
    }

    await writeLocalArtifact(file.path, file.body);
    await uploadRemoteArtifact(file);
    changedPaths.push(file.path);
  }

  return changedPaths;
}
