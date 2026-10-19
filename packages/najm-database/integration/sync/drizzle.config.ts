import { fileURLToPath } from 'node:url';

export default {
  schema: fileURLToPath(new URL('./schema.ts', import.meta.url)).replaceAll('\\', '/'),
  out: fileURLToPath(new URL('./.output/schema-generation', import.meta.url)).replaceAll('\\', '/'),
  dialect: 'postgresql',
};
