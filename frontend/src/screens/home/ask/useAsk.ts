import { useCallback, useEffect, useRef, useState } from 'react';

import { loadAskHistory, saveAsk, shouldKeepAskHistory, useServices } from '../../../services';
import type { ChatTurn } from '../../../lib/ai';

export type ToolRead = { id: string; tool: string; ok?: boolean };

export type AskMessage =
  | { id: string; role: 'user'; text: string }
  | {
      id: string;
      role: 'assistant';
      text: string;
      tools: ToolRead[];
      /** streaming while the answer builds, then done, stopped (by the user) or error. */
      status: 'streaming' | 'done' | 'stopped' | 'error';
      errorCode?: string;
      /** Which engine answered (set when the answer is done). */
      engine?: { id: string; kind: 'cloud' | 'device'; label: string };
    };

export type AskState = {
  /** null while the stored key is being read. */
  hasKey: boolean | null;
  messages: AskMessage[];
  busy: boolean;
  send(question: string): void;
  stop(): void;
};

/** Runs questions through services.createAdvisor() and keeps the conversation for this open sheet. */
export function useAsk(): AskState {
  const services = useServices();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const counter = useRef(0);
  const history = useRef<ChatTurn[]>([]);

  // Past exchanges come back only when history is being kept.
  useEffect(() => {
    if (!shouldKeepAskHistory(services.settings)) return;
    let live = true;
    void loadAskHistory(services.db).then((past) => {
      if (!live || past.length === 0) return;
      setMessages((now) => {
        if (now.length > 0) return now;
        history.current = past.flatMap((r) => [
          { role: 'user' as const, text: r.question },
          { role: 'assistant' as const, text: r.answer },
        ]);
        return past.flatMap((r, i): AskMessage[] => [
          { id: `h${i}u`, role: 'user', text: r.question },
          { id: `h${i}a`, role: 'assistant', text: r.answer, tools: r.toolNames.map((tool, j) => ({ id: `h${i}t${j}`, tool, ok: true })), status: 'done' },
        ]);
      });
    });
    return () => {
      live = false;
    };
  }, [services]);

  useEffect(() => {
    alive.current = true;
    const read = (): void => {
      // Ready when the chosen engine can answer: a saved key, or a downloaded on-device model.
      services.ai
        .canAdvise()
        .then((ok) => alive.current && setHasKey(ok))
        .catch(() => alive.current && setHasKey(false));
    };
    read();
    // The AI service also fires for key, model and settings changes.
    const off = services.ai.subscribe(read);
    return () => {
      alive.current = false;
      off();
      abort.current?.abort();
    };
  }, [services]);

  const patch = useCallback((id: string, fn: (m: Extract<AskMessage, { role: 'assistant' }>) => Partial<Extract<AskMessage, { role: 'assistant' }>>) => {
    if (!alive.current) return;
    setMessages((list) => list.map((m) => (m.id === id && m.role === 'assistant' ? { ...m, ...fn(m) } : m)));
  }, []);

  const send = useCallback(
    (question: string): void => {
      const q = question.trim();
      if (!q || busy) return;
      const uid = `u${++counter.current}`;
      const aid = `a${++counter.current}`;
      const ctl = new AbortController();
      abort.current = ctl;
      const askedAt = services.now();
      const toolNames: string[] = [];
      setBusy(true);
      setMessages((l) => [...l, { id: uid, role: 'user', text: q }, { id: aid, role: 'assistant', text: '', tools: [], status: 'streaming' }]);
      void (async () => {
        let text = '';
        try {
          const advisor = await services.createAdvisor();
          if (!advisor) {
            patch(aid, () => ({ status: 'error', errorCode: 'bad_key' }));
            return;
          }
          for await (const ev of advisor.ask(q, { history: history.current, signal: ctl.signal })) {
            if (ctl.signal.aborted) break;
            if (ev.type === 'text_delta') {
              text += ev.text;
              patch(aid, (m) => ({ text: m.text + ev.text }));
            } else if (ev.type === 'tool_call') {
              if (!toolNames.includes(ev.tool)) toolNames.push(ev.tool);
              patch(aid, (m) => ({ tools: [...m.tools, { id: ev.id, tool: ev.tool }] }));
            } else if (ev.type === 'tool_result') {
              patch(aid, (m) => ({ tools: m.tools.map((x) => (x.id === ev.id ? { ...x, ok: ev.ok } : x)) }));
            } else if (ev.type === 'done') {
              history.current = [...history.current, { role: 'user', text: q }, { role: 'assistant', text: ev.text }];
              patch(aid, () => ({ text: ev.text, status: 'done', ...(ev.engine ? { engine: ev.engine } : {}) }));
              if (shouldKeepAskHistory(services.settings)) {
                await saveAsk(services.db, { question: q, answer: ev.text, toolNames, askedAt, answeredAt: services.now() });
              }
            } else if (ev.type === 'error') {
              patch(aid, () => ({ status: ev.error.code === 'cancelled' ? 'stopped' : 'error', errorCode: ev.error.code, text: ev.partialText }));
            }
          }
        } catch {
          patch(aid, () => ({ status: 'error', errorCode: 'unknown', text }));
        } finally {
          if (abort.current === ctl) abort.current = null;
          if (alive.current) setBusy(false);
        }
      })();
    },
    [busy, patch, services],
  );

  const stop = useCallback((): void => {
    abort.current?.abort();
    setMessages((l) => l.map((m) => (m.role === 'assistant' && m.status === 'streaming' ? { ...m, status: 'stopped' } : m)));
    setBusy(false);
  }, []);

  return { hasKey, messages, busy, send, stop };
}
