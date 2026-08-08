import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Packed-package consumer smoke test for the `najm-kit/person-images` subpath.
 *
 * Builds a real `npm pack` tarball from the local `packages/najm-kit`
 * workspace and installs it into a fresh temp project. The project then
 * imports the subpath through the published `exports` map and runs the
 * built-in resolver against the same inputs the runtime tests cover, so
 * a future change that breaks the consumer-facing shape fails here even
 * when the unit tests still pass against `src/`.
 *
 * The test is opt-in. `bun test` runs in a 5s default timeout and packing
 * a tarball plus installing its peer dependencies is several seconds even
 * on a warm cache. Set `NAJM_KIT_PACKAGE_TEST=1` to enable it; CI and the
 * publication script run the explicit `bun test
 * test/person-images-package.test.ts --timeout 120000` form to exercise
 * the consumer path.
 */

const PACKAGE_ROOT = resolve(import.meta.dir, "..");
const TARBALL_DIR = join(PACKAGE_ROOT, "..", "..", "dist-publish");
const PERSON_IMAGES_EXPORT = "./person-images";
const ENABLED = process.env.NAJM_KIT_PACKAGE_TEST === "1";

let tempProjectDir: string | null = null;
let tarballPath: string | null = null;
let smokeBuild: typeof runPack | null = null;

async function runPack(): Promise<string> {
  if (!existsSync(TARBALL_DIR)) mkdirSync(TARBALL_DIR, { recursive: true });
  const stdout = await new Response(
    Bun.spawn({
      cmd: [
        "npm",
        "pack",
        "--json",
        "--pack-destination",
        TARBALL_DIR,
        "--workspace",
        "packages/najm-kit",
      ],
      cwd: join(PACKAGE_ROOT, "..", ".."),
      stdout: "pipe",
      stderr: "inherit",
    }).stdout,
  ).text();
  const parsed = JSON.parse(stdout.trim()) as Array<{ filename: string }>;
  const filename = parsed[0]?.filename;
  if (!filename) throw new Error("npm pack did not return a tarball name");
  return resolve(TARBALL_DIR, filename);
}

async function ensureBuild(): Promise<string> {
  if (tarballPath && existsSync(tarballPath)) return tarballPath;
  if (!smokeBuild) smokeBuild = runPack;
  tarballPath = await smokeBuild();
  return tarballPath;
}

async function ensureProject(): Promise<string> {
  if (tempProjectDir) return tempProjectDir;
  const pack = await ensureBuild();
  const dir = mkdtempSync(join(tmpdir(), "najm-kit-person-images-"));
  const projectPkg = {
    name: "person-images-consumer",
    private: true,
    type: "module",
    dependencies: {
      "najm-kit": pack,
      "zod": "^4",
    },
  };
  writeFileSync(join(dir, "package.json"), JSON.stringify(projectPkg, null, 2));
  writeFileSync(
    join(dir, "index.mjs"),
    `import { getPersonImage, createPersonImageResolver } from "najm-kit/person-images";

const femaleChild = getPersonImage({ image: null, role: "child", gender: "F" });
const maleAdult = getPersonImage({ image: null, role: "adult", gender: "M" });
const family = getPersonImage({ image: null, role: "family" });
const uploaded = getPersonImage({ image: "/api/files/1.png", role: "child", gender: "F" });
const placeholder = getPersonImage({ image: "noavatar.png", role: "child", gender: "F" });

const getTeacherImage = createPersonImageResolver({
  teacher: { default: "/images/teachers/default.webp", female: "/images/teachers/female.webp", male: "/images/teachers/male.webp" },
});
const teacher = getTeacherImage({ image: null, role: "teacher", gender: "F" });

const checks = {
  femaleChildStartsWith: femaleChild.startsWith("data:image/webp;base64,"),
  maleAdultStartsWith: maleAdult.startsWith("data:image/webp;base64,"),
  familyStartsWith: family.startsWith("data:image/webp;base64,"),
  uploaded,
  placeholderStartsWith: placeholder.startsWith("data:image/webp;base64,"),
  teacher,
};

console.log(JSON.stringify(checks));
`,
  );
  const install = Bun.spawn({
    cmd: ["npm", "install", "--no-audit", "--no-fund", "--silent"],
    cwd: dir,
    stdout: "inherit",
    stderr: "inherit",
  });
  const installExit = await install.exited;
  if (installExit !== 0) {
    throw new Error(`npm install failed with exit code ${installExit}`);
  }
  tempProjectDir = dir;
  return dir;
}

const suite = ENABLED ? describe : describe.skip;

suite("najm-kit/person-images packed consumer", () => {
  beforeAll(async () => {
    await ensureProject();
  });

  afterAll(() => {
    if (tempProjectDir) {
      rmSync(tempProjectDir, { recursive: true, force: true });
      tempProjectDir = null;
    }
  });

  test("imports the subpath and runs the built-in resolver", async () => {
    if (!tempProjectDir) throw new Error("temp project was not created");
    const proc = Bun.spawn({
      cmd: ["node", "index.mjs"],
      cwd: tempProjectDir,
      stdout: "pipe",
      stderr: "inherit",
    });
    const [exit, stdout] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
    ]);
    expect(exit).toBe(0);
    const result = JSON.parse(stdout.trim()) as {
      femaleChildStartsWith: boolean;
      maleAdultStartsWith: boolean;
      familyStartsWith: boolean;
      uploaded: string;
      placeholderStartsWith: boolean;
      teacher: string;
    };
    expect(result.femaleChildStartsWith).toBe(true);
    expect(result.maleAdultStartsWith).toBe(true);
    expect(result.familyStartsWith).toBe(true);
    expect(result.uploaded).toBe("/api/files/1.png");
    expect(result.placeholderStartsWith).toBe(true);
    expect(result.teacher).toBe("/images/teachers/female.webp");
  });

  test("the subpath resolves through the published exports map", async () => {
    if (!tempProjectDir) throw new Error("temp project was not created");
    const pkgPath = join(tempProjectDir, "node_modules", "najm-kit", "package.json");
    const pkg = JSON.parse(await Bun.file(pkgPath).text()) as {
      exports?: Record<string, { import?: string; default?: string; types?: string }>;
    };
    const entry = pkg.exports?.[PERSON_IMAGES_EXPORT];
    expect(entry).toBeDefined();
    const importTarget = entry?.import ?? entry?.default;
    expect(importTarget).toBe("./dist/person-images.mjs");
    expect(entry?.types).toBe("./dist/person-images.d.ts");
    const resolved = join(tempProjectDir, "node_modules", "najm-kit", (importTarget ?? "").replace(/^\.\//, ""));
    expect(existsSync(resolved)).toBe(true);
  });
});

if (!ENABLED) {
  test("packed-package consumer test is opt-in", () => {
    // Surface the gate in the default test run so the operator knows the
    // heavy consumer check exists and how to enable it.
    expect(ENABLED).toBe(false);
  });
}
