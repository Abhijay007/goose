import { acpListRecentSessions } from '../../../acp/sessions';
import { subscribePluginSessionEvents } from '../../plugin-events';
import type { HostCapabilityDefinition } from '../types';

const DEFAULT_SESSION_LIMIT = 50;
const MAX_SESSION_LIMIT = 100;
const EVENTS_DISPOSER = 'events';

function resolveLimit(payload: unknown): number {
  const requested = (payload as { limit?: unknown } | null | undefined)?.limit;
  if (typeof requested !== 'number' || !Number.isFinite(requested)) {
    return DEFAULT_SESSION_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(requested), 1), MAX_SESSION_LIMIT);
}

export const sessionsPower: HostCapabilityDefinition = {
  id: 'sessions',
  description: 'List recent sessions and stream live session events.',
  methods: {
    list: {
      permission: 'sessions:read',
      handle: async (_context, payload) => {
        const sessions = await acpListRecentSessions(resolveLimit(payload));
        return sessions.map((session) => ({
          id: session.id,
          name: session.name,
          workingDir: session.workingDir,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          lastMessageAt: session.lastMessageAt,
          messageCount: session.messageCount,
          providerId: session.providerId,
          modelId: session.modelId,
        }));
      },
    },
    subscribe: {
      permission: 'sessions:events',
      handle: (context) => {
        context.setDisposer(
          EVENTS_DISPOSER,
          subscribePluginSessionEvents((event) => context.emit('session', event))
        );
        return { subscribed: true };
      },
    },
    unsubscribe: {
      permission: 'sessions:events',
      handle: (context) => {
        context.clearDisposer(EVENTS_DISPOSER);
        return { subscribed: false };
      },
    },
  },
};
