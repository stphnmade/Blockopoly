import { copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const assetsDir = join(process.cwd(), "dist", "assets");
const files = readdirSync(assetsDir);

const copyEntry = (extension) => {
  const entry = files.find(
    (file) =>
      file.startsWith("index-") &&
      file.endsWith(`.${extension}`) &&
      !file.startsWith("index-legacy.")
  );

  if (!entry) {
    throw new Error(`Could not find built index ${extension} asset.`);
  }

  copyFileSync(
    join(assetsDir, entry),
    join(assetsDir, `index-legacy.${extension}`)
  );
};

copyEntry("js");
copyEntry("css");
