export type PluginSessionEvent =
  | {
      type: 'agent_message_chunk';
      sessionId: string;
      content: unknown;
    }
  | {
      type: 'tool_call';
      sessionId: string;
      toolCallId: string;
      title?: string | null;
      status?: string | null;
    }
  | {
      type: 'status_message';
      sessionId: string;
      message: string;
      level: 'notice' | 'progress';
    };

type PluginSessionEventListener = (event: PluginSessionEvent) => void;

const listeners = new Set<PluginSessionEventListener>();

export function subscribePluginSessionEvents(listener: PluginSessionEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishPluginSessionEvent(event: PluginSessionEvent): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch (error) {
      console.error('[plugin-events] listener failed:', error);
    }
  }
}
