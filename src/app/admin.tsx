import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PanelTab } from '@/features/admin/PanelTab';
import { RoundsTab } from '@/features/admin/RoundsTab';
import { RulesTab } from '@/features/admin/RulesTab';
import { useScoring } from '@/data';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';
import { MatchBar } from '@/ui/match';
import { Segmented } from '@/ui/officials';

type Tab = 'rules' | 'rounds' | 'panel';

export default function AdminScreen() {
  return (
    <ThemeProvider name="daylight">
      <StatusBar style="dark" />
      <Admin />
    </ThemeProvider>
  );
}

function Admin() {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const s = useScoring();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [tab, setTab] = useState<Tab>('rules');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <MatchBar onHome={() => router.replace('/')} ring={s.ring.name} category="Competition setup" roleLabel="Admin" compact={!wide} />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], width: '100%', maxWidth: 1040, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ alignSelf: wide ? 'flex-start' : 'stretch' }}>
          <Segmented value={tab} onChange={setTab} options={[
            { value: 'rules', label: wide ? '1 · Rules & scoring' : 'Rules' },
            { value: 'rounds', label: wide ? '2 · Categories & rounds' : 'Rounds' },
            { value: 'panel', label: wide ? '3 · Panel & devices' : 'Panel' },
          ]} />
        </View>
        {tab === 'rules' ? <RulesTab wide={wide} /> : tab === 'rounds' ? <RoundsTab wide={wide} /> : <PanelTab wide={wide} />}
      </ScrollView>
    </SafeAreaView>
  );
}
