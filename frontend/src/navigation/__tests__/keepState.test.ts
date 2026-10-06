import { restorableState } from '../keepState';

describe('restorableState', () => {
  it('drops nested navigation params once the route has its own state, keeps the rest', () => {
    const input = {
      routes: [
        { name: 'splash', key: 'a' },
        { name: 'main', key: 'b', params: { screen: 'home', params: { x: 1 }, initial: true, other: 'keep' }, state: { index: 3, routes: [{ name: 'you', key: 'c', params: { screen: 's' } }] } },
        { name: 'k24', key: 'd', params: { screen: 'not-nested' } },
      ],
      index: 2,
    } as never;
    const out = restorableState(input) as unknown as { routes: { name: string; params?: object; state?: { routes: { params?: object }[] } }[] };
    expect(out.routes[1].params).toEqual({ other: 'keep' });
    expect(out.routes[1].state?.routes[0].params).toEqual({ screen: 's' });
    expect(out.routes[2].params).toEqual({ screen: 'not-nested' });
    expect(out.routes[0]).toEqual({ name: 'splash', key: 'a' });
  });

  it('removes params entirely when nothing else is left', () => {
    const out = restorableState({ routes: [{ name: 'main', key: 'b', params: { screen: 'home' }, state: { routes: [] } }] } as never) as unknown as { routes: { params?: unknown }[] };
    expect('params' in out.routes[0]).toBe(false);
  });
});
