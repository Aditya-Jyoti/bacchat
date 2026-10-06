import { t } from '../../../lib/i18n';

const KEYS: Record<string, string> = {
  bad_key: 'askUi.errBadKey',
  bad_model: 'askUi.errBadModel',
  rate_limit: 'askUi.errRateLimit',
  offline: 'askUi.errOffline',
  overloaded: 'askUi.errOverloaded',
  bad_request: 'askUi.errBadRequest',
  max_iterations: 'askUi.errMaxIterations',
  cancelled: 'askUi.errCancelled',
  unknown: 'askUi.errUnknown',
  no_engine: 'aiUi.errNoEngine',
  consent_needed: 'aiUi.errConsent',
};

/** Calm i18n text for an advisor error code. Never shows provider messages. */
export function advisorErrorText(code: string): string {
  return t(KEYS[code] ?? KEYS.unknown);
}

/** Chip text for a tool name, such as "read - goals". */
export function toolChipText(tool: string): string {
  const key = `askUi.toolName.${tool}`;
  const text = t(key);
  return text === key ? t('askUi.toolOther', { name: tool.replace(/_/g, ' ') }) : text;
}
