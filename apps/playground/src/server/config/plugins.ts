import { cors } from 'najm-cors';
import { cookies } from 'najm-cookies';
import { i18n } from 'najm-i18n';
import { events } from 'najm-event';
import { mcp } from 'najm-mcp';
import { validation } from 'najm-validation';
import { rateLimit } from 'najm-rate';
import { storage } from 'najm-storage';
import { translations } from '../locales';
import { databaseConfig } from './database';
import { auth } from 'najm-auth';
import { rag } from 'najm-rag';
import { chatbot } from 'najm-chatbot';
import { studioAssistant } from 'najm-chatbot/studio-assistant';
import { whatsapp } from 'najm-whatsapp';

/**
 * Export all plugin configurations
 *
 * Note: Auth plugin auto-registers these dependencies:
 * - cache() - Token blacklist storage
 * - cookies() - Refresh token cookie management
 * - guards() - Guard execution system
 * - validation() - Request validation (@Validate decorator)
 * - rateLimit() - Request throttling for auth endpoints
 * - i18n() - Localized error/success messages (but we configure it ourselves)
 * - email() - Password reset email flows
 */

export const authConfig = () => auth({
  dialect: 'sqlite',
  defaultRole: 'user', // Auto-assign 'user' role to new registrations (admin can update later)
  encryptionKey: process.env.NAJM_ENCRYPTION_KEY || 'bmFqbS1wbGF5Z3JvdW5kLWRldi1rZXktMzItYnl0ZXM=',
});


export const validationConfig = () => validation();

export const rateLimitConfig = () => rateLimit();

export const cookiesConfig = () => cookies({
  // `next start` runs with NODE_ENV=production, but LAN device testing often
  // uses plain HTTP. Set COOKIE_SECURE=false in .env for that workflow.
  secure: process.env.COOKIE_SECURE === 'false'
    ? false
    : process.env.NODE_ENV === 'production',
  sameSite: 'Lax',
  httpOnly: true,
  path: '/',
});

export const corsConfig = () => cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
});

export const i18nConfig = () => i18n({
  translations,
  defaultLanguage: 'fr',
  supportedLanguages: ['en', 'fr', 'ar'],
});

export const eventsConfig = () => events();

export const mcpConfig = () => mcp({
  name: 'najm-playground',
  version: '0.1.0',
  path: '/mcp',
  transports: ['http'],
  cors: true,
});

export const storageConfig = () => storage({ provider: 'local', basePath: 'storage', studio: true, maxFileSize: 100 * 1024 * 1024, preview: { enabled: true, cacheDir: '.cache/thumbnails' } });

export const ragConfig = () => rag({
  dialect: process.env.PLAYGROUND_DB === 'pg' ? 'pg' : 'sqlite',
  configPath: './src/server/config/chatbot/routing.json',
  embedding: process.env.OLLAMA_BASE_URL
    ? { baseUrl: process.env.OLLAMA_BASE_URL }
    : undefined,
  toolRouting: { enabled: true },
  knowledge: true,
  studioApi: true,
  allowedLangs: ['en', 'fr', 'ar', 'darija'],
});

export const chatbotConfig = () => chatbot({
  dialect: process.env.PLAYGROUND_DB === 'pg' ? 'pg' : 'sqlite',
  conversationStore: 'db',
});

export const studioAssistantConfig = () => studioAssistant();

/**
 * Two modes:
 * - `baileys` (default) — Multi-instance Baileys engine + Studio CRUD API at `/api/wa-studio/*`.
 * - `cloud` — Meta Cloud API; needed by WhatsAppListener + WhatsAppChatbot.
 *   Switch via `WA_MODE=cloud`. Note: the plugin only supports one mode at a time.
 */
export const whatsappConfig = () => {
  if (process.env.WA_MODE === 'cloud') {
    return whatsapp({
      phoneNumberId: process.env.WA_PHONE_ID || 'test-phone',
      accessToken: process.env.WA_TOKEN || 'test-token',
      verifyToken: process.env.WA_VERIFY || 'verify-me',
      webhookSecret: process.env.WA_SECRET || 'dev-secret',
    });
  }

  return whatsapp({
    mode: 'baileys',
    dialect: process.env.PLAYGROUND_DB === 'pg' ? 'pg' : 'sqlite',
    sessions: {
      driver: (process.env.WA_SESSION_DRIVER as 'db' | 'file') || 'file',
      path: process.env.WA_SESSION_PATH || './storage/wa-sessions',
    },
    studioApi: true,
  } as any);
};

export { databaseConfig };
