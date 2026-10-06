import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Checkbox, FAB, IconButton, RadioButton, Searchbar, Switch } from 'react-native-paper';

import { AmountKeypad } from '../../../components/AmountKeypad';
import { FilterChip } from '../../../components/FilterChip';
import { OutlinedField } from '../../../components/OutlinedField';
import { PillButton } from '../../../components/PillButton';
import { SegmentedChoice } from '../../../components/SegmentedChoice';
import { useTheme } from '../../../theme';
import { GalleryCard, Wrap } from './GalleryFrame';
import { t } from '../../../lib/i18n';

const R = '\u20B9';

export function ButtonsCard(): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  return (
    <GalleryCard title={t('galleryUi.buttons')} caption={t('galleryUi.pillButtonsDpDp')}>
      <Wrap>
        <PillButton label={t('galleryUi.save')} />
        <PillButton label={t('galleryUi.addByHand')} icon="edit" variant="outlined" />
        <PillButton label={t('galleryUi.cancel')} variant="outlined" />
        <PillButton label={t('galleryUi.skip')} variant="text" />
        <PillButton label={t('galleryUi.disabled')} disabled />
      </Wrap>
      <Wrap>
        <FAB testID="fab-small" icon="plus" size="small" mode="flat" accessibilityLabel={t('galleryUi.add')} />
        <FAB testID="fab-extended" icon="plus" label={t('galleryUi.newGoal')} mode="flat" />
        <IconButton icon="tune" mode="contained-tonal" accessibilityLabel={t('galleryUi.filters')} />
        <IconButton icon="dots-vertical" mode="outlined" accessibilityLabel={t('galleryUi.more')} />
        <PillButton testID="loading-button" label={loading ? t('galleryUi.savingU') : t('galleryUi.saveChanges')} onPress={() => setLoading((v) => !v)} />
      </Wrap>
    </GalleryCard>
  );
}

export function TextFieldsCard(): React.JSX.Element {
  const [paid, setPaid] = useState('');
  const [note, setNote] = useState('Dinner with Priya & Arjun, split 3 ways');
  return (
    <GalleryCard title={t('galleryUi.textFields')} caption={t('galleryUi.outlinedFieldsDpCorners')}>
      <OutlinedField testID="field-empty" label={t('galleryUi.paidTo')} value={paid} onChangeText={setPaid} />
      <OutlinedField label={t('galleryUi.paidTo')} value="Third Wave Coffee" leadingIcon="storefront" />
      <OutlinedField label={t('galleryUi.amount')} value="1,24,999" prefix={t('galleryUi.rs')} helper={t('galleryUi.indianFormatAsYou')} />
      <OutlinedField label={t('galleryUi.lastDigits')} value="44" error={t('galleryUi.enterDigits')} />
      <OutlinedField label={t('galleryUi.paidWith')} value={t('galleryUi.upiUBRahul')} dropdown onPress={() => undefined} />
      <View style={{ opacity: 0.5 }} pointerEvents="none">
        <OutlinedField label={t('galleryUi.bankLogin')} value="Not needed" leadingIcon="lock" />
      </View>
      <OutlinedField label={t('galleryUi.date')} value="Today, 24 Oct" leadingIcon="calendar_today" dropdown onPress={() => undefined} />
      <OutlinedField label={t('galleryUi.note')} value={note} onChangeText={setNote} maxLength={120} helper={`${note.length} / 120`} />
    </GalleryCard>
  );
}

export function SearchKeypadCards(): React.JSX.Element {
  const [q, setQ] = useState('swiggy');
  const [amt, setAmt] = useState('1249');
  const { colors, typography } = useTheme();
  return (
    <>
      <GalleryCard title={t('galleryUi.search')} caption={t('galleryUi.idleAndActiveActive')}>
        <Searchbar placeholder={t('galleryUi.searchEntries')} value="" accessibilityLabel={t('galleryUi.searchEntries')} />
        <Searchbar placeholder={t('galleryUi.searchEntries')} value={q} onChangeText={setQ} accessibilityLabel={t('galleryUi.activeSearch')} />
      </GalleryCard>
      <GalleryCard title={t('galleryUi.amountKeypad')} caption={t('galleryUi.customKeypadSheetGroups')}>
        <Text testID="gallery-amount" style={[typography.displayMedium, { textAlign: 'center', color: colors.onSurface }]}>{`${R}${amt || '0'}`}</Text>
        <AmountKeypad value={amt} onChange={setAmt} />
      </GalleryCard>
    </>
  );
}

export function SelectionCard(): React.JSX.Element {
  const [radio, setRadio] = useState('a');
  const [seg, setSeg] = useState<'spent' | 'got' | 'moved'>('spent');
  const [chips, setChips] = useState({ upi: true, cash: false });
  const [on, setOn] = useState(true);
  return (
    <GalleryCard title={t('galleryUi.selection')} caption={t('galleryUi.checkboxOnOffPartial')}>
      <Wrap gap={16}>
        <Checkbox status="checked" />
        <Checkbox status="unchecked" />
        <Checkbox status="indeterminate" />
        <RadioButton.Group onValueChange={setRadio} value={radio}>
          <Wrap gap={8}>
            <RadioButton value="a" />
            <RadioButton value="b" />
          </Wrap>
        </RadioButton.Group>
        <Switch testID="gallery-switch" value={on} onValueChange={setOn} accessibilityLabel={t('galleryUi.exampleSwitch')} />
        <Switch value={false} accessibilityLabel={t('galleryUi.offSwitch')} />
        <Switch value disabled accessibilityLabel={t('galleryUi.disabledSwitch')} />
      </Wrap>
      <SegmentedChoice
        options={[{ id: 'spent', label: t('galleryUi.spent') }, { id: 'got', label: t('galleryUi.got') }, { id: 'moved', label: t('galleryUi.moved') }]}
        value={seg}
        onChange={setSeg}
        accessibilityLabel={t('galleryUi.entryType')}
      />
      <Wrap>
        <FilterChip label={t('galleryUi.upi')} selected={chips.upi} onPress={() => setChips((c) => ({ ...c, upi: !c.upi }))} testID="chip-upi" />
        <FilterChip label={t('galleryUi.cash')} selected={chips.cash} onPress={() => setChips((c) => ({ ...c, cash: !c.cash }))} testID="chip-cash" />
        <FilterChip label={t('galleryUi.toReviewUB')} selected={false} icon="auto_awesome" />
        <FilterChip label={t('galleryUi.eatingOut')} selected icon="restaurant" keepIcon />
        <FilterChip label={t('galleryUi.suggestCategory')} selected={false} icon="auto_awesome" />
      </Wrap>
    </GalleryCard>
  );
}
