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

import {
  readFileSync, writeFileSync, readdirSync, existsSync,
  mkdirSync, copyFileSync, rmSync, statSync,
} from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PARTIALS_DIR = join(ROOT, "partials");
const CHECK_ONLY = process.argv.includes("--check");
const DIST = process.argv.includes("--dist");

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

/* ============================================================
   --dist: collect the deployable site into dist/

   WHY THIS EXISTS: hosts that serve the repo root have bitten this
   project twice. Vercel needed outputDirectory "." and then ran a build
   that had no output directory to find; Cloudflare uploaded the root as
   assets and choked on the 144 MiB workerd inside the node_modules its
   own builder had installed. A directory holding exactly the site, and
   nothing else, removes that whole class of failure: point the host at
   dist/ and there is nothing else there to go wrong.

   .assetsignore is the single source of truth for what is NOT the site.
   That list is already proven in production: every path in it answers
   404 on the live site while every page answers 200. Deriving dist/ from
   the same file keeps one list instead of two that can drift apart.

   functions/ is in that list and so never reaches dist/. That is right:
   Cloudflare Pages reads functions/ from the project root to compile the
   /api routes, not from the output directory.
   ============================================================ */

function loadIgnorePatterns() {
  const file = join(ROOT, ".assetsignore");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

/** Translate one ignore pattern into a test against a repo-relative path. */
function makeMatcher(pattern) {
  const clean = pattern.replace(/\/+$/, "");
  const toRe = (glob) =>
    new RegExp("^" + glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*") + "$");

  if (clean.includes("/")) {
    const re = toRe(clean);
    // Matches the path itself and anything under it.
    return (p) => re.test(p) || p.startsWith(clean + "/");
  }
  const re = toRe(clean);
  // A bare name matches that entry at any depth, plus its contents.
  return (p) => p.split("/").some((seg) => re.test(seg));
}

if (DIST && !CHECK_ONLY) {
  const matchers = loadIgnorePatterns().map(makeMatcher);
  // Never copy these regardless of what the ignore file says.
  const always = ["dist", ".git", "node_modules"];
  const ignored = (rel) =>
    always.some((a) => rel === a || rel.startsWith(a + "/")) ||
    matchers.some((m) => m(rel));

  const OUT = join(ROOT, "dist");
  rmSync(OUT, { recursive: true, force: true });

  let files = 0;
  let bytes = 0;
  const skipped = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      const rel = relative(ROOT, abs).split(sep).join("/");
      if (ignored(rel)) {
        if (!rel.includes("/")) skipped.push(rel);
        continue;
      }
      if (statSync(abs).isDirectory()) {
        walk(abs);
      } else {
        mkdirSync(join(OUT, dirname(rel)), { recursive: true });
        copyFileSync(abs, join(OUT, rel));
        files++;
        bytes += statSync(abs).size;
      }
    }
  };
  walk(ROOT);

  const mb = (bytes / 1024 / 1024).toFixed(1);
  console.log(`build --dist: ${files} file(s), ${mb} MB -> dist/`);
  console.log(`build --dist: skipped at root: ${skipped.sort().join(", ")}`);

  // A deploy with no home page is the one failure worth catching here.
  for (const required of ["index.html", "es.html", "_headers", "_redirects"]) {
    if (!existsSync(join(OUT, required))) {
      console.error(`build --dist: MISSING ${required} in dist/`);
      process.exit(1);
    }
  }
}
