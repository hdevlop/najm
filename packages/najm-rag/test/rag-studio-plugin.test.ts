import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { ragStudio } from '../src/studio/plugin';
import { StudioAssistantController } from '../src/studio/StudioAssistantController';
import { SemanticsController } from '../src/studio/SemanticsController';

describe('ragStudio()', () => {
  test('needs no chatbot plugin by default', () => {
    const plugin = ragStudio();
    expect(plugin.dependencies).toEqual(['rag', 'auth', 'database']);
    expect(plugin.services).toContain(SemanticsController);
    expect(plugin.services).not.toContain(StudioAssistantController);
  });

  test('assistant: true registers the assistant and requires its provider', () => {
    const plugin = ragStudio({ assistant: true });
    expect(plugin.dependencies).toEqual(['rag', 'auth', 'database', 'chatbot-studio-assistant']);
    expect(plugin.services).toContain(StudioAssistantController);
  });
});
