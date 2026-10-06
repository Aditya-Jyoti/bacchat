import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createFakeLlm } from '../../../../modules/bacchat-llm/src/fake';
import { RECOMMENDED_MODELS, useAiPreferences, type DownloadFetch, type DownloadFs } from '../../../lib/ai';
import { createMemorySecureStore } from '../../../services';
import { AI_SECURE_KEYS } from '../../../services/aiService';
import { renderWithTheme } from '../../../testUtils';
import K24_Settings from '../K24_Settings';

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
  const mount = (ai: Record<string, unknown> = {}, secure = createMemorySecureStore()) =>
    renderWithTheme(<K24_Settings />, mode, { servicesOptions: { secure, ai: { onDevice: createFakeLlm(), downloadFs: fakeFs(), downloadFetch: smallFetch, ...ai } as never } });

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
    expect(useAiPreferences.getState().aiConsent.anthropic).toBeGreaterThan(0);
    await waitFor(() => expect(getByText('Allowed for Anthropic. You can turn this off any time.')).toBeTruthy());
    expect(queryByTestId('ai-consent-first')).toBeNull();
    fireEvent(getByTestId('ai-consent-switch'), 'valueChange', false);
    expect(useAiPreferences.getState().aiConsent.anthropic).toBeUndefined();
  });

  it('tells the user when a message was read by rules only for lack of consent', () => {
    useAiPreferences.getState().noteConsentSkipped(Date.now());
    const { getByTestId } = mount();
    expect(getByTestId('ai-consent-skipped')).toBeTruthy();
  });

  it('sets up an OpenAI-compatible provider: presets, address check, masked key in the secure store', async () => {
    const secure = createMemorySecureStore();
    const { getByTestId, findByText, queryByTestId } = mount({}, secure);
    fireEvent.press(getByTestId('ai-provider-openai'));
    expect(useAiPreferences.getState().aiCloudProvider).toBe('openai');
    expect(queryByTestId('ai-anthropic-note')).toBeNull();
    fireEvent.press(getByTestId('ai-preset-groq'));
    expect(getByTestId('ai-base-url').props.value).toBe('https://api.groq.com/openai/v1');
    expect(getByTestId('ai-openai-model').props.value).toBe('llama-3.1-8b-instant');
    fireEvent.changeText(getByTestId('ai-base-url'), 'groq dot com');
    expect(getByTestId('ai-endpoint-save').props.accessibilityState.disabled).toBe(true);
    await findByText('Enter an address that starts with http:// or https://.');
    fireEvent.press(getByTestId('ai-preset-groq'));
    fireEvent.press(getByTestId('ai-endpoint-save'));
    expect(useAiPreferences.getState()).toMatchObject({ aiOpenAiBaseUrl: 'https://api.groq.com/openai/v1', aiOpenAiModel: 'llama-3.1-8b-instant' });
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

  it('per-feature overrides can be set and cleared', () => {
    const { getByTestId } = mount();
    fireEvent.press(getByTestId('ai-override-ingestion-device'));
    expect(useAiPreferences.getState().aiFeatureModes).toEqual({ ingestion: 'device' });
    fireEvent.press(getByTestId('ai-override-advisor-off'));
    expect(useAiPreferences.getState().aiFeatureModes).toEqual({ ingestion: 'device', advisor: 'off' });
    fireEvent.press(getByTestId('ai-override-ingestion-inherit'));
    expect(useAiPreferences.getState().aiFeatureModes).toEqual({ advisor: 'off' });
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
