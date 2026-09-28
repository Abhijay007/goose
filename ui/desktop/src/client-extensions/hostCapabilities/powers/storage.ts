import { z } from 'zod';
import { parsePayload } from '../payload';
import type { HostCapabilityDefinition } from '../types';

const STORAGE_KEY_PREFIX = 'goose.client-extension-storage.';
const MAX_KEYS = 200;
const MAX_STORE_LENGTH = 512 * 1024;

const keyPayload = z.object({ key: z.string().min(1).max(200) });
const setPayload = keyPayload.extend({ value: z.json() });

function storageKey(extensionId: string): string {
  return `${STORAGE_KEY_PREFIX}${extensionId}`;
}

function readStore(extensionId: string): Map<string, unknown> {
  const raw = localStorage.getItem(storageKey(extensionId));
  if (!raw) {
    return new Map();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? new Map(Object.entries(parsed))
      : new Map();
  } catch {
    return new Map();
  }
}

function writeStore(extensionId: string, store: Map<string, unknown>): void {
  const serialized = JSON.stringify(Object.fromEntries(store));
  if (serialized.length > MAX_STORE_LENGTH) {
    throw new Error(`Plugin storage is limited to ${MAX_STORE_LENGTH / 1024} KB`);
  }
  localStorage.setItem(storageKey(extensionId), serialized);
}

export function clearExtensionStorage(extensionId: string): void {
  localStorage.removeItem(storageKey(extensionId));
}

export const storagePower: HostCapabilityDefinition = {
  id: 'storage',
  description: 'Persist small JSON values for the plugin across restarts.',
  methods: {
    get: {
      permission: 'storage:readwrite',
      handle: (context, payload) => {
        const { key } = parsePayload(keyPayload, payload);
        return readStore(context.extensionId).get(key) ?? null;
      },
    },
    set: {
      permission: 'storage:readwrite',
      handle: (context, payload) => {
        const { key, value } = parsePayload(setPayload, payload);
        const store = readStore(context.extensionId);
        if (!store.has(key) && store.size >= MAX_KEYS) {
          throw new Error(`Plugin storage is limited to ${MAX_KEYS} keys`);
        }
        store.set(key, value);
        writeStore(context.extensionId, store);
        return { key };
      },
    },
    delete: {
      permission: 'storage:readwrite',
      handle: (context, payload) => {
        const { key } = parsePayload(keyPayload, payload);
        const store = readStore(context.extensionId);
        const existed = store.delete(key);
        writeStore(context.extensionId, store);
        return { key, existed };
      },
    },
    keys: {
      permission: 'storage:readwrite',
      handle: (context) => [...readStore(context.extensionId).keys()],
    },
  },
};
