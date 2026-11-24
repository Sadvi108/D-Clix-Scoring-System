import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useScoring } from '@/data';
import { AuditLog } from '@/features/results/AuditLog';
import { Standings } from '@/features/results/Standings';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';
import { MatchBar } from '@/ui/match';
import { Segmented } from '@/ui/officials';

export default function ResultsScreen() {
  return (
    <ThemeProvider name="daylight">
      <StatusBar style="dark" />
      <Results />
    </ThemeProvider>
  );
}

function Results() {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const s = useScoring();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [tab, setTab] = useState<'standings' | 'audit'>('standings');
  const { round } = useLocalSearchParams<{ round?: string }>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <MatchBar onHome={() => router.replace('/')} ring={s.ring.name} category="Results & qualification" roleLabel="Chief referee" compact={!wide} />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], width: '100%', maxWidth: 1040, alignSelf: 'center' }}>
        <View style={{ alignSelf: wide ? 'flex-start' : 'stretch' }}>
          <Segmented value={tab} onChange={setTab} options={[{ value: 'standings', label: 'Standings & qualification' }, { value: 'audit', label: 'Audit log' }]} />
        </View>
        {tab === 'standings' ? <Standings wide={wide} startRoundId={round} /> : <AuditLog wide={wide} />}
      </ScrollView>
    </SafeAreaView>
  );
}
