import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertCleanStatus,
  bumpVersion,
  parseArgs,
  readPackingCommit,
  resolveTarget,
  sidecarPath,
  sha256OfFile,
} from "./publish-package";

describe("parseArgs", () => {
  test("parses package reference", () => {
    const opts = parseArgs(["najm-kit"]);
    expect(opts.packageRef).toBe("najm-kit");
    expect(opts.dryRun).toBe(false);
    expect(opts.skipWhoami).toBe(false);
    expect(opts.packOnly).toBe(false);
    expect(opts.tarballDir).toBe("dist-publish");
  });

  test("enables pack-only flag", () => {
    const opts = parseArgs(["najm-kit", "--pack-only"]);
    expect(opts.packOnly).toBe(true);
  });

  test("captures publish-tarball path", () => {
    const opts = parseArgs(["najm-kit", "--publish-tarball", "dist/foo.tgz"]);
    expect(opts.publishTarball).toBe("dist/foo.tgz");
  });

  test("captures verify-published version", () => {
    const opts = parseArgs(["najm-kit", "--verify-published", "2.1.49"]);
    expect(opts.verifyPublished).toBe("2.1.49");
  });

  test("captures tarball-dir override", () => {
    const opts = parseArgs(["najm-kit", "--tarball-dir", "artifacts"]);
    expect(opts.tarballDir).toBe("artifacts");
  });

  test("keeps version preparation separate from packing", () => {
    expect(() => parseArgs(["najm-kit", "--pack-only", "--patch"]))
      .toThrow(/cannot be combined/);
  });

  test("rejects unknown arguments", () => {
    expect(() => parseArgs(["najm-kit", "--bogus"])).toThrow(/Unknown argument/);
    expect(() => parseArgs(["najm-kit", "--no-build"])).toThrow(/Unknown argument/);
  });

  test("requires a package reference when not verifying", () => {
    expect(() => parseArgs([])).toThrow(/Missing package/);
  });

  test("allows empty package reference when verifying published", () => {
    const opts = parseArgs(["--verify-published", "2.1.49"]);
    expect(opts.packageRef).toBeUndefined();
    expect(opts.verifyPublished).toBe("2.1.49");
  });

  test("combines publish-tarball with dry-run, tag, access, otp", () => {
    const opts = parseArgs([
      "najm-kit",
      "--publish-tarball",
      "a.tgz",
      "--dry-run",
      "--tag",
      "next",
      "--access",
      "public",
      "--otp",
      "123456",
    ]);
    expect(opts.dryRun).toBe(true);
    expect(opts.publishTarball).toBe("a.tgz");
    expect(opts.tag).toBe("next");
    expect(opts.access).toBe("public");
    expect(opts.otp).toBe("123456");
  });
});

describe("resolveTarget", () => {
  test("resolves by package name", () => {
    const target = resolveTarget("najm-kit");
    expect(target.name).toBe("najm-kit");
  });

  test("resolves by workspace path", () => {
    const target = resolveTarget("packages/najm-kit");
    expect(target.workspace).toBe("packages/najm-kit");
  });

  test("throws on unknown package", () => {
    expect(() => resolveTarget("nope")).toThrow(/Unknown package/);
  });
});

describe("bumpVersion", () => {
  test("bumps patch", () => {
    expect(bumpVersion("2.1.48", "patch")).toBe("2.1.49");
  });

  test("bumps minor", () => {
    expect(bumpVersion("2.1.48", "minor")).toBe("2.2.0");
  });

  test("bumps major", () => {
    expect(bumpVersion("2.1.48", "major")).toBe("3.0.0");
  });

  test("rejects non-semver", () => {
    expect(() => bumpVersion("abc", "patch")).toThrow(/semver/);
  });
});

describe("release worktree gate", () => {
  test("accepts an empty porcelain status", () => {
    expect(() => assertCleanStatus("\n")).not.toThrow();
  });

  test("rejects tracked and untracked release inputs", () => {
    expect(() => assertCleanStatus(" M packages/najm-auth/src/index.ts\n?? docs/release.md\n"))
      .toThrow(/clean worktree/);
  });
});

describe("sha256OfFile", () => {
  let dir: string;
  let file: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "najm-publish-sha-"));
    file = join(dir, "sample.txt");
    writeFileSync(file, "najm-kit");
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("hashes a known file", () => {
    const hash = sha256OfFile(file);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  test("returns the same hash on repeated calls", () => {
    expect(sha256OfFile(file)).toBe(sha256OfFile(file));
  });
});

describe("sidecarPath", () => {
  test("appends the .commit suffix", () => {
    expect(sidecarPath("/tmp/najm-kit-2.1.49.tgz")).toBe(
      "/tmp/najm-kit-2.1.49.tgz.commit",
    );
  });
});

describe("readPackingCommit", () => {
  let dir: string;
  let tarball: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "najm-publish-sidecar-"));
    tarball = join(dir, "najm-kit-2.1.49.tgz");
    writeFileSync(tarball, "tarball-bytes");
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("returns null when the sidecar is missing", () => {
    expect(readPackingCommit(tarball)).toBeNull();
  });

  test("reads the recorded commit when the sidecar exists", () => {
    writeFileSync(sidecarPath(tarball), "abcdef1234567890\n", "utf8");
    expect(readPackingCommit(tarball)).toBe("abcdef1234567890");
  });

  test("trims trailing whitespace", () => {
    writeFileSync(sidecarPath(tarball), "  abcdef  \n", "utf8");
    expect(readPackingCommit(tarball)).toBe("abcdef");
  });
});

describe("tarball sidecar integration", () => {
  let dir: string;
  let tarball: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "najm-publish-integ-"));
    mkdirSync(dir, { recursive: true });
    tarball = join(dir, "najm-kit-2.1.49.tgz");
    writeFileSync(tarball, "najm-kit-tarball-bytes");
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("sha256 matches the sha256 reported on disk", () => {
    expect(sha256OfFile(tarball)).toBe(sha256OfFile(tarball));
  });

  test("packing commit sidecar round-trips", () => {
    const commit = "0123456789abcdef0123456789abcdef01234567";
    writeFileSync(sidecarPath(tarball), `${commit}\n`, "utf8");
    expect(readPackingCommit(tarball)).toBe(commit);
  });
});
