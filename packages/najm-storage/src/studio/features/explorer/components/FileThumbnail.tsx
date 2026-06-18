import React, { useEffect, useState } from 'react';
import { NFileTypeIcon } from 'najm-kit';
import { useStudio } from '../../../providers';

export function FolderThumbnail({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const dim =
    size === 'xl' ? 'h-20 w-20' :
    size === 'lg' ? 'h-16 w-16' :
    size === 'md' ? 'h-8 w-8' :
    'h-5 w-5';

  return (
    <span className={`inline-flex ${dim} shrink-0 items-end justify-center`} aria-hidden="true">
      <svg viewBox="0 0 80 80" className="h-full w-full overflow-visible" fill="none">
        <path
          d="M6 20.5C6 16.9 8.9 14 12.5 14h18.6c2 0 3.9.9 5.2 2.5l4.5 5.5h26.7c3.6 0 6.5 2.9 6.5 6.5v33C74 65.1 71.1 68 67.5 68h-55C8.9 68 6 65.1 6 61.5v-41Z"
          className="fill-sky-500"
        />
        <path
          d="M6 30h68v31.5c0 3.6-2.9 6.5-6.5 6.5h-55C8.9 68 6 65.1 6 61.5V30Z"
          className="fill-sky-500"
        />
      </svg>
    </span>
  );
}

function buildPreviewUrl(storageApiBase: string, namespace: string, filePath: string): string {
  const qs = new URLSearchParams();
  qs.set('w', '256');
  qs.set('h', '256');
  qs.set('format', 'webp');
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  return `${storageApiBase}/${encodeURIComponent(namespace)}/files/preview/${encodedPath}?${qs}`;
}

function buildProxyUrl(apiBase: string, namespace: string, filePath: string): string {
  const qs = new URLSearchParams();
  qs.set('namespace', namespace);
  qs.set('path', filePath);
  qs.set('w', '256');
  qs.set('h', '256');
  qs.set('format', 'webp');
  return `${apiBase}/preview?${qs}`;
}

export function FileThumbnail({
  mimeType,
  url,
  fileName,
  size = 'md',
  namespace,
  filePath,
}: {
  mimeType: string;
  url?: string;
  fileName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  namespace?: string;
  filePath?: string;
}) {
  const { apiBase, storageApiBase, getAuthHeaders } = useStudio();
  const [blobUrl, setBlobUrl] = useState<string | undefined>(url);
  const isImage = /^image\//.test(mimeType);
  const isGrid = size === 'xl';

  useEffect(() => {
    if (!isImage || !isGrid || !namespace || !filePath) {
      setBlobUrl(url);
      return;
    }

    const directUrl = buildPreviewUrl(storageApiBase, namespace, filePath);
    const headers = getAuthHeaders();
    const hasAuth = Object.keys(headers).length > 0;

    if (!hasAuth) {
      setBlobUrl(directUrl);
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | undefined;
    const proxyUrl = buildProxyUrl(apiBase, namespace, filePath);

    fetch(proxyUrl, { headers, credentials: 'same-origin', signal: controller.signal })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setBlobUrl(directUrl);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, mimeType, size, namespace, filePath, apiBase, storageApiBase, getAuthHeaders, isImage, isGrid]);

  // Cleanup previous blob URLs when they change
  useEffect(() => {
    return () => {
      if (blobUrl && blobUrl !== url) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl, url]);

  return <NFileTypeIcon mimeType={mimeType} url={blobUrl} fileName={fileName} size={size} showThumbnail={isImage && !!blobUrl} />;
}
