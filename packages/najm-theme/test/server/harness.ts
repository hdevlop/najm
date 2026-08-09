import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { STANDARD_BRANDING_SLOTS } from "../../src/contracts/branding";
import type { NajmDesignConfig } from "../../src/contracts";
import { AppearanceRepository } from "../../src/server/appearance/AppearanceRepository";
import { AppearanceService } from "../../src/server/appearance/AppearanceService";
import { AppearanceValidator } from "../../src/server/appearance/AppearanceValidator";
import { BrandingAssetService } from "../../src/server/branding/BrandingAssetService";
import { BrandingRepository } from "../../src/server/branding/BrandingRepository";
import { BrandingService } from "../../src/server/branding/BrandingService";
import { BrandingValidator } from "../../src/server/branding/BrandingValidator";
import type { ThemeAuditEvent } from "../../src/server/audit/ThemeAuditEvents";
import type { ThemeAuditSink } from "../../src/server/audit/ThemeAuditSink";
import {
  resolveThemeConfig,
  type NajmThemePluginConfig,
  type ResolvedThemeConfig,
} from "../../src/server/config";
import { ThemePresetRepository } from "../../src/server/presets/ThemePresetRepository";
import { ThemePresetService } from "../../src/server/presets/ThemePresetService";
import { ThemePresetValidator } from "../../src/server/presets/ThemePresetValidator";
import type { ThemeDiagnostic } from "../../src/contracts/diagnostics";
import { themeSchema } from "../../src/schema/sqlite";

// ============================================================================
// A real SQLite database, the real repositories, and the real services.
//
// Only two things are stood in for. `TransactionService` is reproduced here
// with the same BEGIN/COMMIT/ROLLBACK the framework's SQLite path uses, because
// building a container to get one would test the container rather than this
// package. And storage is an in-memory map, because what the branding tests
// need to establish is the *ordering* — commit before unlink — not that
// `najm-storage` can write a file.
// ============================================================================

export const DDL = `
CREATE TABLE najm_theme_appearance (
  scope_id text PRIMARY KEY NOT NULL,
  design_config text,
  revision integer DEFAULT 1 NOT NULL,
  updated_by_actor_id text,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  CONSTRAINT najm_theme_appearance_revision_positive CHECK (revision > 0)
);

CREATE TABLE najm_theme_branding (
  scope_id text PRIMARY KEY NOT NULL,
  slot_config text DEFAULT '{}' NOT NULL,
  revision integer DEFAULT 1 NOT NULL,
  updated_by_actor_id text,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  CONSTRAINT najm_theme_branding_revision_positive CHECK (revision > 0)
);

CREATE TABLE najm_theme_presets (
  id text PRIMARY KEY NOT NULL,
  scope_id text NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  design_config text NOT NULL,
  is_built_in integer DEFAULT 0 NOT NULL,
  created_by_actor_id text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE UNIQUE INDEX najm_theme_presets_scope_slug_idx ON najm_theme_presets (scope_id, slug);
CREATE INDEX najm_theme_presets_scope_created_idx ON najm_theme_presets (scope_id, created_at);
`;

export const FACTORY_DESIGN: NajmDesignConfig = {
  version: 1,
  theme: { preset: "light", tokens: { primary: "#111827", background: "#ffffff" } },
  typography: { fontSans: "Inter, sans-serif" },
};

export const FACTORY_BRANDING = {
  sidebarLogoExpanded: "/brand/logo.png",
  authHeroImage: "/brand/hero.jpg",
};

/** A `Buffer` that really is a 1×1 PNG, so the image probe accepts it. */
export function onePixelPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

/** Not an image at all — an HTML document with a PNG file name's ambitions. */
export function notAnImage(): Buffer {
  return Buffer.from("<html><script>alert(1)</script></html>", "utf8");
}

interface StoredFile {
  data: Buffer;
  mimeType: string;
  createdAt: string;
}

export class FakeStorage {
  readonly files = new Map<string, Map<string, StoredFile>>();
  /** Set to make the next delete throw, for the cleanup-failure paths. */
  failDeletes = false;

  private ns(namespace: string) {
    let bucket = this.files.get(namespace);
    if (!bucket) {
      bucket = new Map();
      this.files.set(namespace, bucket);
    }
    return bucket;
  }

  async save(namespace: string, filePath: string, data: Buffer, mimeType: string) {
    this.ns(namespace).set(filePath, { data, mimeType, createdAt: new Date().toISOString() });
  }

  async get(namespace: string, filePath: string) {
    return this.ns(namespace).get(filePath)?.data ?? null;
  }

  async delete(namespace: string, filePath: string) {
    if (this.failDeletes) throw new Error("storage is unavailable");
    return this.ns(namespace).delete(filePath);
  }

  async list(namespace: string) {
    return [...this.ns(namespace).entries()].map(([path, file]) => ({
      path,
      createdAt: file.createdAt,
    }));
  }

  /** Backdates a file so reconciliation sees it as past the grace period. */
  age(namespace: string, filePath: string, ms: number) {
    const file = this.ns(namespace).get(filePath);
    if (file) file.createdAt = new Date(Date.now() - ms).toISOString();
  }

  count(namespace: string) {
    return this.ns(namespace).size;
  }
}

export interface Harness {
  sqlite: Database;
  db: ReturnType<typeof drizzle>;
  config: ResolvedThemeConfig;
  appearance: AppearanceService;
  appearanceRepository: AppearanceRepository;
  branding: BrandingService;
  brandingRepository: BrandingRepository;
  assets: BrandingAssetService;
  presets: ThemePresetService;
  storage: FakeStorage;
  audits: ThemeAuditEvent[];
  diagnostics: ThemeDiagnostic[];
  close(): void;
}

export function baseConfig(
  overrides: Partial<NajmThemePluginConfig> = {},
): NajmThemePluginConfig {
  return {
    features: {
      appearance: true,
      branding: true,
      presets: true,
      assetUploads: true,
      mcp: false,
      ...overrides.features,
    },
    dialect: "sqlite",
    schema: themeSchema,
    publicRead: true,
    factory: {
      appearance: () => structuredClone(FACTORY_DESIGN),
      branding: () => ({ ...FACTORY_BRANDING }),
      ...overrides.factory,
    },
    guards: {
      manageAppearance: [() => {}],
      manageBranding: [() => {}],
      managePresets: [() => {}],
      ...overrides.guards,
    },
    brandingSlots: overrides.brandingSlots ?? STANDARD_BRANDING_SLOTS,
    ...overrides,
    // Re-applied after the spread so a partial `features` override does not
    // replace the whole object.
    ...(overrides.features
      ? {
          features: {
            appearance: true,
            branding: true,
            presets: true,
            assetUploads: true,
            mcp: false,
            ...overrides.features,
          },
        }
      : {}),
  } as NajmThemePluginConfig;
}

export function makeHarness(overrides: Partial<NajmThemePluginConfig> = {}): Harness {
  const sqlite = new Database(":memory:");
  sqlite.exec(DDL);
  const db = drizzle(sqlite, { schema: themeSchema });

  const audits: ThemeAuditEvent[] = [];
  const diagnostics: ThemeDiagnostic[] = [];

  const audit: ThemeAuditSink = { record: (event) => void audits.push(event) };

  const config = resolveThemeConfig(
    baseConfig({
      audit,
      diagnostics: (diagnostic) => void diagnostics.push(diagnostic),
      // The default grace period is a day; the reconciliation tests backdate
      // files past whatever this is, so the minimum keeps them readable.
      storage: { orphanGraceMs: 60 * 60 * 1000, ...overrides.storage },
      ...overrides,
    }),
  );

  // Mirrors `TransactionService`'s better-sqlite3 path: an explicit BEGIN so an
  // async callback can span the transaction, and a ROLLBACK that never masks
  // the original failure.
  //
  // The queue is not decoration. One SQLite connection cannot nest BEGIN, and a
  // PostgreSQL row lock serializes two savers of the same scope anyway — so
  // running transactions one at a time is what both dialects actually do. It is
  // also what makes the concurrency test mean something: without it the second
  // writer fails on "transaction within a transaction" and never reaches the
  // revision check that is the thing under test.
  let queue: Promise<unknown> = Promise.resolve();

  const transactions = {
    run<T>(body: (transaction: unknown) => Promise<T>): Promise<T> {
      const next = queue.then(async () => {
        sqlite.exec("BEGIN");
        try {
          const result = await body(db);
          sqlite.exec("COMMIT");
          return result;
        } catch (error) {
          try {
            sqlite.exec("ROLLBACK");
          } catch {
            // Preserve the original failure.
          }
          throw error;
        }
      });

      // The queue must not inherit the rejection, or one failed mutation would
      // fail every mutation queued behind it.
      queue = next.catch(() => undefined);
      return next;
    },
  };

  const storage = new FakeStorage();

  const wire = <T extends object>(instance: T): T => {
    Object.assign(instance, { config, db, schema: themeSchema });
    return instance;
  };

  const appearanceRepository = wire(new AppearanceRepository());
  const brandingRepository = wire(new BrandingRepository());
  const presetRepository = wire(new ThemePresetRepository());

  const appearanceValidator = wire(new AppearanceValidator());
  const brandingValidator = wire(new BrandingValidator());
  const presetValidator = wire(new ThemePresetValidator());

  const assets = wire(new BrandingAssetService());
  Object.assign(assets, { storage });

  const appearance = wire(
    new AppearanceService(appearanceRepository, appearanceValidator, transactions as never),
  );
  const branding = wire(
    new BrandingService(brandingRepository, brandingValidator, assets, transactions as never),
  );
  const presets = wire(
    new ThemePresetService(
      presetRepository,
      presetValidator,
      appearanceValidator,
      appearance,
      transactions as never,
    ),
  );

  return {
    sqlite,
    db,
    config,
    appearance,
    appearanceRepository,
    branding,
    brandingRepository,
    assets,
    presets,
    storage,
    audits,
    diagnostics,
    close: () => sqlite.close(),
  };
}
