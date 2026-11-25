// Start: send the official to sign-in, the ring picker or their work screen.
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/live';
import { homeFor } from '@/live/routes';

export default function Start() {
  const s = useSession();
  if (s.status === 'booting') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1220' }}>
        <ActivityIndicator color="#f4c247" />
      </View>
    );
  }
  if (s.status === 'signedOut' || !s.profile) return <Redirect href="/sign-in" />;
  return <Redirect href={homeFor(s.profile)} />;
}
