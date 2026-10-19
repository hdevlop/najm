import { fileURLToPath } from 'node:url';
import { relative } from 'node:path';

export default {
  schema: fileURLToPath(new URL('./schema.ts', import.meta.url)).replaceAll('\\', '/'),
  out: relative(process.cwd(), fileURLToPath(new URL('./.output/schema-generation', import.meta.url))).replaceAll('\\', '/'),
  dialect: 'postgresql',
};
