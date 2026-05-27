import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { Server, Service, Injectable } from 'najm-core';
import { events, EventService } from 'najm-event';
import { OnWhatsApp } from '../../src/decorators/OnWhatsApp';

describe('OnWhatsApp decorator', () => {
  let server: Server;

  afterEach(async () => {
    if (server) await server.stop();
  });

  test('@OnWhatsApp("message") fires on whatsapp.message event', async () => {
    let received: any = null;

    @Service()
    class MessageListener {
      @OnWhatsApp('message')
      onMessage(data: any) {
        received = data;
      }
    }

    server = await new Server({ isolated: true })
      .use(events())
      .load(MessageListener)
      .listen(5701);

    const eventService = await (server as any).container.resolve(EventService);
    eventService.emit('whatsapp.message', { text: 'Hello from decorator test' });

    expect(received).not.toBeNull();
    expect(received.text).toBe('Hello from decorator test');
  });

  test('@OnWhatsApp("connection") fires on wa.connection_update event', async () => {
    let received: any = null;

    @Service()
    class ConnectionListener {
      @OnWhatsApp('connection')
      onConnection(data: any) {
        received = data;
      }
    }

    server = await new Server({ isolated: true })
      .use(events())
      .load(ConnectionListener)
      .listen(5702);

    const eventService = await (server as any).container.resolve(EventService);
    eventService.emit('wa.connection_update', { status: 'connected', phone: '55119' });

    expect(received).not.toBeNull();
    expect(received.status).toBe('connected');
    expect(received.phone).toBe('55119');
  });

  test('@OnWhatsApp("status") fires on whatsapp.status event', async () => {
    let received: any = null;

    @Service()
    class StatusListener {
      @OnWhatsApp('status')
      onStatus(data: any) {
        received = data;
      }
    }

    server = await new Server({ isolated: true })
      .use(events())
      .load(StatusListener)
      .listen(5703);

    const eventService = await (server as any).container.resolve(EventService);
    eventService.emit('whatsapp.status', { status: 'delivered' });

    expect(received).not.toBeNull();
    expect(received.status).toBe('delivered');
  });

  test('@OnWhatsApp("group") fires on wa.groups.update event', async () => {
    let received: any = null;

    @Service()
    class GroupListener {
      @OnWhatsApp('group')
      onGroup(data: any) {
        received = data;
      }
    }

    server = await new Server({ isolated: true })
      .use(events())
      .load(GroupListener)
      .listen(5704);

    const eventService = await (server as any).container.resolve(EventService);
    eventService.emit('wa.groups.update', { id: 'group@g.us', subject: 'Test Group' });

    expect(received).not.toBeNull();
    expect(received.id).toBe('group@g.us');
  });

  test('@OnWhatsApp("presence") fires on wa.presence.update event', async () => {
    let received: any = null;

    @Service()
    class PresenceListener {
      @OnWhatsApp('presence')
      onPresence(data: any) {
        received = data;
      }
    }

    server = await new Server({ isolated: true })
      .use(events())
      .load(PresenceListener)
      .listen(5705);

    const eventService = await (server as any).container.resolve(EventService);
    eventService.emit('wa.presence.update', { jid: '55119@s.whatsapp.net', lastKnownPresence: 'online' });

    expect(received).not.toBeNull();
    expect(received.jid).toBe('55119@s.whatsapp.net');
  });
});
