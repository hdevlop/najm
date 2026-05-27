import { Controller, Get, Post, Put, Body } from 'najm-core';
import { Validate } from 'najm-validation';
import { isAuth, isAdministrator } from 'najm-auth';
import { AiSettingsService } from './AiSettingsService';
import { createAiSettingsDto, updateAiSettingsDto, type CreateAiSettingsDto, type UpdateAiSettingsDto } from './AiSettingsDto';

@Controller('/ai-settings')
export class AiSettingsController {
  constructor(private service: AiSettingsService) {}

  @Get()
  @isAuth()
  async getSettings() {
    return this.service.getPublic();
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
