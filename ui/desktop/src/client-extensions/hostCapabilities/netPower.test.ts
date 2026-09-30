import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostSession } from './session';

const actions = {
  startChat: vi.fn(),
  createSession: vi.fn(),
  openSession: vi.fn(),
  openPage: vi.fn(),
};

async function invoke(allowedOrigins: string[], payload?: unknown) {
  const post = vi.fn();
  await createHostSession('demo', ['net:fetch'], post, actions, allowedOrigins).handleInvoke({
    type: 'grc/host/invoke',
    capability: 'net',
    method: 'fetch',
    payload,
  });
  return post.mock.calls[0][0];
}

afterEach(() => {
  Reflect.deleteProperty(window, 'electron');
  vi.clearAllMocks();
});

describe('net power', () => {
  it('rejects a URL whose origin is not in the manifest allowlist', async () => {
    const result = await invoke([], { url: 'http://127.0.0.1:8455/api/repos' });

    expect(result.error).toContain('has not allow-listed origin "http://127.0.0.1:8455"');
  });

  it('rejects an invalid URL before checking the allowlist', async () => {
    const result = await invoke(['http://127.0.0.1:8455'], { url: 'not a url' });

    expect(result.error).toBe('Invalid URL "not a url"');
  });

  it('calls the Electron bridge only for an allow-listed origin', async () => {
    const netFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: {}, text: '{}' });
    Reflect.set(window, 'electron', { clientExtensionNetFetch: netFetch });

    const result = await invoke(['http://127.0.0.1:8455'], {
      url: 'http://127.0.0.1:8455/api/repos',
      headers: { 'X-Loupe-Capability': 'tok' },
    });

    expect(netFetch).toHaveBeenCalledWith({
      url: 'http://127.0.0.1:8455/api/repos',
      method: 'GET',
      headers: { 'X-Loupe-Capability': 'tok' },
      body: undefined,
    });
    expect(result.payload).toEqual({ ok: true, status: 200, headers: {}, text: '{}' });
  });

  it('rejects a different origin under the same allow-listed host', async () => {
    const netFetch = vi.fn();
    Reflect.set(window, 'electron', { clientExtensionNetFetch: netFetch });

    const result = await invoke(['http://127.0.0.1:8455'], {
      url: 'http://127.0.0.1:9999/api/repos',
    });

    expect(result.error).toContain('"http://127.0.0.1:9999"');
    expect(netFetch).not.toHaveBeenCalled();
  });

  it('rejects an unsupported method and an oversized body', async () => {
    const badMethod = await invoke(['http://127.0.0.1:8455'], {
      url: 'http://127.0.0.1:8455/api/repos',
      method: 'TRACE',
    });
    const oversized = await invoke(['http://127.0.0.1:8455'], {
      url: 'http://127.0.0.1:8455/api/repos',
      method: 'POST',
      body: 'x'.repeat(512 * 1024 + 1),
    });

    expect(badMethod.error).toContain('Invalid "method"');
    expect(oversized.error).toContain('Invalid "body"');
  });

  it('requires net:fetch', async () => {
    const post = vi.fn();
    await createHostSession('demo', [], post, actions, ['http://127.0.0.1:8455']).handleInvoke({
      type: 'grc/host/invoke',
      capability: 'net',
      method: 'fetch',
      payload: { url: 'http://127.0.0.1:8455/api/repos' },
    });

    expect(post.mock.calls[0][0].error).toContain('net:fetch');
  });
});
