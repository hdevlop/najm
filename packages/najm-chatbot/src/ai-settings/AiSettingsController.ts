import { Controller, Get, Post, Put, Body, Role } from 'najm-core';
import { Validate } from 'najm-validation';
import { isAuth, isAdministrator, ROLE_GROUPS } from 'najm-auth';
import { AiSettingsService } from './AiSettingsService';
import { createAiSettingsDto, updateAiSettingsDto, type CreateAiSettingsDto, type UpdateAiSettingsDto } from './AiSettingsDto';

const isAdministratorRole = (role?: string) =>
  !!role && (ROLE_GROUPS.ADMINISTRATORS as readonly string[]).some((admin) => admin.toLowerCase() === role.toLowerCase());

@Controller('/ai-settings')
export class AiSettingsController {
  constructor(private service: AiSettingsService) {}

  /**
   * Administrators get the full record for the settings form. Other users
   * get only what the chat panel reads: the system prompt and base URL can
   * describe internal systems and are not theirs to see.
   */
  @Get()
  @isAuth()
  async getSettings(@Role() role?: string) {
    const settings = await this.service.getPublic();
    if (!settings || isAdministratorRole(role)) return settings;
    return { provider: settings.provider, model: settings.model, isEnabled: settings.isEnabled };
  }

  @Post()
  @isAdministrator()
  @Validate(createAiSettingsDto)
  async create(@Body() body: CreateAiSettingsDto) {
    return this.service.upsert(body);
  }

  @Put()
  @isAdministrator()
  @Validate(updateAiSettingsDto)
  async update(@Body() body: UpdateAiSettingsDto) {
    return this.service.update(body);
  }

  @Post('/test')
  @isAdministrator()
  @Validate(updateAiSettingsDto)
  async test(@Body() body: UpdateAiSettingsDto) {
    return this.service.testConnection(body);
  }
}
