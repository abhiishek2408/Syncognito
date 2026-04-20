import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppNavigator from '../navigation/AppNavigator';
import MiniPlayer from '../components/MiniPlayer';
import AuthContext from '../context/AuthContext';

type Props = { navigation: any };

export default function UserDashboard({ navigation }: Props) {
  const auth = React.useContext(AuthContext);

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
