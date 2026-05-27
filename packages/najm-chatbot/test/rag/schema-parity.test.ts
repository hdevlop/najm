import { describe, test, expect } from 'bun:test';
import { chatbotSchema as chatbotSqliteSchema } from '../../src/schema/sqlite';
import { ragSchema as ragSqliteSchema } from 'najm-rag/sqlite';
import { chatbotSchema as chatbotPgSchema } from '../../src/schema/pg';
import { ragSchema as ragPgSchema } from 'najm-rag/pg';

describe('Schema parity: najm-chatbot vs najm-rag', () => {
  const deprecatedCompatKeys = [
    'chatbotToolEmbeddings',
    'chatbotToolSemantics',
    'chatbotRoutingSettings',
  ] as const;

  test('sqlite chatbotSchema includes deprecated routing compatibility tables', () => {
    expect(chatbotSqliteSchema.chatSessions.title).toBeTruthy();
    expect(chatbotSqliteSchema.chatSessions.messageCount).toBeTruthy();
    expect(chatbotSqliteSchema.chatSessions.lastMessageAt).toBeTruthy();
    expect(chatbotSqliteSchema.aiSettings.maxStoredMessages).toBeTruthy();
    expect(chatbotSqliteSchema.aiSettings.maxPromptMessages).toBeTruthy();
    for (const key of deprecatedCompatKeys) {
      expect(chatbotSqliteSchema).toHaveProperty(key);
      expect(chatbotSqliteSchema[key as keyof typeof chatbotSqliteSchema]).toBe(
        ragSqliteSchema[key as keyof typeof ragSqliteSchema],
      );
    }
  });

  test('pg chatbotSchema includes deprecated routing compatibility tables', () => {
    expect(chatbotPgSchema.chatSessions.title).toBeTruthy();
    expect(chatbotPgSchema.chatSessions.messageCount).toBeTruthy();
    expect(chatbotPgSchema.chatSessions.lastMessageAt).toBeTruthy();
    expect(chatbotPgSchema.aiSettings.maxStoredMessages).toBeTruthy();
    expect(chatbotPgSchema.aiSettings.maxPromptMessages).toBeTruthy();
    for (const key of deprecatedCompatKeys) {
      expect(chatbotPgSchema).toHaveProperty(key);
      expect(chatbotPgSchema[key as keyof typeof chatbotPgSchema]).toBe(
        ragPgSchema[key as keyof typeof ragPgSchema],
      );
    }
  });

  test('ragSchema sqlite has expected table keys', () => {
    expect(Object.keys(ragSqliteSchema)).toContain('chatbotToolEmbeddings');
    expect(Object.keys(ragSqliteSchema)).toContain('chatbotToolSemantics');
    expect(Object.keys(ragSqliteSchema)).toContain('chatbotDocumentSources');
  });

  test('ragSchema pg has expected table keys', () => {
    expect(Object.keys(ragPgSchema)).toContain('chatbotToolEmbeddings');
    expect(Object.keys(ragPgSchema)).toContain('chatbotToolSemantics');
    expect(Object.keys(ragPgSchema)).toContain('chatbotDocumentSources');
  });
});
