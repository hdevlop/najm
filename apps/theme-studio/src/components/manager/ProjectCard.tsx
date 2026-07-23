'use client';

import { useRouter } from 'next/navigation';
import { NButton } from 'najm-kit';
import { Trash2 } from 'lucide-react';
import type { ProjectCardData } from '@/app/use-projects';
import { ProjectPreviewThumb } from './ProjectPreviewThumb';

export function ProjectCard({
  project,
  onDelete,
}: {
  project: ProjectCardData;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const open = () => router.push(`/editor/${project.id}`);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') open();
      }}
      className="group flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ProjectPreviewThumb style={project.defaultStyle} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {project.styleCount} style{project.styleCount === 1 ? '' : 's'}
            {project.description ? ` · ${project.description}` : ''}
          </p>
        </div>
        <NButton
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Delete project"
          className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(project.id);
          }}
        >
          <Trash2 className="size-3.5" />
        </NButton>
      </div>
    </div>
  );
}
