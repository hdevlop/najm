import { describe, expect, test } from 'bun:test';
import {
  defineNajmThemeConfig,
  parseNajmThemeConfig,
  stringifyNajmThemeConfig,
} from '../../src/theme/config';

describe('Najm theme JSON config', () => {
  test('parses a complete JSON theme', () => {
    const config = parseNajmThemeConfig(JSON.stringify({
      mode: 'dark',
      accent: 'violet',
      radius: '0.75rem',
      appearance: { borderWidth: '2px' },
      tokens: {
        primary: 'oklch(0.62 0.2 290)',
        'primary-foreground': 'oklch(1 0 0)',
        sidebar: 'oklch(0.18 0.02 290)',
        'chart-1': 'oklch(0.7 0.2 40)',
      },
    }));

    expect(config.mode).toBe('dark');
    expect(config.appearance?.borderWidth).toBe('2px');
    expect(config.tokens?.primary).toBe('oklch(0.62 0.2 290)');
    expect(config.tokens?.sidebar).toBe('oklch(0.18 0.02 290)');
    expect(config.tokens?.['chart-1']).toBe('oklch(0.7 0.2 40)');
  });

  test('parses per-mode token overrides', () => {
    const config = parseNajmThemeConfig({
      mode: 'light',
      accent: 'emerald',
      overrides: {
        light: { primary: 'oklch(0.55 0.2 150)' },
        dark: { primary: 'oklch(0.70 0.18 150)' },
      },
    });

    expect(config.overrides?.light?.primary).toBe('oklch(0.55 0.2 150)');
    expect(config.overrides?.dark?.primary).toBe('oklch(0.70 0.18 150)');
  });

  test('rejects unknown appearance keys', () => {
    expect(() => parseNajmThemeConfig({ appearance: { borderDegree: 'strong' } })).toThrow(
      'Unknown theme.appearance property: borderDegree',
    );
  });

  test('rejects misspelled settings instead of silently ignoring them', () => {
    expect(() => parseNajmThemeConfig({ raduis: '1rem' })).toThrow(
      'Unknown theme property: raduis',
    );
    expect(() => parseNajmThemeConfig({ radiusScale: 'uniform' })).toThrow(
      'Unknown theme property: radiusScale',
    );
  });

  test('supports typed authoring and JSON persistence', () => {
    const config = defineNajmThemeConfig({ mode: 'light', radius: '0.5rem' });
    expect(parseNajmThemeConfig(stringifyNajmThemeConfig(config))).toEqual(config);
  });
});
