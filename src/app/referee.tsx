// The chief referee's console. An operator opening it is sent to the operator console.
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { Console } from '@/features/console/Console';
import { useRingNeeded, useSession } from '@/live';
import { homeFor } from '@/live/routes';
import { ThemeProvider } from '@/theme/ThemeContext';
import { palettes } from '@/theme/tokens';

export default function RefereeScreen() {
  const sess = useSession();
  const need = useRingNeeded();
  if (sess.status === 'booting') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palettes.daylight.ground }}>
        <ActivityIndicator color={palettes.daylight.gold} />
      </View>
    );
  }
  if (sess.status === 'signedOut' || !sess.profile) return <Redirect href="/sign-in" />;
  const home = homeFor(sess.profile);
  if (need.needed) return <Redirect href="/rings" />;
  if (home !== '/referee') return <Redirect href={home} />;
  return (
    <ThemeProvider name="daylight">
      <StatusBar style="dark" />
      <Console />
    </ThemeProvider>
  );
}
