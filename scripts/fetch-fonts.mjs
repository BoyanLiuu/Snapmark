/**
 * Fetches Switzer from Fontshare into src/assets/fonts/switzer/ (git-ignored), once.
 *
 * Switzer's licence (ITF Free Font License 2.0) allows self-hosting it for this app but not making
 * the files available through a repository, so they are downloaded before `dev` and `build`
 * rather than committed. next/font/local then serves them from this app: no font request goes to
 * a third-party host at runtime. See the decisions log in docs/IMPLEMENTATION_PLAN.md.
 */

import { access, mkdir, writeFile } from "node:fs/promises";

const WEIGHTS = [400, 500];
const dir = new URL("../src/assets/fonts/switzer/", import.meta.url);
const fileFor = (weight) => new URL(`Switzer-${weight}.woff2`, dir);

const exists = (url) =>
  access(url).then(
    () => true,
    () => false,
  );

const have = await Promise.all(
  WEIGHTS.map((weight) => exists(fileFor(weight))),
);
if (have.every(Boolean)) process.exit(0);

const fail = (reason) => {
  console.error(
    `Couldn't fetch Switzer from Fontshare (${reason}).\n` +
      "It is downloaded once into src/assets/fonts/switzer/; connect to the internet and run `pnpm fonts`.",
  );
  process.exit(1);
};

const cssUrl = `https://api.fontshare.com/v2/css?f[]=switzer@${WEIGHTS.join(",")}&display=swap`;
const cssResponse = await fetch(cssUrl).catch((error) => fail(error.message));
if (!cssResponse.ok) fail(`HTTP ${cssResponse.status} for the stylesheet`);
const css = await cssResponse.text();

// One @font-face per weight; take its WOFF2 source.
const faces = new Map();
for (const block of css.split("@font-face").slice(1)) {
  const weight = Number(block.match(/font-weight:\s*(\d+)/)?.[1]);
  const src = block.match(/url\('([^']+\.woff2)'\)/)?.[1];
  if (weight && src)
    faces.set(weight, src.startsWith("//") ? `https:${src}` : src);
}

await mkdir(dir, { recursive: true });
for (const weight of WEIGHTS) {
  const src = faces.get(weight);
  if (!src) fail(`no WOFF2 for weight ${weight}`);
  const response = await fetch(src).catch((error) => fail(error.message));
  if (!response.ok) fail(`HTTP ${response.status} for weight ${weight}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  // A WOFF2 file starts with "wOF2"; anything else is an error page.
  if (String.fromCharCode(...bytes.slice(0, 4)) !== "wOF2")
    fail(`weight ${weight} is not WOFF2`);
  await writeFile(fileFor(weight), bytes);
  console.log(`Switzer ${weight}: ${bytes.length} bytes`);
}
