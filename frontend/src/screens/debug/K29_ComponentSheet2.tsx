/** k29: Component sheet 2. Interactions and overlays, shown in light and dark. Debug gallery. */
import React from 'react';

import { GalleryShell } from './parts/GalleryFrame';
import { GesturesCard, LongPressCard, SheetsCard, TooltipsCard } from './parts/Sheet2Overlays';
import { AmountsCard, AppBarsCard, BannersCard, SteppersCard } from './parts/Sheet2States';
import { IllustrationsCard, IndiaIconsCard } from './parts/Sheet2Art';
import { t } from '../../lib/i18n';

export default function K29_ComponentSheet2(): React.JSX.Element {
  return (
    <GalleryShell testID="screen-k29" heading={t('galleryUi.interactionsOverlays')}>
      <TooltipsCard />
      <LongPressCard />
      <GesturesCard />
      <SheetsCard />
      <BannersCard />
      <SteppersCard />
      <AppBarsCard />
      <AmountsCard />
      <IllustrationsCard />
      <IndiaIconsCard />
    </GalleryShell>
  );
}
