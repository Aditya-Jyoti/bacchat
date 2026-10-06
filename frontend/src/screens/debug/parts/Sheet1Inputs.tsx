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

const R = '\u20B9';

export function ButtonsCard(): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  return (
    <GalleryCard title="BUTTONS" caption="Pill buttons 48dp (52dp for full-width primary). FAB uses primaryContainer. Loading state keeps the label.">
      <Wrap>
        <PillButton label="Save" />
        <PillButton label="Add by hand" icon="edit" variant="outlined" />
        <PillButton label="Cancel" variant="outlined" />
        <PillButton label="Skip" variant="text" />
        <PillButton label="Disabled" disabled />
      </Wrap>
      <Wrap>
        <FAB testID="fab-small" icon="plus" size="small" mode="flat" accessibilityLabel="Add" />
        <FAB testID="fab-extended" icon="plus" label="New goal" mode="flat" />
        <IconButton icon="tune" mode="contained-tonal" accessibilityLabel="Filters" />
        <IconButton icon="dots-vertical" mode="outlined" accessibilityLabel="More" />
        <PillButton testID="loading-button" label={loading ? 'Saving\u2026' : 'Save changes'} onPress={() => setLoading((v) => !v)} />
      </Wrap>
    </GalleryCard>
  );
}

export function TextFieldsCard(): React.JSX.Element {
  const [paid, setPaid] = useState('');
  const [note, setNote] = useState('Dinner with Priya & Arjun, split 3 ways');
  return (
    <GalleryCard title="TEXT FIELDS" caption="Outlined fields, 12dp corners, 56dp tall. States: empty, focused, filled, prefix, error, dropdown, disabled, multi-line with counter.">
      <OutlinedField testID="field-empty" label="Paid to" value={paid} onChangeText={setPaid} />
      <OutlinedField label="Paid to" value="Third Wave Coffee" leadingIcon="storefront" />
      <OutlinedField label="Amount" value="1,24,999" prefix={`${R} `} helper="Indian format as you type" />
      <OutlinedField label="Last 4 digits" value="44" error="Enter 4 digits" />
      <OutlinedField label="Paid with" value={`UPI \u00B7 rahul@okhdfc`} dropdown onPress={() => undefined} />
      <View style={{ opacity: 0.5 }} pointerEvents="none">
        <OutlinedField label="Bank login" value="Not needed" leadingIcon="lock" />
      </View>
      <OutlinedField label="Date" value="Today, 24 Oct" leadingIcon="calendar_today" dropdown onPress={() => undefined} />
      <OutlinedField label="Note" value={note} onChangeText={setNote} maxLength={120} helper={`${note.length} / 120`} />
    </GalleryCard>
  );
}

export function SearchKeypadCards(): React.JSX.Element {
  const [q, setQ] = useState('swiggy');
  const [amt, setAmt] = useState('1249');
  const { colors, typography } = useTheme();
  return (
    <>
      <GalleryCard title="SEARCH" caption="Idle and active. Active expands to a full-screen SearchView.">
        <Searchbar placeholder="Search entries" value="" accessibilityLabel="Search entries" />
        <Searchbar placeholder="Search entries" value={q} onChangeText={setQ} accessibilityLabel="Active search" />
      </GalleryCard>
      <GalleryCard title="AMOUNT + KEYPAD" caption="Custom keypad sheet. Groups digits in lakhs as you type.">
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
    <GalleryCard title="SELECTION" caption="Checkbox (on, off, partial), radio, switch, segmented button, filter chip, input chip, assist chip.">
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
        <Switch testID="gallery-switch" value={on} onValueChange={setOn} accessibilityLabel="Example switch" />
        <Switch value={false} accessibilityLabel="Off switch" />
        <Switch value disabled accessibilityLabel="Disabled switch" />
      </Wrap>
      <SegmentedChoice
        options={[{ id: 'spent', label: 'Spent' }, { id: 'got', label: 'Got' }, { id: 'moved', label: 'Moved' }]}
        value={seg}
        onChange={setSeg}
        accessibilityLabel="Entry type"
      />
      <Wrap>
        <FilterChip label="UPI" selected={chips.upi} onPress={() => setChips((c) => ({ ...c, upi: !c.upi }))} testID="chip-upi" />
        <FilterChip label="Cash" selected={chips.cash} onPress={() => setChips((c) => ({ ...c, cash: !c.cash }))} testID="chip-cash" />
        <FilterChip label={`To review \u00B7 2`} selected={false} icon="auto_awesome" />
        <FilterChip label="Eating out" selected icon="restaurant" keepIcon />
        <FilterChip label="Suggest category" selected={false} icon="auto_awesome" />
      </Wrap>
    </GalleryCard>
  );
}
