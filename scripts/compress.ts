import { readdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { brotliCompress, gzip, constants } from "node:zlib";
import { join } from "node:path";

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);
const paths = ["dist/index.html", "dist/about.html", ...((await readdir("dist/assets")).filter(name => /\.(js|css)$/.test(name)).map(name => join("dist/assets", name)))];
for (const path of paths) {
  const bytes = await readFile(path);
  await writeFile(path + ".br", await brotli(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }));
  await writeFile(path + ".gz", await gz(bytes, { level: 9 }));
}
console.log(`Precompressed ${paths.length} text assets (Brotli and gzip).`);
