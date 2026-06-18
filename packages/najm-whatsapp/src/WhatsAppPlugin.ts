import { plugin, Err } from 'najm-core';
import { events } from 'najm-event';
import { validation } from 'najm-validation';
import { WHATSAPP_CONFIG, WA_SCHEMA, BAILEYS_CONFIG } from './tokens';
import type { WhatsAppConfig, WhatsAppCloudConfig, WhatsAppBaileysConfig } from './types';

// Existing Cloud services
import { WhatsAppService } from './WhatsAppService';
import { WhatsAppController } from './WhatsAppController';
import { PhoneLinkService } from './auth/PhoneLinkService';
import { PhoneLinkController } from './auth/PhoneLinkController';

// Baileys engine services
import { InstanceManager } from './engine/InstanceManager';
import { InstanceRepository } from './engine/InstanceRepository';
import { SessionStore } from './engine/SessionStore';

// Baileys application services
import {
  MessageService,
  MessageStoreService,
  MessagePersistenceService,
  GroupService,
  ContactService,
  ProfileService,
  LabelService,
  ChatOpsService,
  WebhookForwarder,
  WebhookService,
  AutoReplyService,
  AiResponderService,
} from './services';

// Studio API
import {
  InstanceController,
  MessageController,
  ConversationController,
  GroupController,
  ContactController,
  ProfileController,
  LabelController,
  ChatOpsController,
  WebhookController,
  StudioSettingsController,
  AutoReplyController,
  AiConfigController,
  StudioAuditService,
} from './studio';

// Schema
import { sqliteSchema, pgSchema, mysqlSchema } from './schema';

const resolveSchema = (config: WhatsAppBaileysConfig) => {
  const dialect = config.dialect ?? 'pg';
  if (dialect === 'sqlite') return sqliteSchema;
  if (dialect === 'mysql') return mysqlSchema;
  return pgSchema;
};

export const whatsapp = (config: WhatsAppConfig | WhatsAppCloudConfig | WhatsAppBaileysConfig) => {
  const mode = (config as any).mode ?? 'cloud';

  if (mode === 'cloud') {
    return buildCloudPlugin(config as WhatsAppCloudConfig);
  }
  return buildBaileysPlugin(config as unknown as WhatsAppBaileysConfig);
};

function buildCloudPlugin(config: WhatsAppCloudConfig) {
  if (!config.phoneNumberId) throw Err.configRequired('whatsapp', 'phoneNumberId');
  if (!config.accessToken) throw Err.configRequired('whatsapp', 'accessToken');
  if (!config.verifyToken) throw Err.configRequired('whatsapp', 'verifyToken');
  if (!config.webhookSecret) throw Err.configRequired('whatsapp', 'webhookSecret');

  return plugin('whatsapp')
    .version('1.0.0')
    .depends(events())
    .requires('auth')
    .services(
      WhatsAppService,
      WhatsAppController,
      PhoneLinkService,
      PhoneLinkController,
    )
    .config(WHATSAPP_CONFIG, {
      mode: 'cloud',
      phoneNumberId: config.phoneNumberId,
      accessToken: config.accessToken,
      verifyToken: config.verifyToken,
      webhookSecret: config.webhookSecret,
      apiVersion: config.apiVersion ?? 'v20.0',
      otpTemplate: config.otpTemplate,
      otpTemplateLang: config.otpTemplateLang,
    })
    .build();
}

function buildBaileysPlugin(config: WhatsAppBaileysConfig) {
  const studioApi = config.studioApi !== false;

  const services: any[] = [
    InstanceManager,
    InstanceRepository,
    SessionStore,
    MessageService,
    MessageStoreService,
    MessagePersistenceService,
    GroupService,
    ContactService,
    ProfileService,
    LabelService,
    ChatOpsService,
    WebhookService,
    WebhookForwarder,
    AutoReplyService,
    AiResponderService,
  ];

  if (studioApi) {
    services.push(
      StudioAuditService,
      InstanceController,
      MessageController,
      ConversationController,
      GroupController,
      ContactController,
      ProfileController,
      LabelController,
      ChatOpsController,
      WebhookController,
      StudioSettingsController,
      AutoReplyController,
      AiConfigController,
    );
  }

  return plugin('whatsapp')
    .version('2.0.0')
    .depends(events(), validation())
    .requires('auth', 'database')
    .services(...services)
    .config(WHATSAPP_CONFIG, config)
    .set(BAILEYS_CONFIG, {
      sessions: config.sessions ?? { driver: 'file', path: './sessions' },
      webhooks: config.webhooks ?? [],
      webhookSigningSecret: config.webhookSigningSecret,
      webhookSecurity: config.webhookSecurity,
      defaultAgent: config.defaultAgent,
    })
    .set(WA_SCHEMA, resolveSchema(config))
    .build();
}
