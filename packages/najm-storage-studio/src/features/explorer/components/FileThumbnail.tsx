import React from 'react';
import { NFileTypeIcon } from 'najm-ui';

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

export function FileThumbnail({
  mimeType,
  url,
  fileName,
  size = 'md',
}: {
  mimeType: string;
  url?: string;
  fileName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  return <NFileTypeIcon mimeType={mimeType} url={url} fileName={fileName} size={size} />;
}
