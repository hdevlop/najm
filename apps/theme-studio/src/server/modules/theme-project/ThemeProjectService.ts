import { HttpError, Service } from 'najm-core';
import { ThemeStyleRepository } from '../theme-style/ThemeStyleRepository';
import { ThemeProjectRepository } from './ThemeProjectRepository';
import type { CreateThemeProjectDto, UpdateThemeProjectDto } from './ThemeProjectDto';

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'project'
  );
}

@Service()
export class ThemeProjectService {
  constructor(
    private projectRepository: ThemeProjectRepository,
    private styleRepository: ThemeStyleRepository,
  ) {}

  list() {
    return this.projectRepository.findAll();
  }

  async get(id: string) {
    const project = await this.projectRepository.findById(id);
    if (!project) HttpError.notFound('Theme project not found.');
    return project;
  }

  async create(input: CreateThemeProjectDto) {
    const slug = input.slug ?? slugify(input.name);
    const existing = await this.projectRepository.findBySlug(slug);
    if (existing) HttpError.conflict('Theme project slug already exists.');

    return this.projectRepository.create({
      name: input.name,
      slug,
      description: input.description ?? null,
    } as Parameters<ThemeProjectRepository['create']>[0]);
  }

  async update(id: string, input: UpdateThemeProjectDto) {
    await this.get(id);

    if (input.slug) {
      const existing = await this.projectRepository.findBySlug(input.slug);
      if (existing && existing.id !== id) HttpError.conflict('Theme project slug already exists.');
    }

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.description !== undefined) patch.description = input.description;

    const updated = await this.projectRepository.update(id, patch);
    if (!updated) HttpError.notFound('Theme project not found.');
    return updated;
  }

  async delete(id: string) {
    await this.get(id);
    await this.styleRepository.deleteByProject(id);
    await this.projectRepository.delete(id);
    return { deleted: true };
  }
}