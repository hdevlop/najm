// ============================================================================
// najm-theme/server — managed branding assets
// ============================================================================
//
// Everything that happens to an uploaded logo between the request and the byte
// a browser eventually caches for a year.
//
// The lifecycle has one rule that shapes all of it: the *database* decides what
// is real. A file exists in storage from the moment it is uploaded, but it is
// only a branding asset once a committed `slot_config` row references it. That
// ordering is what makes the failure modes survivable —
//
// - an upload that is never saved leaves an unreferenced file, cleaned up later
//   by reconciliation, and nothing renders wrongly in the meantime;
// - a save that commits and then fails to delete the file it replaced leaves an
//   unreferenced file, same outcome;
// - a delete that ran *before* the commit would leave a committed row pointing
//   at nothing, which is a broken page nobody can fix from the UI.
//
// So the file write always precedes the commit, and every file delete always
// follows one. There is no path in this file that unlinks inside a transaction.
// ============================================================================

import { Container, DI, Inject, Meta, Service } from "najm-core";

import type { BrandingSlotAsset, BrandingSlotDefinition } from "../../contracts/branding";
import { isBrandingAssetFileName } from "../../contracts/branding";
import { describeThrown, reportDiagnostic } from "../../contracts/diagnostics";
import type { ResolvedThemeConfig } from "../config";
import { STORAGE_SERVICE_TOKEN, resolvePeerService } from "../peers";
import { ThemeNotFoundError } from "../shared/errors";
import { THEME_CONFIG } from "../tokens";
import {
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  MIME_EXTENSIONS,
  normalizeDeclaredMime,
  probeImage,
  type ProbedMimeType,
} from "./imageProbe";

interface StorageLike {
  save(namespace: string, filePath: string, data: Buffer, mimeType: string): Promise<void>;
  get(namespace: string, filePath: string): Promise<Buffer | null>;
  delete(namespace: string, filePath: string): Promise<boolean>;
  list(namespace: string): Promise<{ name?: string; path?: string; createdAt?: string; updatedAt?: string }[]>;
}

@Service()
@Meta({ layer: "plugin" })
export class BrandingAssetService {
  @DI() private container!: Container;
  @Inject(THEME_CONFIG) private config!: ResolvedThemeConfig;

  private storage: StorageLike | null = null;
  private sharp: unknown = null;
  private sharpChecked = false;

  /**
   * Resolved here, not imported at module scope.
   *
   * `najm-storage` is an optional peer: a consumer that enabled Appearance and
   * Branding but not `assetUploads` should not have to install it, and a static
   * import would make it mandatory for everyone.
   *
   * Resolved by symbol rather than by `StorageService` — see `../peers`. The
   * class this package would import is not the class the application booted,
   * and resolving it builds a *second* storage service instead of failing, so
   * uploads land in a provider nothing serves from.
   */
  async activate(): Promise<void> {
    if (!this.config.features.assetUploads) return;

    this.storage = await resolvePeerService<StorageLike>(
      this.container,
      STORAGE_SERVICE_TOKEN,
      {
        packageName: "najm-storage",
        feature: "assetUploads",
        registration: ".use(storage({ … }))",
      },
    );
  }

  // --------------------------------------------------------------------------
  // Namespacing
  // --------------------------------------------------------------------------

  /**
   * One namespace per scope.
   *
   * Not one namespace with the scope in the file name: a namespace is what
   * `najm-storage` isolates on, so a per-scope namespace makes "read another
   * tenant's asset" impossible at the storage layer rather than dependent on a
   * check in this file being right every time.
   */
  namespaceFor(scopeId: string): string {
    return `${this.config.storage.namespace}-${scopeId}`;
  }

  /** The public URL a committed asset is served from. */
  publicPathFor(fileName: string): string {
    return `${this.config.basePath}/branding/assets/${fileName}`;
  }

  // --------------------------------------------------------------------------
  // Upload
  // --------------------------------------------------------------------------

  /**
   * Validates, normalizes, and stores one candidate.
   *
   * "Candidate" is the whole distinction: this returns a reference the caller
   * may put into a save, and until a save commits it, the file is an orphan
   * that reconciliation is entitled to remove.
   */
  async uploadCandidate(input: {
    scopeId: string;
    slot: BrandingSlotDefinition;
    body: ArrayBuffer;
    declaredMimeType: string | undefined;
  }): Promise<BrandingSlotAsset> {
    const storage = this.requireStorage();
    const { slot } = input;

    if (input.body.byteLength === 0) {
      throw new TypeError("the uploaded file is empty");
    }
    // Checked before anything decodes it. A size limit applied after a decode
    // is a size limit that already paid for the decode.
    if (input.body.byteLength > slot.maxBytes) {
      throw new TypeError(
        `${slot.key} accepts at most ${slot.maxBytes} bytes (received ${input.body.byteLength})`,
      );
    }

    // Annotated rather than inferred: `Buffer.from(ArrayBuffer)` narrows to
    // `Buffer<ArrayBuffer>`, and the normalized bytes below come back as the
    // wider `Buffer<ArrayBufferLike>` that Sharp returns.
    let bytes: Buffer = Buffer.from(input.body);

    const probed = probeImage(bytes);
    if (!probed) {
      throw new TypeError("the uploaded file is not a PNG, JPEG, or WebP image");
    }

    const declared = normalizeDeclaredMime(input.declaredMimeType);
    if (declared && declared !== probed.mimeType) {
      throw new TypeError(
        `the declared content type ${declared} does not match the file's actual format`,
      );
    }
    if (!slot.acceptedMimeTypes.includes(probed.mimeType)) {
      throw new TypeError(
        `${slot.key} accepts ${slot.acceptedMimeTypes.join(", ")} (received ${probed.mimeType})`,
      );
    }

    if (
      probed.width < 1
      || probed.height < 1
      || probed.width > MAX_IMAGE_DIMENSION
      || probed.height > MAX_IMAGE_DIMENSION
      || probed.width * probed.height > MAX_IMAGE_PIXELS
    ) {
      throw new TypeError(
        `the image's dimensions (${probed.width}×${probed.height}) exceed what this package will decode`,
      );
    }

    let mimeType: ProbedMimeType = probed.mimeType;
    if (this.config.storage.normalize) {
      const normalized = await this.normalize(bytes, probed.mimeType);
      if (normalized) {
        bytes = normalized.bytes;
        mimeType = normalized.mimeType;
        // Re-encoding can grow a file — a heavily-optimized PNG round-tripped
        // through a general encoder routinely does — so the ceiling is enforced
        // again on what will actually be stored and served.
        if (bytes.byteLength > slot.maxBytes) {
          throw new TypeError(
            `${slot.key} accepts at most ${slot.maxBytes} bytes; the normalized image is ${bytes.byteLength}`,
          );
        }
      }
    }

    // A UUID, never the uploader's file name. Committed assets are served
    // immutable for a year, so a name that could repeat would be a replacement
    // no cache ever sees — and a name derived from user input is a path
    // traversal waiting for one bug in one join.
    const fileName = `${crypto.randomUUID()}.${MIME_EXTENSIONS[mimeType]}`;
    await storage.save(this.namespaceFor(input.scopeId), fileName, bytes, mimeType);

    return {
      fileName,
      mimeType,
      bytes: bytes.byteLength,
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * Decode and re-encode through Sharp, when it is available.
   *
   * This is what turns "the magic bytes say PNG" into "this is a PNG": a
   * round trip through a decoder drops trailing payloads, malformed ancillary
   * chunks, and embedded metadata — including the EXIF GPS coordinates in a
   * logo somebody exported from a phone.
   *
   * Returns `null` when Sharp is not installed, which is a supported
   * configuration: the probe, the MIME agreement check, and the dimension
   * bounds have all already run.
   */
  private async normalize(
    bytes: Buffer,
    mimeType: ProbedMimeType,
  ): Promise<{ bytes: Buffer; mimeType: ProbedMimeType } | null> {
    const sharp = await this.loadSharp();
    if (!sharp) return null;

    const pipeline = (sharp as (input: Buffer, options?: unknown) => any)(bytes, {
      // A second bomb guard, at the decoder this time: the header said the
      // image was small enough, and the header is part of the file.
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).rotate();

    const encoded: Buffer =
      mimeType === "image/png"
        ? await pipeline.png().toBuffer()
        : mimeType === "image/webp"
          ? await pipeline.webp().toBuffer()
          : await pipeline.jpeg().toBuffer();

    return { bytes: encoded, mimeType };
  }

  private async loadSharp(): Promise<unknown> {
    if (this.sharpChecked) return this.sharp;
    this.sharpChecked = true;
    try {
      const module = (await import("sharp")) as { default?: unknown };
      this.sharp = module.default ?? module;
    } catch {
      // Optional dependency, and the caller has a documented fallback. A
      // missing native module is a deployment fact, not an error.
      this.sharp = null;
    }
    return this.sharp;
  }

  /**
   * Re-derives an uploaded file's real type and size at commit time.
   *
   * The client sends back only a file name. Everything else about the asset —
   * the MIME type that becomes a `Content-Type`, the byte count that is checked
   * against the slot ceiling — is read from the stored bytes here rather than
   * taken from the request, because a client that could name its own MIME type
   * could name `text/html` and turn the branding route into a same-origin
   * script host.
   */
  async describeCandidate(input: {
    scopeId: string;
    slot: BrandingSlotDefinition;
    fileName: string;
  }): Promise<BrandingSlotAsset> {
    const storage = this.requireStorage();

    if (!isBrandingAssetFileName(input.fileName)) {
      throw new TypeError("that is not a managed branding asset name");
    }

    const data = await storage.get(this.namespaceFor(input.scopeId), input.fileName);
    if (!data) {
      throw new ThemeNotFoundError(
        `branding asset ${input.fileName} was not found — upload it again before saving`,
      );
    }

    const probed = probeImage(data);
    if (!probed || !input.slot.acceptedMimeTypes.includes(probed.mimeType)) {
      throw new TypeError(
        `${input.slot.key} accepts ${input.slot.acceptedMimeTypes.join(", ")}`,
      );
    }
    if (data.byteLength > input.slot.maxBytes) {
      throw new TypeError(`${input.slot.key} accepts at most ${input.slot.maxBytes} bytes`);
    }

    return {
      fileName: input.fileName,
      mimeType: probed.mimeType,
      bytes: data.byteLength,
      uploadedAt: new Date().toISOString(),
    };
  }

  // --------------------------------------------------------------------------
  // Delivery
  // --------------------------------------------------------------------------

  /**
   * Serves a committed asset, and only a committed asset.
   *
   * `referencedFileNames` comes from the scope's saved slot map, so an upload
   * that was never saved is not reachable through this route even by someone
   * who knows its name. That is what keeps the upload endpoint from doubling as
   * an open file host.
   */
  async serve(input: {
    scopeId: string;
    fileName: string;
    referencedFileNames: ReadonlySet<string>;
    mimeTypeByFileName: ReadonlyMap<string, string>;
  }): Promise<Response> {
    const storage = this.requireStorage();

    // Both checks answer 404 identically. The shape check alone would let
    // `../../etc/passwd` be distinguishable from an unreferenced UUID.
    if (!isBrandingAssetFileName(input.fileName) || !input.referencedFileNames.has(input.fileName)) {
      throw new ThemeNotFoundError("branding asset not found");
    }

    const data = await storage.get(this.namespaceFor(input.scopeId), input.fileName);
    if (!data) throw new ThemeNotFoundError("branding asset not found");

    return new Response(new Uint8Array(data), {
      headers: {
        // The stored MIME, never one derived from the request or re-sniffed
        // per read. `nosniff` then stops a browser from second-guessing it.
        "Content-Type": input.mimeTypeByFileName.get(input.fileName) ?? "application/octet-stream",
        "Content-Length": String(data.length),
        "X-Content-Type-Options": "nosniff",
        // Safe precisely because the name is content-independent: a replacement
        // is a different URL, so nothing has to expire for it to appear.
        "Cache-Control": `public, max-age=${this.config.storage.cacheMaxAge}, immutable`,
      },
    });
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  /**
   * Deletes a candidate the client is abandoning.
   *
   * Refuses committed files outright. A "cancel my draft" request that could
   * delete the logo currently on every page would be a one-request outage, and
   * the client cannot always tell which of its candidates were meanwhile saved
   * by someone else.
   */
  async deleteCandidate(input: {
    scopeId: string;
    fileName: string;
    referencedFileNames: ReadonlySet<string>;
  }): Promise<{ deleted: boolean }> {
    const storage = this.requireStorage();

    if (!isBrandingAssetFileName(input.fileName)) {
      throw new TypeError("that is not a managed branding asset name");
    }
    if (input.referencedFileNames.has(input.fileName)) {
      throw new TypeError(
        "that asset is in use by a saved branding slot; clear the slot and save instead",
      );
    }

    return { deleted: await storage.delete(this.namespaceFor(input.scopeId), input.fileName) };
  }

  /**
   * Removes files a committed save superseded. Best effort, always post-commit.
   *
   * Failure here is a diagnostic and nothing more. The save is already durable
   * and correct; a file that outlives its reference is wasted bytes, and
   * reporting that as a failed request would invite a retry of a mutation that
   * already landed.
   */
  async cleanupReplaced(scopeId: string, fileNames: readonly string[]): Promise<void> {
    if (!this.storage || fileNames.length === 0) return;

    for (const fileName of fileNames) {
      if (!isBrandingAssetFileName(fileName)) continue;
      try {
        await this.storage.delete(this.namespaceFor(scopeId), fileName);
      } catch (error) {
        reportDiagnostic(this.config.diagnostics, {
          code: "asset.cleanup-failed",
          scopeId,
          detail: "a replaced branding asset could not be removed",
          error: describeThrown(error),
        });
      }
    }
  }

  /** The same best-effort delete, reported under the draft-cancellation code. */
  async cleanupCandidates(scopeId: string, fileNames: readonly string[]): Promise<void> {
    if (!this.storage || fileNames.length === 0) return;

    for (const fileName of fileNames) {
      if (!isBrandingAssetFileName(fileName)) continue;
      try {
        await this.storage.delete(this.namespaceFor(scopeId), fileName);
      } catch (error) {
        reportDiagnostic(this.config.diagnostics, {
          code: "asset.candidate-cleanup-failed",
          scopeId,
          detail: "an abandoned candidate upload could not be removed",
          error: describeThrown(error),
        });
      }
    }
  }

  /**
   * Deletes unreferenced assets older than the configured grace period.
   *
   * Two conditions, and both are load-bearing. Unreferenced alone would delete
   * the upload an administrator made ninety seconds ago and is about to save —
   * a draft in progress is *supposed* to be unreferenced. Old alone would
   * delete the logo on every page.
   *
   * Nothing here can reach a factory asset: those live in the application's
   * build output, not in this namespace.
   */
  async reconcile(input: {
    scopeId: string;
    referencedFileNames: ReadonlySet<string>;
  }): Promise<{ deleted: number; skipped: number }> {
    const storage = this.requireStorage();
    const namespace = this.namespaceFor(input.scopeId);
    const cutoff = Date.now() - this.config.storage.orphanGraceMs;

    let files: Awaited<ReturnType<StorageLike["list"]>>;
    try {
      files = await storage.list(namespace);
    } catch (error) {
      reportDiagnostic(this.config.diagnostics, {
        code: "asset.reconcile-failed",
        scopeId: input.scopeId,
        detail: "the branding namespace could not be listed",
        error: describeThrown(error),
      });
      return { deleted: 0, skipped: 0 };
    }

    let deleted = 0;
    let skipped = 0;

    for (const file of files) {
      const fileName = file.path ?? file.name ?? "";
      if (!isBrandingAssetFileName(fileName) || input.referencedFileNames.has(fileName)) {
        skipped += 1;
        continue;
      }

      // An unparseable or missing timestamp keeps the file. Treating "unknown
      // age" as "old enough" is how a cleanup job deletes a fresh upload.
      const createdAt = Date.parse(file.createdAt ?? file.updatedAt ?? "");
      if (!Number.isFinite(createdAt) || createdAt > cutoff) {
        skipped += 1;
        continue;
      }

      try {
        if (await storage.delete(namespace, fileName)) deleted += 1;
      } catch (error) {
        skipped += 1;
        reportDiagnostic(this.config.diagnostics, {
          code: "asset.reconcile-failed",
          scopeId: input.scopeId,
          detail: "an unreferenced branding asset could not be removed",
          error: describeThrown(error),
        });
      }
    }

    return { deleted, skipped };
  }

  private requireStorage(): StorageLike {
    if (!this.storage) {
      throw new Error(
        "theme branding assets are not available — enable features.assetUploads and register the storage() plugin",
      );
    }
    return this.storage;
  }
}
