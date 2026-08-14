#!/usr/bin/env node
/**
 * build.mjs — minimal HTML partials for Wallas' Stream
 *
 * Zero dependencies. Node 18+.
 *
 * Usage:
 *   node build.mjs          expand every partial marker in place
 *   node build.mjs --check  verify everything is in sync (exit 1 if not)
 *
 * How it works
 * ------------
 * Pages mark an injection region with a MATCHED PAIR of comments:
 *
 *   <!--#include nav-->
 *   ...generated content lives here...
 *   <!--#endinclude nav-->
 *
 * The script replaces whatever sits between the markers with the body of
 * partials/nav.html. Because the markers survive the rewrite, running the
 * build repeatedly is idempotent.
 *
 * WHY PAIRED MARKERS RATHER THAN A src/ -> dist/ PIPELINE:
 * the committed HTML stays complete and deployable on its own. If the build
 * never runs, Vercel still serves a correct site. The build keeps shared
 * regions in sync; it is never a deployment dependency. That keeps the
 * "no build step" risk profile the project had before, while removing the
 * duplication.
 *
 * Pages with no markers are ignored, so subpages can adopt this one at a
 * time without being touched now.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PARTIALS_DIR = join(ROOT, "partials");
const CHECK_ONLY = process.argv.includes("--check");

if (!existsSync(PARTIALS_DIR)) {
  console.error("build: partials/ directory not found");
  process.exit(1);
}

/** Load every partials/<name>.html into a map keyed by <name>. */
const partials = new Map();
for (const file of readdirSync(PARTIALS_DIR)) {
  if (!file.endsWith(".html")) continue;
  const name = file.replace(/\.html$/, "");
  partials.set(name, readFileSync(join(PARTIALS_DIR, file), "utf8").trim());
}

if (partials.size === 0) {
  console.error("build: no partials found in partials/");
  process.exit(1);
}

const pages = readdirSync(ROOT).filter(
  (f) => f.endsWith(".html") && !f.startsWith("_")
);

let changed = 0;
let outOfSync = 0;
let injected = 0;

for (const page of pages) {
  const path = join(ROOT, page);
  const original = readFileSync(path, "utf8");
  let next = original;

  for (const [name, body] of partials) {
    // Matches <!--#include nav--> ... <!--#endinclude nav-->
    const region = new RegExp(
      `(<!--#include\\s+${name}\\s*-->)([\\s\\S]*?)(<!--#endinclude\\s+${name}\\s*-->)`,
      "g"
    );

    next = next.replace(region, (_m, open, _current, close) => {
      injected++;
      return `${open}\n${body}\n${close}`;
    });
  }

  if (next !== original) {
    outOfSync++;
    if (CHECK_ONLY) {
      console.error(`build --check: ${page} is OUT OF SYNC with partials/`);
    } else {
      writeFileSync(path, next, "utf8");
      console.log(`build: updated ${page}`);
      changed++;
    }
  }
}

if (CHECK_ONLY) {
  if (outOfSync > 0) {
    console.error(`build --check: ${outOfSync} file(s) out of sync. Run: npm run build`);
    process.exit(1);
  }
  console.log(`build --check: all ${pages.length} page(s) in sync.`);
} else {
  console.log(
    `build: ${injected} region(s) expanded across ${pages.length} page(s); ${changed} file(s) written.`
  );
}
