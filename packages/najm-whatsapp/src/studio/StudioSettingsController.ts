import { Controller, Get, Inject } from 'najm-core';
import { isAdmin } from 'najm-auth';
import { BAILEYS_CONFIG } from '../tokens';

@Controller('/wa-studio/settings')
@isAdmin()
export class StudioSettingsController {
  @Inject(BAILEYS_CONFIG) private config!: any;

  @Get('/')
  async get() {
    return {
      sessions: this.config.sessions,
      webhooks: this.config.webhooks,
      defaultAgent: this.config.defaultAgent,
    };
  }
}
