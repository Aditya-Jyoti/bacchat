/** k20: Component sheet 1. Inputs, controls and loaders, shown in light and dark. Debug gallery. */
import React from 'react';

import { GalleryShell } from './parts/GalleryFrame';
import { ButtonsCard, SearchKeypadCards, SelectionCard, TextFieldsCard } from './parts/Sheet1Inputs';
import { DateTimeCard, FeedbackCard, ListRowsCard, LoadersCard, MenuCard, SlidersCard } from './parts/Sheet1Feedback';
import { t } from '../../lib/i18n';

export default function K20_ComponentSheet1(): React.JSX.Element {
  return (
    <GalleryShell testID="screen-k20" heading={t('galleryUi.khataComponents')}>
      <ButtonsCard />
      <TextFieldsCard />
      <SearchKeypadCards />
      <SelectionCard />
      <SlidersCard />
      <DateTimeCard />
      <LoadersCard />
      <FeedbackCard />
      <ListRowsCard />
      <MenuCard />
    </GalleryShell>
  );
}
