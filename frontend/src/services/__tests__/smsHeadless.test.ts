/** @jest-environment node */
import { AppRegistry } from 'react-native';

import { createFakeSmsNative } from '../../../modules/bacchat-sms/src/fake';
import { createMemoryDb } from '../../data/db';
import { usePreferences } from '../../lib/preferences';
import { createMemoryStorage, setStorage } from '../../lib/storage';
import { createIngestService } from '../ingestService';
import { SMS_HEADLESS_TASK, registerSmsHeadlessTask, runSmsHeadlessTask } from '../smsHeadless';

const NOW = new Date(2026, 9, 24, 20, 30).getTime();
const BODY = 'Dear UPI user A/C X1234 debited by 150.0 on date 24Oct26 trf to RAMESH FRUITS Refno 429812345678 If not u? call 1800111109. -SBI';
const sms = { id: 'n1', address: 'VM-SBIUPI', body: BODY, receivedAt: NOW - 60_000 };

function setup() {
  const db = createMemoryDb();
  const native = createFakeSmsNative();
  native.permissions = { readSms: true, receiveSms: true, postNotifications: true };
  const ingest = createIngestService({ db, now: () => NOW, native });
  const getIngest = jest.fn(async () => ingest);
  const hydrate = jest.fn(async () => undefined);
  return { db, native, ingest, getIngest, hydrate, deps: { native, hydrate, getIngest } };
}

beforeEach(() => {
  setStorage(createMemoryStorage());
  usePreferences.setState({ smsIngestEnabled: true });
});

describe('runSmsHeadlessTask', () => {
  it('adds a To review entry, notifies and acknowledges', async () => {
    const { db, native, deps } = setup();
    native.queued = [sms];
    await runSmsHeadlessTask(sms, deps);
    expect(await db.entries.list()).toHaveLength(1);
    expect(native.notifications).toHaveLength(1);
    expect(native.queued).toHaveLength(0);
  });

  it('does nothing while SMS reading is off', async () => {
    const { db, deps, getIngest } = setup();
    usePreferences.setState({ smsIngestEnabled: false });
    await runSmsHeadlessTask(sms, deps);
    expect(getIngest).not.toHaveBeenCalled();
    expect(await db.entries.list()).toHaveLength(0);
  });

  it('ignores malformed data and a missing native module', async () => {
    const { deps, getIngest } = setup();
    await runSmsHeadlessTask({ id: 1 }, deps);
    await runSmsHeadlessTask(null, deps);
    await runSmsHeadlessTask(sms, { ...deps, native: null });
    expect(getIngest).not.toHaveBeenCalled();
  });

  it('leaves the message queued when services fail', async () => {
    const { native, deps } = setup();
    native.queued = [sms];
    await expect(runSmsHeadlessTask(sms, { ...deps, getIngest: async () => Promise.reject(new Error('x')) })).resolves.toBeUndefined();
    expect(native.queued).toHaveLength(1);
  });

  it('a repeat delivery adds no second entry', async () => {
    const { db, deps } = setup();
    await runSmsHeadlessTask(sms, deps);
    await runSmsHeadlessTask(sms, deps);
    expect(await db.entries.list()).toHaveLength(1);
  });
});

describe('registerSmsHeadlessTask', () => {
  it('registers under the key the native service uses', () => {
    const spy = jest.spyOn(AppRegistry, 'registerHeadlessTask').mockImplementation(() => undefined);
    registerSmsHeadlessTask();
    expect(spy).toHaveBeenCalledWith(SMS_HEADLESS_TASK, expect.any(Function));
    expect(SMS_HEADLESS_TASK).toBe('BacchatSmsHeadless');
    spy.mockRestore();
  });
});
