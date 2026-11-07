import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createFakeLlm } from '../../../../modules/bacchat-llm/src/fake';
import { RECOMMENDED_MODELS, useAiPreferences, type DownloadFetch, type DownloadFs } from '../../../lib/ai';
import { createMemorySecureStore } from '../../../services';
import { AI_SECURE_KEYS } from '../../../services/aiService';
import { renderWithTheme } from '../../../testUtils';
import K24_Settings from '../K24_Settings';
import { useSettingsGroups } from '../parts/SettingsGroup';

// Settings groups start collapsed; these tests reach rows inside them.
beforeEach(() => useSettingsGroups.getState().openAll());

const MODEL = RECOMMENDED_MODELS[0];

function fakeFs(initial: Record<string, Uint8Array> = {}): DownloadFs & { files: Map<string, Uint8Array> } {
  const files = new Map(Object.entries(initial));
  return {
    files,
    stat: async (n) => ({ exists: files.has(n), size: files.get(n)?.length ?? 0 }),
    open: async (n, truncate) => {
      if (truncate || !files.has(n)) files.set(n, new Uint8Array(0));
      return {
        write: (b) => {
          const cur = files.get(n)!;
          const next = new Uint8Array(cur.length + b.length);
          next.set(cur);
          next.set(b, cur.length);
          files.set(n, next);
        },
        close: () => undefined,
      };
    },
    rename: async (a, b) => {
      files.set(b, files.get(a)!);
      files.delete(a);
    },
    remove: async (n) => {
      files.delete(n);
    },
    sha256: async () => '',
    list: async () => [...files].map(([name, v]) => ({ name, size: v.length })),
    pathOf: (n) => `/models/${n}`,
  };
}

const smallFetch: DownloadFetch = async () => {
  let sent = false;
  return {
    ok: true,
    status: 200,
    headers: { get: (n) => (n === 'content-length' ? '4' : null) },
    body: { getReader: () => ({ read: async () => (sent ? { done: true } : ((sent = true), { done: false, value: new Uint8Array(4) })) }) },
  };
};

beforeEach(() => useAiPreferences.getState().reset());

describe.each(['light', 'dark'] as const)('k24 AI engine section (%s)', (mode) => {
  const mount = (ai: Record<string, unknown> = {}, secure = createMemorySecureStore(), fetchImpl?: typeof fetch) =>
    renderWithTheme(<K24_Settings />, mode, {
      servicesOptions: { secure, ...(fetchImpl ? { fetch: fetchImpl } : {}), ai: { onDevice: createFakeLlm(), downloadFs: fakeFs(), downloadFetch: smallFetch, ...ai } as never },
    });

  it('shows the four modes and what leaves the phone for each', async () => {
    const { getByTestId, getByText, findByText } = mount();
    expect(getByText('AI ENGINE')).toBeTruthy();
    await findByText('Ready to run models on this phone.');
    const summary = () => (getByTestId('ai-summary').findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children) as string[]).join(' ');
    expect(summary()).toContain('only totals');
    fireEvent.press(getByTestId('ai-mode-device'));
    expect(useAiPreferences.getState().aiMode).toBe('device');
    expect(summary()).toContain('Nothing leaves this phone.');
    fireEvent.press(getByTestId('ai-mode-off'));
    expect(summary()).toContain('rules on this phone');
    fireEvent.press(getByTestId('ai-mode-auto'));
    expect(summary()).toContain('goes first');
  });

  it('hides provider and consent controls when no cloud mode is chosen', () => {
    const { getByTestId, queryByTestId } = mount();
    expect(queryByTestId('ai-cloud')).toBeTruthy();
    fireEvent.press(getByTestId('ai-mode-device'));
    expect(queryByTestId('ai-cloud')).toBeNull();
  });

  it('consent starts off with a calm disclosure and is a per-provider switch', async () => {
    const { getByTestId, queryByTestId, getByText } = mount();
    expect(getByTestId('ai-consent-switch').props.value).toBe(false);
    expect(getByTestId('ai-consent-disclosure')).toBeTruthy();
    expect(getByTestId('ai-consent-first')).toBeTruthy();
    expect(getByText('Off. Messages are read on this phone by rules only.')).toBeTruthy();
    fireEvent(getByTestId('ai-consent-switch'), 'valueChange', true);
    expect(useAiPreferences.getState().aiConsent['openai:api.openai.com']).toBeGreaterThan(0);
    await waitFor(() => expect(getByText('Allowed for api.openai.com. You can turn this off any time.')).toBeTruthy());
    expect(queryByTestId('ai-consent-first')).toBeNull();
    fireEvent(getByTestId('ai-consent-switch'), 'valueChange', false);
    expect(useAiPreferences.getState().aiConsent['openai:api.openai.com']).toBeUndefined();
  });

  it('tells the user when a message was read by rules only for lack of consent', () => {
    useAiPreferences.getState().noteConsentSkipped(Date.now());
    const { getByTestId } = mount();
    expect(getByTestId('ai-consent-skipped')).toBeTruthy();
  });

  it('sets up an OpenAI-compatible provider: presets, address check, masked key in the secure store', async () => {
    const secure = createMemorySecureStore();
    const { getByTestId, findByText, queryByTestId } = mount({}, secure);
    // Anthropic is gone: OpenAI-compatible is the only route, so there is no provider switch.
    expect(queryByTestId('ai-provider-anthropic')).toBeNull();
    expect(useAiPreferences.getState().aiCloudProvider).toBe('openai');
    // A quick pick saves straight away.
    fireEvent.press(getByTestId('ai-preset-groq'));
    expect(getByTestId('ai-base-url').props.value).toBe('https://api.groq.com/openai/v1');
    expect(useAiPreferences.getState()).toMatchObject({ aiOpenAiBaseUrl: 'https://api.groq.com/openai/v1', aiOpenAiModel: 'llama-3.1-8b-instant' });
    expect(getByTestId('ai-model-field')).toHaveTextContent(/llama-3\.1-8b-instant/);
    fireEvent.changeText(getByTestId('ai-base-url'), 'groq dot com');
    expect(getByTestId('ai-endpoint-save').props.accessibilityState.disabled).toBe(true);
    await findByText('Enter an address that starts with http:// or https://.');
    expect(getByTestId('ai-openai-key').props.secureTextEntry).toBe(true);
    fireEvent.changeText(getByTestId('ai-openai-key'), 'gsk-secret');
    fireEvent.press(getByTestId('ai-openai-key-save'));
    await findByText('Key saved on this phone');
    expect(secure.dump()[AI_SECURE_KEYS.openaiKey]).toBe('gsk-secret');
    expect(getByTestId('ai-openai-key').props.value).toBe('');
    fireEvent.press(getByTestId('ai-openai-key-remove'));
    await findByText('No key yet');
    expect(secure.dump()[AI_SECURE_KEYS.openaiKey]).toBeUndefined();
    expect(useAiPreferences.getState().aiConsent).toEqual({});
  });

  it('has one global choice: no per-feature overrides', () => {
    const { queryByTestId } = mount();
    expect(queryByTestId('ai-override-ingestion')).toBeNull();
    expect(queryByTestId('ai-override-advisor-off')).toBeNull();
  });

  it('picks the model from the provider list: cheapest first, screenshot-capable only by default', async () => {
    const body = {
      data: [
        { id: 'big/pricey', name: 'Pricey', pricing: { prompt: '0.000003', completion: '0.000015' }, architecture: { input_modalities: ['text', 'image'] }, supported_parameters: ['tools'] },
        { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', pricing: { prompt: '0.0000001', completion: '0.0000004' }, architecture: { input_modalities: ['text', 'image'] }, supported_parameters: ['tools'] },
        { id: 'text/only', name: 'Text only', pricing: { prompt: '0.00000005', completion: '0.0000001' }, architecture: { input_modalities: ['text'] }, supported_parameters: ['tools'] },
      ],
    };
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      return { ok: true, status: 200, json: async () => body };
    }) as unknown as typeof fetch;
    const { getByTestId, findByTestId, queryByTestId, getAllByTestId } = mount({}, createMemorySecureStore(), fetchImpl);
    fireEvent.press(getByTestId('ai-preset-openrouter'));
    fireEvent.press(getByTestId('ai-model-field'));
    await findByTestId('model-google/gemini-2.5-flash-lite');
    expect(calls).toContain('https://openrouter.ai/api/v1/models');
    expect(queryByTestId('model-text/only')).toBeNull();
    const order = getAllByTestId(/^model-(big|google)/).map((n) => n.props.testID);
    expect(order).toEqual(['model-google/gemini-2.5-flash-lite', 'model-big/pricey']);
    fireEvent(getByTestId('model-only-fit'), 'valueChange', false);
    expect(getByTestId('model-text/only')).toBeTruthy();
    fireEvent.changeText(getByTestId('model-search'), 'gemini');
    expect(queryByTestId('model-big/pricey')).toBeNull();
    fireEvent.press(getByTestId('model-google/gemini-2.5-flash-lite'));
    await waitFor(() => expect(useAiPreferences.getState().aiOpenAiModel).toBe('google/gemini-2.5-flash-lite'));
  });

  it('falls back to a short built-in list when the provider list cannot be loaded', async () => {
    const fetchImpl = (async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    const { getByTestId, findByTestId } = mount({}, createMemorySecureStore(), fetchImpl);
    fireEvent.press(getByTestId('ai-preset-openrouter'));
    fireEvent.press(getByTestId('ai-model-field'));
    expect(await findByTestId('model-offline')).toBeTruthy();
    expect(getByTestId('model-google/gemini-2.5-flash-lite')).toBeTruthy();
  });

  it('lists the recommended models and downloads one with progress, then uses and deletes it', async () => {
    const fs = fakeFs();
    const { getByTestId, findByTestId, queryByTestId, getByText } = mount({ downloadFs: fs });
    expect(getByText(MODEL.name)).toBeTruthy();
    expect(await findByTestId('ai-no-active')).toBeTruthy();
    fireEvent.press(getByTestId(`ai-model-download-${MODEL.id}`));
    const use = await findByTestId(`ai-model-use-${MODEL.id}`);
    expect(fs.files.has(MODEL.fileName)).toBe(true);
    expect(queryByTestId(`ai-model-download-${MODEL.id}`)).toBeNull();
    fireEvent.press(use);
    expect(useAiPreferences.getState().aiActiveModelId).toBe(MODEL.id);
    await waitFor(() => expect(getByTestId(`ai-model-use-${MODEL.id}`).props.accessibilityState.disabled).toBe(true));
    expect(getByText('In use')).toBeTruthy();
    expect(getByText('Not checked against a published checksum.')).toBeTruthy();
    fireEvent.press(getByTestId(`ai-model-delete-${MODEL.id}`));
    await findByTestId(`ai-model-download-${MODEL.id}`);
    expect(fs.files.size).toBe(0);
    expect(useAiPreferences.getState().aiActiveModelId).toBeNull();
  });

  it('says so when the engine or downloads are not available in the build', async () => {
    const { findByText, getByText } = mount({ onDevice: createFakeLlm([], { available: false }), downloadFs: null });
    await findByText('Not available in this build, so on-device AI cannot run here.');
    expect(getByText('Downloads are not available in this build.')).toBeTruthy();
  });

  it('shows a calm line when a download fails', async () => {
    const bad: DownloadFetch = async () => ({ ok: false, status: 403, headers: { get: () => null } });
    const { getByTestId, findByTestId } = mount({ downloadFetch: bad });
    fireEvent.press(getByTestId(`ai-model-download-${MODEL.id}`));
    const err = await findByTestId(`ai-model-error-${MODEL.id}`);
    expect(err.props.children).toBe('The download address did not answer.');
    expect(getByTestId(`ai-model-download-${MODEL.id}`)).toBeTruthy();
  });
});
