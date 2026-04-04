import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

function getArtifactProvider() {
  return process.env.ARTIFACT_PROVIDER?.trim().toLowerCase() || "local";
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

let r2Client: S3Client | null = null;

function getR2Client() {
  if (r2Client) {
    return r2Client;
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 uploads require R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.");
  }

  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });

  return r2Client;
}

async function uploadRemoteArtifact(file: ArtifactFile) {
  const provider = getArtifactProvider();

  if (provider === "local") {
    return;
  }

  if (provider !== "r2") {
    throw new Error(`Unsupported artifact provider: ${provider}`);
  }

  const bucket = process.env.R2_BUCKET;

  if (!bucket) {
    throw new Error("R2 uploads require R2_BUCKET.");
  }

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: file.path,
      Body: file.body,
      ContentType: file.contentType ?? "application/json; charset=utf-8",
      CacheControl: "public, max-age=31536000, immutable"
    })
  );
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
