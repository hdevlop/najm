export type PackageTarget = {
  name: string;
  workspace: string;
};

export const PACKAGE_TARGETS: PackageTarget[] = [
  { name: 'najm-core', workspace: 'packages/najm-core' },
  { name: 'najm-guard', workspace: 'packages/najm-guard' },
  { name: 'najm-validation', workspace: 'packages/najm-validation' },
  { name: 'najm-cache', workspace: 'packages/najm-cache' },
  { name: 'najm-rate', workspace: 'packages/najm-rate' },
  { name: 'najm-cors', workspace: 'packages/najm-cors' },
  { name: 'najm-cookies', workspace: 'packages/najm-cookies' },
  { name: 'najm-i18n', workspace: 'packages/najm-i18n' },
  { name: 'najm-mcp', workspace: 'packages/najm-mcp' },
  { name: 'najm-event', workspace: 'packages/najm-event' },
  { name: 'najm-database', workspace: 'packages/najm-database' },
  { name: 'najm-storage', workspace: 'packages/najm-storage' },
  { name: 'najm-email', workspace: 'packages/najm-email' },
  { name: 'najm-auth', workspace: 'packages/najm-auth' },
  { name: 'najm-api', workspace: 'packages/najm-api' },
  { name: 'najm-rag', workspace: 'packages/najm-rag' },
  { name: 'najm-chatbot', workspace: 'packages/najm-chatbot' },
  { name: 'najm-whatsapp', workspace: 'packages/najm-whatsapp' },
  { name: 'najm-cli', workspace: 'packages/najm-cli' },
  { name: 'najm-kit', workspace: 'packages/najm-kit' },
  // After najm-kit: najm-theme builds on the published kit contracts, so it
  // must be packed and published against a kit version that already exists.
  { name: 'najm-theme', workspace: 'packages/najm-theme' },
];

export const TEST_TARGETS: PackageTarget[] = [
  ...PACKAGE_TARGETS,
  { name: 'najm-playground', workspace: 'apps/playground' },
];

export const TEST_ORDER = TEST_TARGETS.map((target) => target.name);
