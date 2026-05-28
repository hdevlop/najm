# Plan: Add File Preview to Storage Studio

> **Scope:** Enhance the `najm-storage-studio` UI to preview more file types, and add optional backend preview/thumbnail generation to `najm-storage`.
> **Current State:** The frontend already previews images & videos via raw URLs. Everything else shows "Preview not available". The backend has zero preview infrastructure (no thumbnails, no processing).

---

## Phase 1 — Frontend-Only Preview Expansion (Quick Wins)

**Goal:** Support more file categories in `PreviewSheet` using the existing `GET /:namespace/files/serve/*` endpoint. No backend changes required.

**Important constraint:** Do not assume raw media elements can send custom auth headers. If a deployment protects storage with bearer headers, `<img>`, `<video>`, `<audio>`, `<iframe>`, `window.open()`, and download links will not include `getAuthHeaders()`. Phase 1 should support:

- Same-origin cookie-authenticated URLs directly.
- Header-authenticated files through `fetch(..., { headers: getAuthHeaders() })` converted to `Blob` object URLs for inline previews.
- Large downloads/open-in-new-tab through the existing presign/share flow rather than raw protected URLs.

### 1.1 Extend `PreviewSheet` (`packages/najm-storage-studio/src/features/preview/components/PreviewSheet.tsx`)

| Category | Implementation |
|----------|----------------|
| **PDF** (`application/pdf`) | Render an `<iframe>` only when the URL is same-origin/cookie-safe or a generated blob URL. Otherwise show a presign/open action. |
| **Audio** (`audio/*`) | Render `<audio controls>` with the direct URL for cookie-safe deployments or a blob URL fetched with auth headers. |
| **Text / Code / JSON / CSV** (`text/*`, `application/json`, `application/javascript`, `text/csv`, `text/markdown`) | If `file.size <= 500KB`, fetch text with the studio auth headers and render inside a scrollable `<pre>` or lightweight code block. If larger, show "Preview too large" with download/open actions. |
| **Documents** (Word, Excel, PowerPoint) | Keep "Preview not available". Do not add external viewers by default because they require public URLs and may leak private file URLs. |

Implementation notes:

- Use `useStorageApi()` or a small helper to build authenticated blob URLs for protected previews.
- Revoke object URLs in `useEffect` cleanup when the file changes or the sheet closes.
- Keep a small loading/error state per fetched preview.

### 1.2 Add a Full-Screen / Lightbox Mode

- Wrap image and video previews in a **lightbox** component (e.g., `NDialog` or a custom overlay from `najm-ui`).
- Support `Escape` to close, arrow keys for prev/next (see Phase 3).
- For images, add basic zoom (scroll wheel / pinch).

### 1.3 Audio & Video Metadata (Optional)

- Use `HTMLMediaElement` (`video.audioTracks`, `video.videoWidth`) to display extra metadata (dimensions, duration) inside the preview sheet when available.

---

## Phase 2 — Backend Preview Generation

**Goal:** Add an on-demand thumbnail/preview endpoint so the studio can request smaller image variants and avoid loading 10MB+ originals for grid thumbnails.

### 2.1 Add Image Processing Dependency

In `packages/najm-storage/package.json`:
```json
"optionalDependencies": {
  "sharp": "^0.33.0"
}
```
Make it **optional** so the package still installs on platforms where sharp binaries are unavailable.

### 2.2 New Types & Config

In `packages/najm-storage/src/types.ts`:
```ts
export interface PreviewOptions {
  width?: number;
  height?: number;
  quality?: number;   // 1-100
  format?: 'jpeg' | 'png' | 'webp' | 'original';
  fit?: 'cover' | 'contain' | 'inside' | 'outside';
}
```

Add to `StorageConfig`:
```ts
preview?: {
  enabled?: boolean;
  cacheDir?: string;      // for local provider: where to cache thumbnails
  defaultQuality?: number;
  maxDimension?: number;  // safety cap (e.g., 2048)
  maxCacheBytes?: number;  // optional local cache limit
};
```

Merge defaults in `StoragePlugin.ts`:

```ts
preview: {
  enabled: config.preview?.enabled ?? false,
  cacheDir: config.preview?.cacheDir ?? '.thumbnails',
  defaultQuality: config.preview?.defaultQuality ?? 80,
  maxDimension: config.preview?.maxDimension ?? 2048,
  maxCacheBytes: config.preview?.maxCacheBytes,
}
```

The service must clamp request query values:

- `width` and `height`: integers from `1` to `preview.maxDimension`.
- `quality`: integer from `1` to `100`, defaulting to `preview.defaultQuality`.
- `format`: only `jpeg`, `png`, `webp`, or `original`.
- `fit`: only known Sharp fit values.

### 2.3 Provider Interface Extension

In `IStorageProvider` (`types.ts`):
```ts
getPreview?(namespace: string, filePath: string, options: PreviewOptions): Promise<Uint8Array | null>;
```

### 2.4 Local Provider Implementation (`LocalStorageProvider.ts`)

```
getPreview(ns, path, opts):
  1. If file category !== IMAGE → return null (fallback to original)
  2. Compute cache key using namespace, normalized path, original updated time or content stat, dimensions, fit, quality, and format
  3. If cached file exists and is newer than original → return it
  4. Dynamically import('sharp') (gracefully handle missing module)
  5. sharp(originalPath).resize(...).toFormat(...).toBuffer()
  6. Write to cache path
  7. Return buffer
```

Safety requirements:

- Pass `cacheDir` into `LocalStorageProvider` from `StorageService.configure()`.
- Keep cache files outside user namespaces, for example `<basePath>/.thumbnails/...`, and never expose them through `list()` or `listObjects()`.
- Clean stale thumbnails when files are deleted, moved, copied over, or overwritten.
- Avoid duplicate work for the same cache key by using an in-flight promise map.
- Apply an optional cache size limit if `maxCacheBytes` is configured.

### 2.5 DB Provider Implementation (`DbStorageProvider.ts`)

Option A (simpler): Generate preview on-the-fly from the BLOB every time, guarded by a small bounded LRU cache.
Option B (recommended): Add a `previewData`/`thumbData` BLOB column to the schema (or a separate `storage_file_previews` table) to cache generated thumbnails.

For minimal schema impact, start with **Option A** only if the LRU has explicit max entries/bytes and invalidates by `updatedAt` or a content hash. If that is too much for the first pass, leave DB provider previews unsupported and return `null`; do not silently add unbounded CPU work.

### 2.6 New Controller Endpoint (`StorageController.ts`)

```
GET /:namespace/files/preview/*?w=200&h=200&q=80&format=webp
```

- Parse query params into `PreviewOptions`.
- Call `StorageService.servePreview(namespace, filePath, options)`.
- If preview is disabled or provider returns `null`, either `302` redirect to the original `serve` URL for cookie-safe deployments or return `204`/JSON fallback for Studio API use. Pick one behavior and test it.
- Response headers: `Content-Type` (derived from requested format), `Cache-Control: public, max-age=31536000`.

The endpoint must use the same `extractFilePath()` pattern as `serveFile()` because Hono wildcard extraction is already known to be unreliable with `:namespace` plus `*`.

### 2.7 New Service Method (`StorageService.ts`)

```ts
async servePreview(ns: string, path: string, opts: PreviewOptions): Promise<Response | null> {
  if (!this.config.preview?.enabled) return null;
  const info = await this.getInfoOrThrow(ns, path);
  if (info.category !== FileCategory.IMAGE) return null; // let caller fallback
  if (!this.provider.getPreview) return null;
  const data = await this.provider.getPreview!(ns, path, opts);
  if (!data) return null;
  return new Response(data, {
    headers: {
      'Content-Type': mimeFromFormat(opts.format),
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}
```

### 2.8 Studio API Update (`StorageStudioController.ts`)

Add convenience route:
```
GET /preview-url?namespace=&path=&w=&h=&format=
```
Returns `{ url: string }` pointing to the new preview endpoint (or the original serve URL if preview is unavailable).

Also add a direct authenticated proxy route for protected previews:

```
GET /preview?namespace=&path=&w=&h=&format=
```

This route returns the binary preview/original using the same Studio auth path as the JSON API. The React app can fetch this route with `getAuthHeaders()` and convert it to a blob URL for media elements.

---

## Phase 3 — Studio UI Integration

**Goal:** Consume the new backend capabilities and polish the UX.

### 3.1 Thumbnails in File Grid (`ExplorerView` / `FileBrowser`)

- For `IMAGE` category, use the new preview endpoint as the tile thumbnail:
  ```
  /api/{namespace}/files/preview/{path}?w=256&h=256&format=webp
  ```
  Build this URL with per-segment `encodeURIComponent`, not string interpolation of raw paths.
- For `VIDEO` category, if the browser supports it, use `<video preload="metadata">` as the tile (or show a play icon overlay).
- For other categories, keep the existing icon from `getFileIcon()`.

If `getAuthHeaders()` returns headers, thumbnail images should use blob URLs fetched through the Studio proxy route instead of direct `<img src>` URLs.

### 3.2 Image Transform Stub → Functional

In `PreviewSheet`, the existing **Image Transforms** section (width/height/quality) should:
1. Build a query string using the new preview endpoint.
2. Show a live preview `<img>` with the transformed URL.
3. Add a "Copy Transform URL" button.

### 3.3 Prev / Next Navigation in Preview

- When `PreviewSheet` opens, accept the current list of visible files.
- Keyboard: `ArrowRight` → next file, `ArrowLeft` → previous file.
- Swipe gestures on mobile.

### 3.4 Loading & Error States

- Skeleton loader while fetching text or PDF.
- Error boundary / fallback to "Preview not available" if `fetch()` fails.
- Explicit "Preview too large" state for text/code files over the configured frontend cap.
- Revoke generated blob URLs to prevent memory leaks during next/previous navigation.

---

## Phase 4 — Testing & Rollout

### 4.1 Backend Tests (`packages/najm-storage/test/`)

- Mock `sharp` to test `LocalStorageProvider.getPreview()` without heavy native dependencies in CI.
- Assert cache hits: second request for same dimensions should read from disk, not re-process.
- Assert fallback: non-image files return `null` and controller redirects to original.
- Assert DB provider generates buffer from BLOB (mock sharp).
- Assert preview disabled returns fallback without calling provider preview generation.
- Assert width/height/quality/format query values are clamped or rejected.
- Assert encoded paths with spaces, `#`, and nested folders resolve correctly.
- Assert deleting/moving/overwriting a local file invalidates stale thumbnails.

### 4.2 Frontend Tests (`packages/najm-storage-studio/test/` if any)

- Component tests for `PreviewSheet` rendering correct tag per MIME type.
- Keyboard navigation tests for prev/next.
- Text preview tests for small, large, loading, and failed fetch states.
- Authenticated blob preview tests that verify `getAuthHeaders()` is used and object URLs are revoked.

### 4.3 Playground Integration

- Enable preview in `apps/playground/src/server/config/plugins.ts`:
  ```ts
  storage({
    provider: 'local',
    basePath: 'storage',
    studio: true,
    maxFileSize: 100 * 1024 * 1024,
    preview: { enabled: true, cacheDir: '.cache/thumbnails' },
  })
  ```
- Ensure `sharp` is installed in the playground workspace (optional dep resolution).

### 4.4 Documentation Update

- Update package READMEs and website docs to mention:
  - New preview endpoint.
  - Optional `sharp` dependency.
  - Supported preview types.
  - Auth behavior: direct media URLs require cookie-safe access; bearer/header protected deployments should use Studio proxy/blob previews or presigned URLs.

---

## Files to Modify

| Package | File(s) | Change |
|---------|---------|--------|
| `najm-storage` | `package.json` | Add `sharp` to `optionalDependencies` |
| `najm-storage` | `src/types.ts` | Add `PreviewOptions`, `preview` config, provider method |
| `najm-storage` | `src/StoragePlugin.ts` | Validate & merge preview config |
| `najm-storage` | `src/StorageService.ts` | Add `servePreview()`, `getPreview()` helpers |
| `najm-storage` | `src/StorageController.ts` | Add `GET /:namespace/files/preview/*` route |
| `najm-storage` | `src/StorageStudioController.ts` | Add `/preview-url` helper endpoint and `/preview` authenticated proxy route |
| `najm-storage` | `src/providers/LocalStorageProvider.ts` | Implement `getPreview()` with sharp + disk cache |
| `najm-storage` | `src/providers/DbStorageProvider.ts` | Either implement bounded `getPreview()` or explicitly leave preview unsupported |
| `najm-storage-studio` | `src/features/preview/components/PreviewSheet.tsx` | Add PDF, audio, text/code renderers; wire image transforms |
| `najm-storage-studio` | `src/features/explorer/ExplorerView.tsx` | Pass file list to preview for prev/next; enable lightbox |
| `najm-storage-studio` | `src/features/explorer/FileBrowser.tsx` | Use preview endpoint for image thumbnails |
| `najm-storage-studio` | `src/features/explorer/hooks/useObjects.ts` (or similar) | Append direct or proxy preview URLs if needed |
| Playground | `src/server/config/plugins.ts` | Enable preview config |

---

## Open Questions / Decisions

1. **Should we add a separate `najm-storage-preview` plugin** to keep `sharp` (heavy native dep) out of the core storage package?
   - *Recommendation:* Keep it inside `najm-storage` as an optional feature. If `sharp` is missing, previews gracefully fall back to the original file.

2. **Video thumbnails:** Do we want to extract poster frames? This requires `ffmpeg` or similar — significantly heavier than `sharp`.
   - *Recommendation:* Skip for Phase 2. Use `<video preload="metadata">` in the UI as a lightweight alternative.

3. **DB schema change:** Do we cache thumbnails in the database or regenerate on every request?
   - *Recommendation:* Start with unsupported DB previews or a strictly bounded LRU invalidated by `updatedAt`. Add a DB cache only if profiling shows a bottleneck.

4. **Security:** Should the preview endpoint respect the same auth middleware as `serveFile`?
   - *Recommendation:* Yes — mount it on the same `StorageController` so existing guards and middleware apply automatically.

5. **Header-authenticated Studio previews:** How should the browser render protected media when custom headers are required?
   - *Recommendation:* Add a Studio proxy route and fetch previews with `getAuthHeaders()` into blob URLs. Use direct URLs only for same-origin cookie auth or presigned URLs.

---

## Estimated Effort

| Phase | Complexity | Approx. Time |
|-------|------------|--------------|
| Phase 1 (Frontend expansion) | Low | 1–2 days |
| Phase 2 (Backend generation) | Medium | 2–3 days |
| Phase 3 (UI integration) | Low–Medium | 1–2 days |
| Phase 4 (Tests & docs) | Low | 1 day |

**Total:** ~5–8 days for a single developer.
