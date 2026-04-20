import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PlaylistsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Playlists</Text>
      <Text style={styles.subtitle}>Your playlists will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F0F' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#AAA' },
});
