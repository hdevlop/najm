import { HttpError, Service } from 'najm-core';
import type { NajmDesignConfig } from 'najm-kit';
import { ThemeProjectService } from '../theme-project/ThemeProjectService';
import { ThemeStyleRepository } from './ThemeStyleRepository';
import type {
  CreateThemeStyleDto,
  DuplicateThemeStyleDto,
  UpdateThemeStyleDto,
} from './ThemeStyleDto';
import type { ThemeStyleRecord } from './ThemeStyleSchema';

export type ThemeStyle = Omit<ThemeStyleRecord, 'config'> & { config: NajmDesignConfig };

function toStyle(record: ThemeStyleRecord): ThemeStyle {
  return { ...record, config: JSON.parse(record.config) };
}

function configText(config: unknown): string {
  return JSON.stringify(config);
}

@Service()
export class ThemeStyleService {
  constructor(
    private projectService: ThemeProjectService,
    private styleRepository: ThemeStyleRepository,
  ) {}

  async listByProject(projectId: string) {
    await this.projectService.get(projectId);
    const styles = await this.styleRepository.findByProject(projectId);
    return styles.map(toStyle);
  }

  async get(id: string) {
    const style = await this.styleRepository.findById(id);
    if (!style) HttpError.notFound('Theme style not found.');
    return toStyle(style);
  }

  async create(projectId: string, input: CreateThemeStyleDto) {
    await this.projectService.get(projectId);

    if (input.isDefault) await this.styleRepository.clearDefault(projectId);

    const style = await this.styleRepository.create({
      projectId,
      name: input.name,
      description: input.description ?? null,
      config: configText(input.config),
      isDefault: input.isDefault ?? false,
    } as Parameters<ThemeStyleRepository['create']>[0]);

    return toStyle(style);
  }

  async update(id: string, input: UpdateThemeStyleDto) {
    const existing = await this.get(id);

    if (input.isDefault) await this.styleRepository.clearDefault(existing.projectId, id);

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.config !== undefined) patch.config = configText(input.config);
    if (input.isDefault !== undefined) patch.isDefault = input.isDefault;

    const updated = await this.styleRepository.update(id, patch as Parameters<ThemeStyleRepository['update']>[1]);

    if (!updated) HttpError.notFound('Theme style not found.');
    return toStyle(updated);
  }

  async duplicate(id: string, input: DuplicateThemeStyleDto) {
    const existing = await this.get(id);
    const copyName = input.name ?? `${existing.name} copy`;
    return this.create(existing.projectId, {
      name: copyName,
      description: existing.description ?? undefined,
      config: existing.config as never,
      isDefault: false,
    });
  }

  async setDefault(id: string) {
    const existing = await this.get(id);
    await this.styleRepository.clearDefault(existing.projectId, id);
    return this.update(id, { isDefault: true });
  }

  async delete(id: string) {
    await this.get(id);
    await this.styleRepository.delete(id);
    return { deleted: true };
  }

  deleteByProject(projectId: string) {
    return this.styleRepository.deleteByProject(projectId);
  }
}