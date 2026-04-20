import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SongScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Songs</Text>
      <Text style={styles.subtitle}>Browse and play songs here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F0F' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#AAA' },
});
