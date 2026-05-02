import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { View, Text, StyleSheet } from 'react-native';

export default function ChatScreen() {
  const { theme, accentColor } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);

  return (
    <View style={dynamicStyles.container}>
      <Text style={dynamicStyles.title}>Chat</Text>
      <Text style={dynamicStyles.subtitle}>Group chat and messages will appear here.</Text>
    </View>
  );
}

const getStyles = (theme: any, accentColor: string) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F0F' },
  title: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#AAA' },
});
