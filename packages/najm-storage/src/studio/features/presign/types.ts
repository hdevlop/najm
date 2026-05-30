export interface PresignModalProps {
  file: { namespace: string; filePath: string };
  onClose: () => void;
}