import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppNavigator from '../navigation/AppNavigator';
import MiniPlayer from '../components/MiniPlayer';
import AuthContext from '../context/AuthContext';

type Props = { navigation: any };

export default function UserDashboard({ navigation }: Props) {
  const { token, initializing } = React.useContext(AuthContext);

  React.useEffect(() => {
    // Safety Guard: If user is somehow on this screen without a token, force redirect
    if (!initializing && !token) {
      console.log('[Security] No token detected in UserDashboard, redirecting to Login');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  }, [token, initializing, navigation]);

  if (initializing) return null;
  if (!token) return null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AppNavigator />
      <MiniPlayer />
    </SafeAreaView>

  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  userText: { color: '#AAA', marginTop: 6 },
  signOut: { position: 'absolute', right: 12, top: 12, padding: 6 },
  signOutText: { color: '#1DB954', fontWeight: '700' },
});
