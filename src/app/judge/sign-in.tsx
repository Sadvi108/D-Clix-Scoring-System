// Kept for old links: judges now sign in on the shared 6-digit PIN screen.
import { Redirect } from 'expo-router';

export default function JudgeSignIn() {
  return <Redirect href={{ pathname: '/sign-in', params: { next: 'judge' } }} />;
}
