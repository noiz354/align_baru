/** PHASE 0 — private first-party pilot disk adapter; production object storage is a release gate. */
import fs from "node:fs/promises";
import path from "node:path";

const VIDEO_KEY_PATTERN = /^[0-9a-f-]{36}\.webm$/i;
const trafficVideoDirectory = (): string => path.resolve(
  process.env.SIOMAYOPS_PRIVATE_MEDIA_DIR || path.join(process.cwd(), "data", "private-media", "traffic"),
);

export const storeTrafficVideo = async (input: { assetId: string; bytes: Buffer }): Promise<string> => {
  if (!/^[0-9a-f-]{36}$/i.test(input.assetId)) throw new Error("Invalid media key");
  const directory = trafficVideoDirectory();
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const storageKey = `${input.assetId}.webm`;
  const filePath = path.join(directory, storageKey);
  const handle = await fs.open(filePath, "wx", 0o600);
  try {
    await handle.writeFile(input.bytes);
    await handle.sync();
  } catch (error) {
    await handle.close();
    await fs.rm(filePath, { force: true });
    throw error;
  }
  await handle.close();
  return storageKey;
};

export const deleteTrafficVideo = async (storageKey: string): Promise<void> => {
  if (!VIDEO_KEY_PATTERN.test(storageKey)) throw new Error("Invalid media key");
  await fs.rm(path.join(trafficVideoDirectory(), storageKey), { force: true });
};
