// ============================================================================
// Multi-Tab Sync via BroadcastChannel
// ============================================================================
// Same-origin only — safe to transmit tokens between tabs.

import type { TabSyncMessage, SyncPayload } from './types';

export class TabSync {
  private channel: BroadcastChannel;

  constructor(
    channelName: string,
    private onMessage: (msg: TabSyncMessage) => void,
  ) {
    this.channel = new BroadcastChannel(channelName);
    this.channel.onmessage = (e) => this.onMessage(e.data);
  }

  broadcastSync(state: SyncPayload): void {
    this.channel.postMessage({ type: 'sync', state } satisfies TabSyncMessage);
  }

  broadcastLogout(): void {
    this.channel.postMessage({ type: 'logout' } satisfies TabSyncMessage);
  }

  destroy(): void {
    this.channel.close();
  }
}
