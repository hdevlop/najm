import 'reflect-metadata';
import { db } from '../config/database';
import { themeProjectsTable, themeStylesTable } from './schema';
import { DEFAULT_PRESET, SMS_DASHBOARD_PRESET_ID, PRESETS } from '../../theme/presets';

const smsPreset = PRESETS.find((preset) => preset.id === SMS_DASHBOARD_PRESET_ID) ?? DEFAULT_PRESET;

const now = new Date();
const projectId = crypto.randomUUID();
const styleId = crypto.randomUUID();

await db.insert(themeProjectsTable).values({
  id: projectId,
  name: 'Theme Studio Demo',
  slug: 'theme-studio-demo',
  description: 'Local demo project for Najm Theme Studio.',
  createdAt: now,
  updatedAt: now,
});

await db.insert(themeStylesTable).values({
  id: styleId,
  projectId,
  name: smsPreset.name,
  description: 'Seeded style based on the SMS dashboard preset.',
  config: JSON.stringify(smsPreset.config),
  isDefault: true,
  createdAt: now,
  updatedAt: now,
});

console.log('Seeded Theme Studio demo project and style.');