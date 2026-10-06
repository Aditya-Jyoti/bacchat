/** @jest-environment node */
import { importLink } from '../../navigation/linking';
import type { ShareNative } from '../../../modules/bacchat-share/src';
import { createShareService } from '../shareService';

function fakeNative(initial: string[]) {
  let listener: ((e: { uris: string[] }) => void) | null = null;
  const native: ShareNative & { emit: (u: string[]) => void; active: () => boolean } = {
    getInitialSharedUris: jest.fn(() => initial),
    addListener: (_e, l) => {
      listener = l;
      return { remove: () => { listener = null; } };
    },
    emit: (uris) => listener?.({ uris }),
    active: () => listener != null,
  };
  return native;
}

describe('share service', () => {
  it('opens k7 for the image that launched the app', () => {
    const open = jest.fn();
    const native = fakeNative(['file:///cache/shared/1.img']);
    createShareService({ native, open }).start();
    expect(open).toHaveBeenCalledWith(importLink('file:///cache/shared/1.img'));
  });

  it('opens k7 for images shared while running, the first of several', () => {
    const open = jest.fn();
    const native = fakeNative([]);
    const svc = createShareService({ native, open });
    svc.start();
    expect(open).not.toHaveBeenCalled();
    native.emit(['file:///a.img', 'file:///b.img']);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(importLink('file:///a.img'));
    svc.stop();
    expect(native.active()).toBe(false);
  });

  it('does nothing without the native module', () => {
    const open = jest.fn();
    createShareService({ native: null, open }).start();
    expect(open).not.toHaveBeenCalled();
  });
});
