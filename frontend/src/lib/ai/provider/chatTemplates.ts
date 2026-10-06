/** Chat templates for the small instruct models we recommend. Plain strings in, one prompt string out. */

export type TemplateId = 'chatml' | 'llama3' | 'gemma' | 'phi3';
export type PlainMessage = { role: 'user' | 'assistant'; text: string };
export type FormattedPrompt = { prompt: string; stop: string[] };

/** Strip anything that could fake a template control token inside user text. */
function clean(s: string, id: TemplateId): string {
  switch (id) {
    case 'chatml':
      return s.replace(/<\|im_(?:start|end)\|>/g, '');
    case 'llama3':
      return s.replace(/<\|(?:begin_of_text|start_header_id|end_header_id|eot_id)\|>/g, '');
    case 'gemma':
      return s.replace(/<(?:start|end)_of_turn>/g, '');
    case 'phi3':
      return s.replace(/<\|(?:system|user|assistant|end)\|>/g, '');
  }
}

/** Builds the full prompt, ending with the open assistant turn so the model continues from there. */
export function formatChat(id: TemplateId, system: string | undefined, messages: readonly PlainMessage[]): FormattedPrompt {
  const sys = system ? clean(system, id) : '';
  const msgs = messages.map((m) => ({ role: m.role, text: clean(m.text, id) }));
  switch (id) {
    case 'chatml': {
      let p = sys ? `<|im_start|>system\n${sys}<|im_end|>\n` : '';
      for (const m of msgs) p += `<|im_start|>${m.role}\n${m.text}<|im_end|>\n`;
      return { prompt: `${p}<|im_start|>assistant\n`, stop: ['<|im_end|>', '<|im_start|>'] };
    }
    case 'llama3': {
      let p = '<|begin_of_text|>';
      if (sys) p += `<|start_header_id|>system<|end_header_id|>\n\n${sys}<|eot_id|>`;
      for (const m of msgs) p += `<|start_header_id|>${m.role}<|end_header_id|>\n\n${m.text}<|eot_id|>`;
      return { prompt: `${p}<|start_header_id|>assistant<|end_header_id|>\n\n`, stop: ['<|eot_id|>', '<|start_header_id|>'] };
    }
    case 'gemma': {
      // Gemma has no system role: the system text leads the first user turn.
      let p = '';
      let first = true;
      for (const m of msgs) {
        const role = m.role === 'assistant' ? 'model' : 'user';
        const text = first && role === 'user' && sys ? `${sys}\n\n${m.text}` : m.text;
        if (role === 'user') first = false;
        p += `<start_of_turn>${role}\n${text}<end_of_turn>\n`;
      }
      if (first && sys) p = `<start_of_turn>user\n${sys}<end_of_turn>\n${p}`;
      return { prompt: `${p}<start_of_turn>model\n`, stop: ['<end_of_turn>', '<start_of_turn>'] };
    }
    case 'phi3': {
      let p = sys ? `<|system|>\n${sys}<|end|>\n` : '';
      for (const m of msgs) p += `<|${m.role}|>\n${m.text}<|end|>\n`;
      return { prompt: `${p}<|assistant|>\n`, stop: ['<|end|>', '<|user|>'] };
    }
  }
}
