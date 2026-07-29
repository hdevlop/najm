import { useEffect } from 'react';
import { NSheet, NUploader } from 'najm-kit';
import { Upload } from 'lucide-react';
import type { UploadManager } from '../hooks/useUploadManager';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefix: string;
  manager: UploadManager;
}

export function UploadSheet({ open, onOpenChange, prefix, manager }: Props) {
  useEffect(() => {
    if (open) {
      manager.clear();
    }
    // intentionally depends only on `open` — manager is a fresh object each render
  }, [open]);

  const subtitle = prefix
    ? `Files will be uploaded to /${prefix}`
    : 'Files will be uploaded to the bucket root';

  return (
    <NSheet
      icon={Upload}
      open={open}
      onOpenChange={onOpenChange}
      title="Upload Files"
      description={subtitle}
      width={520}
      contentClassName="bg-bg-elev-1"
    >
      <NUploader
        title=""
        subtitle=""
        items={manager.items}
        onFilesSelected={manager.addFiles}
        onCancel={manager.cancel}
        onRemove={manager.remove}
      />
    </NSheet>
  );
}
