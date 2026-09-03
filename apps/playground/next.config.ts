import { defineNajmNextConfig } from 'najm-next/configurable';

export default defineNajmNextConfig({
  env: {
    WS_NO_BUFFER_UTIL: 'true',
    WS_NO_UTF_8_VALIDATE: 'true',
  },
  serverExternalPackages: ['better-sqlite3', 'sqlite-vec', '@whiskeysockets/baileys', 'sharp'],
});
