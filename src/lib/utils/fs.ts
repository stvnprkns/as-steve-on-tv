import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function readJsonFilesFromDirectory<T>(directoryPath: string) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const rows = await Promise.all(
    files.map(async (fileName) => {
      const absolutePath = path.join(directoryPath, fileName);
      const raw = await readFile(absolutePath, "utf8");

      try {
        return {
          fileName,
          absolutePath,
          data: JSON.parse(raw) as T
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown JSON parse error";
        throw new Error(`Invalid JSON in ${absolutePath}: ${message}`);
      }
    })
  );

  return rows;
}

export function getContentPath(...segments: string[]) {
  return path.join(process.cwd(), "content", ...segments);
}

