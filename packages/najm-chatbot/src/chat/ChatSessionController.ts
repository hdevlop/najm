import { Controller, Get, Delete, Patch, Params, Body, User, Err } from 'najm-core';
import { isAuth } from 'najm-auth';
import { ChatSessionRepository } from '../sessions/ChatSessionRepository';
import type { StoredChatSession } from '../sessions';

interface RenameSessionBody {
  title: string;
}

@Controller('/chat/sessions')
export class ChatSessionController {
  constructor(private repository: ChatSessionRepository) {}

  @Get()
  @isAuth()
  async list(@User('id') userId: string) {
    const sessions = await this.repository.listByUser(String(userId));
    const safe = sessions.map((s) => ({
      id: s.id,
      sessionKey: s.sessionKey,
      title: s.title,
      channel: s.channel,
      messageCount: s.messageCount,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
    return { data: safe };
  }

  @Get('/:key')
  @isAuth()
  async get(@Params('key') key: string, @User('id') userId: string) {
    const session = await this.repository.findByKey(key);
    this.requireOwnedSession(session, userId);
    return { data: session };
  }

  @Delete('/:key')
  @isAuth()
  async remove(@Params('key') key: string, @User('id') userId: string) {
    const session = await this.repository.findByKey(key);
    this.requireOwnedSession(session, userId);

    await this.repository.deleteByKey(key);
    return { data: { deleted: true } };
  }

  @Patch('/:key')
  @isAuth()
  async rename(@Params('key') key: string, @Body() body: RenameSessionBody, @User('id') userId: string) {
    if (!body?.title || typeof body.title !== 'string' || !body.title.trim()) {
      Err(400, 'Title is required.');
    }

    const session = await this.repository.findByKey(key);
    this.requireOwnedSession(session, userId);

    const title = body.title.trim().slice(0, 120);
    await this.repository.updateTitle(key, title);
    return { data: { sessionKey: key, title } };
  }

  private requireOwnedSession(session: StoredChatSession | null, userId: string): asserts session is StoredChatSession {
    if (!session) {
      Err(404, 'Session not found');
    }
    if (session.userId !== String(userId)) {
      Err(403, 'Forbidden');
    }
  }
}
