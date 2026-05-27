import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { Container, Meta, Service } from 'diject';
import { BootService } from '../src/boot/BootService';

const events: string[] = [];

@Service()
@Meta({ layer: 'core', order: 1 })
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

@Service()
@Meta({ layer: 'plugin', order: 90 })
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

@Service()
@Meta({ layer: 'plugin', order: 5 })
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
