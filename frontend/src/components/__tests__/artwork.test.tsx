import React from 'react';

import { khataPalette } from '../../theme';
import { renderWithTheme } from '../../testUtils';
import { categoryIconCatalog, indiaCategoryIcons } from '../../data';
import { CategoryIcon } from '../CategoryIcon';
import { Glyph } from '../Glyph';
import { customIconNames, isCustomIcon } from '../icons';
import { customIconShapes } from '../icons/paths';
import { FALLBACK_ICON, isKnownIcon, resolveIconName } from '../iconMap';
import * as art from '../illustrations';

const H = { includeHiddenElements: true };

const SCENES = {
  TiffinIllustration: art.TiffinIllustration,
  CoinIllustration: art.CoinIllustration,
  KhataIllustration: art.KhataIllustration,
  EmptyEntries: art.EmptyEntries,
  EmptyGoals: art.EmptyGoals,
  EmptyBudget: art.EmptyBudget,
  EmptyAccounts: art.EmptyAccounts,
  EmptySearch: art.EmptySearch,
  EmptyUpcoming: art.EmptyUpcoming,
  GoalReached: art.GoalReached,
  SyncDone: art.SyncDone,
} as const;

describe.each(['light', 'dark'] as const)('illustrations (%s)', (mode) => {
  const c = khataPalette(45, mode);
  it.each(Object.entries(SCENES))('%s has a label, an ink layer and a blob from the theme', (_n, Scene) => {
    const { getByTestId, getByLabelText } = renderWithTheme(<Scene />, mode);
    expect(getByTestId('illustration').props.accessibilityRole).toBe('image');
    expect(getByTestId('illustration').props.accessibilityLabel).toMatch(/^Illustration of /);
    expect(getByLabelText(/Illustration of/)).toBeTruthy();
    expect(getByTestId('illustration-tint').props.fill.payload).toBeDefined();
    expect(getByTestId('illustration-ink').props.stroke.payload).toBeDefined();
    void c;
  });
  it('ink and tint can be overridden', () => {
    const a = renderWithTheme(<art.CoinIllustration />, mode).getByTestId('illustration-ink').props.stroke;
    const b = renderWithTheme(<art.CoinIllustration ink={c.primary} tint={c.secondaryContainer} />, mode).getByTestId('illustration-ink').props.stroke;
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
  it('chai glass keeps its two layers', () => {
    const { getByTestId } = renderWithTheme(<art.ChaiIllustration ink={c.onSurface} blob={c.primaryContainer} />, mode);
    expect(getByTestId('illustration-blob', H)).toBeTruthy();
    expect(getByTestId('illustration-ink', H)).toBeTruthy();
  });
});

describe('custom India icons', () => {
  it('has at least 25 icons, each with shapes inside the 24 grid', () => {
    expect(customIconNames.length).toBeGreaterThanOrEqual(25);
    for (const n of customIconNames) {
      const shapes = customIconShapes[n];
      expect(shapes.length).toBeGreaterThan(0);
      for (const s of shapes) {
        if ('c' in s) {
          const [x, y, r] = s.c;
          expect(x - r).toBeGreaterThanOrEqual(1.5);
          expect(x + r).toBeLessThanOrEqual(22.5);
          expect(y - r).toBeGreaterThanOrEqual(1.5);
          expect(y + r).toBeLessThanOrEqual(22.5);
        } else {
          const nums = s.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
          expect(Math.min(...nums)).toBeGreaterThanOrEqual(1.5);
          expect(Math.max(...nums)).toBeLessThanOrEqual(22.5);
        }
      }
    }
  });

  describe.each(['light', 'dark'] as const)('rendering (%s)', (mode) => {
    it.each([...customIconNames])('%s renders in a circle, selected or not', (name) => {
      const plain = renderWithTheme(<CategoryIcon name={name} />, mode);
      expect(plain.getByTestId(`custom-icon-${name}`, H)).toBeTruthy();
      const sel = renderWithTheme(<CategoryIcon name={name} selected />, mode);
      expect(sel.getByTestId(`custom-icon-${name}`, H)).toBeTruthy();
    });
    it('Glyph draws custom icons and falls back to Material otherwise', () => {
      expect(renderWithTheme(<Glyph name="diya" />, mode).getByTestId('custom-icon-diya', H)).toBeTruthy();
      expect(renderWithTheme(<Glyph name="home" />, mode).queryByTestId('custom-icon-home', H)).toBeNull();
    });
  });

  it('registry wins over Material, and known Material names still resolve', () => {
    expect(isCustomIcon('auto_rickshaw')).toBe(true);
    expect(isCustomIcon('local_cafe')).toBe(false);
    expect(isKnownIcon('auto_rickshaw')).toBe(true);
    expect(resolveIconName('local_cafe')).toBe('local-cafe');
    expect(resolveIconName('definitely_not_an_icon')).toBe(FALLBACK_ICON);
  });
});

describe('category icon catalog', () => {
  it('offers about 180 icons and every one resolves without the generic fallback', () => {
    const names = categoryIconCatalog.map(([n]) => n);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThanOrEqual(150);
    const unresolved = names.filter((n) => !isKnownIcon(n));
    expect(unresolved).toEqual([]);
    for (const n of names.filter((x) => !isCustomIcon(x))) expect(resolveIconName(n)).not.toBe(FALLBACK_ICON);
  });
  it('includes every custom icon', () => {
    const names = new Set(categoryIconCatalog.map(([n]) => n));
    for (const n of customIconNames) expect(names.has(n)).toBe(true);
    expect(indiaCategoryIcons.length).toBe(customIconNames.length);
  });
});
