import { useFonts } from 'expo-font';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
} from '@expo-google-fonts/figtree';
import { TiroDevanagariHindi_400Regular } from '@expo-google-fonts/tiro-devanagari-hindi';
import { YoungSerif_400Regular } from '@expo-google-fonts/young-serif';

export const fontAssets = {
  YoungSerif_400Regular,
  TiroDevanagariHindi_400Regular,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
};

/** Loads Young Serif, Tiro Devanagari Hindi (the Hindi serif) and Figtree. Returns true once ready (or if loading failed). */
export function useBacchatFonts(): boolean {
  const [loaded, error] = useFonts(fontAssets);
  return loaded || error != null;
}
