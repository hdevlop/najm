import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { BootService, Container, Meta, Service } from '../dist/index.mjs';

const events: string[] = [];

class CoreInfrastructureService {
  async scan() {
    events.push('core:scan');
  }

  async configure() {
    events.push('core:configure');
  }

  async activate() {
    events.push('core:activate');
  }

  async onReady() {
    events.push('core:onReady');
  }
}
Meta({ layer: 'core', order: 1 })(CoreInfrastructureService);
Service()(CoreInfrastructureService);

class LatePluginService {
  async scan() {
    events.push('late:scan');
  }

  async configure() {
    events.push('late:configure');
  }

  async activate() {
    events.push('late:activate');
  }

  async onReady() {
    events.push('late:onReady');
  }
}
Meta({ layer: 'plugin', order: 90 })(LatePluginService);
Service()(LatePluginService);

class EarlyPluginService {
  async scan() {
    events.push('early:scan');
  }

  async configure() {
    events.push('early:configure');
  }

  async activate() {
    events.push('early:activate');
  }

  async onReady() {
    events.push('early:onReady');
  }
}
Meta({ layer: 'plugin', order: 5 })(EarlyPluginService);
Service()(EarlyPluginService);

describe('BootService', () => {
  test('boots infrastructure by layer and ascending metadata order instead of registration order', async () => {
    events.length = 0;

    const container = Container.create();
    container.set([
      BootService,
      LatePluginService,
      EarlyPluginService,
      CoreInfrastructureService,
    ]);

    const bootService = await container.resolve(BootService);
    await bootService.boot();

    expect(events).toEqual([
      'core:scan',
      'early:scan',
      'late:scan',
      'core:configure',
      'early:configure',
      'late:configure',
      'core:activate',
      'early:activate',
      'late:activate',
      'core:onReady',
      'early:onReady',
      'late:onReady',
    ]);
  });
});
