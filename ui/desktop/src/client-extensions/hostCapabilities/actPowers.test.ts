import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostSession } from './session';
import { clearExtensionStorage } from './powers/storage';
import { registerPluginCommand, unregisterPluginCommands } from '../pluginCommandRegistry';
import type { HostPermission } from './permissions';

const acpMocks = vi.hoisted(() => ({
  listRecipes: vi.fn(),
}));

vi.mock('../../acp/recipe', () => ({
  listRecipes: acpMocks.listRecipes,
}));

const actions = {
  startChat: vi.fn(),
  createSession: vi.fn(),
  openSession: vi.fn(),
  openPage: vi.fn(),
};

async function invoke(
  extensionId: string,
  permissions: HostPermission[],
  capability: string,
  method: string,
  payload?: unknown
) {
  const post = vi.fn();
  await createHostSession(extensionId, permissions, post, actions).handleInvoke({
    type: 'grc/host/invoke',
    capability,
    method,
    payload,
  });
  return post.mock.calls[0][0];
}

afterEach(() => {
  localStorage.clear();
  unregisterPluginCommands('a-plugin');
  unregisterPluginCommands('b-plugin');
  vi.clearAllMocks();
});

describe('commands power', () => {
  it('lists the core commands', async () => {
    const result = await invoke('demo', ['commands:execute'], 'commands', 'list');

    expect(result.payload.map((command: { id: string }) => command.id)).toEqual([
      'chat.new',
      'session.open',
      'plugin.open',
    ]);
  });

  it('starts a chat with a prompt and a recipe', async () => {
    actions.startChat.mockResolvedValue('session-1');

    const result = await invoke('demo', ['commands:execute'], 'commands', 'execute', {
      command: 'chat.new',
      args: { prompt: 'review my diff', recipeId: 'review' },
    });

    expect(actions.startChat).toHaveBeenCalledWith({
      prompt: 'review my diff',
      recipeId: 'review',
    });
    expect(result.payload).toEqual({ sessionId: 'session-1' });
  });

  it('opens sessions and plugin pages', async () => {
    await invoke('demo', ['commands:execute'], 'commands', 'execute', {
      command: 'session.open',
      args: { sessionId: 's9' },
    });
    await invoke('demo', ['commands:execute'], 'commands', 'execute', {
      command: 'plugin.open',
      args: { extensionId: 'other', viewId: 'home' },
    });

    expect(actions.openSession).toHaveBeenCalledWith('s9');
    expect(actions.openPage).toHaveBeenCalledWith('other', 'home');
  });

  it('rejects unknown commands, prototype keys and invalid arguments', async () => {
    const unknown = await invoke('demo', ['commands:execute'], 'commands', 'execute', {
      command: 'nope',
    });
    const prototypeKey = await invoke('demo', ['commands:execute'], 'commands', 'execute', {
      command: 'constructor',
    });
    const invalid = await invoke('demo', ['commands:execute'], 'commands', 'execute', {
      command: 'session.open',
      args: {},
    });
    const oversized = await invoke('demo', ['commands:execute'], 'commands', 'execute', {
      command: 'chat.new',
      args: { prompt: 'x'.repeat(20_001) },
    });

    expect(unknown.error).toBe('Unknown command "nope"');
    expect(prototypeKey.error).toBe('Unknown command "constructor"');
    expect(invalid.error).toContain('Invalid "sessionId"');
    expect(oversized.error).toContain('Invalid "prompt"');
    expect(actions.startChat).not.toHaveBeenCalled();
  });

  it('lists and runs plugin-registered commands alongside the core ones', async () => {
    const run = vi.fn().mockReturnValue({ done: true });
    registerPluginCommand('a-plugin', 'refresh', 'Refresh the view', run);

    const list = await invoke('demo', ['commands:execute'], 'commands', 'list');
    expect(list.payload).toContainEqual({
      id: 'a-plugin:refresh',
      description: 'Refresh the view',
    });

    const result = await invoke('demo', ['commands:execute'], 'commands', 'execute', {
      command: 'a-plugin:refresh',
      args: { x: 1 },
    });
    expect(run).toHaveBeenCalledWith({ x: 1 });
    expect(result.payload).toEqual({ done: true });
  });

  it('keeps two plugins in separate namespaces and drops them independently', async () => {
    registerPluginCommand('a-plugin', 'go', 'Go', vi.fn());
    registerPluginCommand('b-plugin', 'go', 'Go', vi.fn());

    const beforeIds = (await invoke('demo', ['commands:execute'], 'commands', 'list')).payload.map(
      (c: { id: string }) => c.id
    );
    expect(beforeIds).toEqual(expect.arrayContaining(['a-plugin:go', 'b-plugin:go']));

    unregisterPluginCommands('a-plugin');
    const afterIds = (await invoke('demo', ['commands:execute'], 'commands', 'list')).payload.map(
      (c: { id: string }) => c.id
    );
    expect(afterIds).not.toContain('a-plugin:go');
    expect(afterIds).toContain('b-plugin:go');
  });

  it('requires commands:execute', async () => {
    const result = await invoke('demo', ['sessions:read'], 'commands', 'execute', {
      command: 'chat.new',
    });

    expect(result.error).toContain('commands:execute');
    expect(actions.startChat).not.toHaveBeenCalled();
  });
});

describe('recipes power', () => {
  it('projects the recipe library without instructions or file paths', async () => {
    acpMocks.listRecipes.mockResolvedValue([
      {
        id: 'review',
        recipe: { title: 'Review', description: 'Review a diff', instructions: 'secret' },
        file_path: '/home/me/review.yaml',
        last_modified: '2026-09-01T00:00:00Z',
        schedule_cron: '0 9 * * *',
      },
    ]);

    const result = await invoke('demo', ['recipes:read'], 'recipes', 'list');

    expect(result.payload).toEqual([
      {
        id: 'review',
        title: 'Review',
        description: 'Review a diff',
        lastModified: '2026-09-01T00:00:00Z',
        scheduleCron: '0 9 * * *',
        slashCommand: null,
      },
    ]);
  });

  it('requires recipes:read', async () => {
    const result = await invoke('demo', [], 'recipes', 'list');

    expect(result.error).toContain('recipes:read');
  });
});

describe('storage power', () => {
  const grant: HostPermission[] = ['storage:readwrite'];

  it('stores, reads, lists and deletes values', async () => {
    await invoke('demo', grant, 'storage', 'set', {
      key: 'prefs',
      value: { theme: 'dark', n: [1] },
    });
    await invoke('demo', grant, 'storage', 'set', { key: 'other', value: 2 });

    expect((await invoke('demo', grant, 'storage', 'get', { key: 'prefs' })).payload).toEqual({
      theme: 'dark',
      n: [1],
    });
    expect((await invoke('demo', grant, 'storage', 'keys')).payload).toEqual(['prefs', 'other']);
    expect((await invoke('demo', grant, 'storage', 'delete', { key: 'other' })).payload).toEqual({
      key: 'other',
      existed: true,
    });
    expect((await invoke('demo', grant, 'storage', 'get', { key: 'other' })).payload).toBeNull();
  });

  it('keeps each plugin in its own store', async () => {
    await invoke('a', grant, 'storage', 'set', { key: 'k', value: 'from-a' });

    expect((await invoke('b', grant, 'storage', 'get', { key: 'k' })).payload).toBeNull();
    expect((await invoke('a', grant, 'storage', 'get', { key: 'k' })).payload).toBe('from-a');
  });

  it('stores keys that look like prototype properties as plain data', async () => {
    await invoke('demo', grant, 'storage', 'set', { key: '__proto__', value: 'x' });

    expect((await invoke('demo', grant, 'storage', 'get', { key: '__proto__' })).payload).toBe('x');
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('enforces key and size limits', async () => {
    for (let i = 0; i < 200; i++) {
      await invoke('demo', grant, 'storage', 'set', { key: `k${i}`, value: i });
    }
    const tooManyKeys = await invoke('demo', grant, 'storage', 'set', { key: 'extra', value: 1 });
    const overwrite = await invoke('demo', grant, 'storage', 'set', { key: 'k0', value: 'ok' });

    clearExtensionStorage('demo');
    const tooLarge = await invoke('demo', grant, 'storage', 'set', {
      key: 'big',
      value: 'x'.repeat(600 * 1024),
    });

    expect(tooManyKeys.error).toContain('200 keys');
    expect(overwrite.payload).toEqual({ key: 'k0' });
    expect(tooLarge.error).toContain('512 KB');
  });

  it('recovers from a corrupt store and clears on request', async () => {
    localStorage.setItem('goose.client-extension-storage.demo', '{not json');

    expect((await invoke('demo', grant, 'storage', 'keys')).payload).toEqual([]);

    await invoke('demo', grant, 'storage', 'set', { key: 'k', value: 1 });
    clearExtensionStorage('demo');

    expect((await invoke('demo', grant, 'storage', 'keys')).payload).toEqual([]);
  });

  it('requires storage:readwrite and a key', async () => {
    const denied = await invoke('demo', [], 'storage', 'get', { key: 'k' });
    const missing = await invoke('demo', grant, 'storage', 'get', {});

    expect(denied.error).toContain('storage:readwrite');
    expect(missing.error).toContain('Invalid "key"');
  });
});
