import { Image, Film, FileCode, FileText, FileArchive, File } from 'lucide-react';
import type { FC } from 'react';

const iconMap: [RegExp, FC<{ size?: number; className?: string }>][] = [
  [/^image\//, Image],
  [/^video\//, Film],
  [/text\/|json|javascript/, FileCode],
  [/pdf|document|msword/, FileText],
  [/zip|archive|compressed/, FileArchive],
];

const colorMap: [RegExp, string][] = [
  [/^image\//, 'text-purple-400'],
  [/^video\//, 'text-red-400'],
  [/text\/|json|javascript/, 'text-green-400'],
  [/pdf|document/, 'text-blue-400'],
  [/zip|archive|compressed/, 'text-orange-400'],
];

export function getFileIcon(mime: string): FC<{ size?: number; className?: string }> {
  for (const [re, Icon] of iconMap) {
    if (re.test(mime)) return Icon;
  }
  return File;
}

export function getFileColor(mime: string): string {
  for (const [re, color] of colorMap) {
    if (re.test(mime)) return color;
  }
  return 'text-gray-400';
}
