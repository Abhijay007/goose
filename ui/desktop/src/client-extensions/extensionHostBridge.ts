import { toastService } from '../toasts';
import type { HostSession } from './hostCapabilities';
import { isHostCapabilityInvokeMessage } from './hostCapabilities/types';
import type { ExtensionToHostMessage, HostToExtensionMessage } from './types';

export function isExtensionToHostMessage(value: unknown): value is ExtensionToHostMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }
  const type = (value as { type: unknown }).type;
  if (typeof type !== 'string') {
    return false;
  }
  return (
    type === 'grc/ui/showMessage' ||
    type === 'grc/chat/setInput' ||
    type === 'grc/resize' ||
    isHostCapabilityInvokeMessage(value)
  );
}

export function notifyExtensionActivate(
  iframe: HTMLIFrameElement | null,
  message: HostToExtensionMessage,
  hostSession?: HostSession | null
): void {
  if (!iframe?.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage(message, '*');
  hostSession?.notifyPermissions();
}

export async function routeExtensionToHostMessage(
  hostSession: HostSession,
  message: ExtensionToHostMessage,
  toastTitle: string
): Promise<boolean> {
  if (isHostCapabilityInvokeMessage(message)) {
    await hostSession.handleInvoke(message);
    return true;
  }

  if (message.type === 'grc/ui/showMessage') {
    toastService.success({
      title: toastTitle,
      msg: message.text,
    });
    return true;
  }

  return false;
}
