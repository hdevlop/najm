'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NButton, NajmThemeProvider, NPortalScopeProvider, Toaster } from 'najm-kit';
import { Loader2, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { type CreateProjectInput, useProjects } from '@/app/use-projects';
import { ProjectCard } from './ProjectCard';
import { NewProjectDialog } from './NewProjectDialog';

export function ProjectManager() {
  const router = useRouter();
  const { projects, loading, error, createProject, deleteProject } = useProjects();
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleCreate(input: CreateProjectInput) {
    const project = await createProject(input);
    toast.success(`Created project "${project.name}"`);
    setDialogOpen(false);
    router.push(`/editor/${project.id}`);
    return project;
  }

  async function handleDelete(id: string) {
    const project = projects.find((p) => p.id === id);
    if (!project || !window.confirm(`Delete "${project.name}" and all its styles?`)) return;
    await deleteProject(id);
    toast.success(`Deleted "${project.name}"`);
  }

  return (
    <NPortalScopeProvider className="theme-studio">
      <NajmThemeProvider mode="dark" accent="violet" className="theme-studio min-h-screen w-full">
        <div className="min-h-screen bg-background text-foreground">
          <header className="sticky top-0 z-10 border-b border-border bg-card/90 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-tight">Najm Theme Studio</p>
                  <p className="text-xs text-muted-foreground">Project manager</p>
                </div>
              </div>
              <NButton size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setDialogOpen(true)}>
                New project
              </NButton>
            </div>
          </header>

          <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
              <div className="max-w-2xl">
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
                  Design Library
                </p>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Theme Projects</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Open a project to tune tokens, component recipes, previews, imports, and exports.
                </p>
              </div>
            </section>

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}

            {loading ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <p className="text-sm font-medium text-foreground">No projects yet.</p>
                <p className="mt-1 text-sm text-muted-foreground">Create your first theme project to start saving styles.</p>
                <NButton className="mt-4" size="sm" onClick={() => setDialogOpen(true)}>
                  Create your first project
                </NButton>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </main>

          <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={handleCreate} />
          <Toaster richColors position="bottom-right" />
        </div>
      </NajmThemeProvider>
    </NPortalScopeProvider>
  );
}
