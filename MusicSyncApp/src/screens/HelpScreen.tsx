import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const FAQ = [
  { q: 'How do I sync music?', a: 'Join a room or create one. As the host plays music, it will automatically sync with all members in real-time.' },
  { q: 'Can I listen anonymously?', a: 'Yes! Toggle "Go Anonymous" in a room to hide your identity from other members.' },
  { q: 'How to add songs?', a: 'You can suggest songs via the chat or use the "Add Song" button if enabled by the host.' },
  { q: 'Is there a member limit?', a: 'Standard rooms support up to 50 members simultaneously.' },
];

export default function HelpScreen({ navigation }: { navigation: any }) {
  const { theme, accentColor } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);

  return (
    <View style={dynamicStyles.container}>
      <ScrollView contentContainerStyle={dynamicStyles.content}>
        <View style={dynamicStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={dynamicStyles.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={dynamicStyles.title}>Help & Support</Text>
        </View>

        {/* Support Options */}
        <View style={dynamicStyles.supportGrid}>
          <TouchableOpacity style={dynamicStyles.supportCard} onPress={() => Linking.openURL('mailto:support@Syncognito.com')}>
            <View style={[dynamicStyles.iconCircle, { backgroundColor: '#1DB95415' }]}>
              <MaterialCommunityIcons name="email-outline" size={28} color="#1DB954" />
            </View>
            <Text style={dynamicStyles.cardTitle}>Email Us</Text>
            <Text style={dynamicStyles.cardDesc}>Get help via email</Text>
          </TouchableOpacity>

          <TouchableOpacity style={dynamicStyles.supportCard} onPress={() => Linking.openURL('https://Syncognito.com/chat')}>
            <View style={[dynamicStyles.iconCircle, { backgroundColor: '#64B5F615' }]}>
              <MaterialCommunityIcons name="chat-processing-outline" size={28} color="#64B5F6" />
            </View>
            <Text style={dynamicStyles.cardTitle}>Live Chat</Text>
            <Text style={dynamicStyles.cardDesc}>Talk to support</Text>
          </TouchableOpacity>
        </View>

        {/* FAQ Section */}
        <Text style={dynamicStyles.sectionHeader}>Frequently Asked Questions</Text>
        {FAQ.map((item, index) => (
          <View key={index} style={dynamicStyles.faqCard}>
            <View style={dynamicStyles.qRow}>
              <MaterialCommunityIcons name="help-circle-outline" size={20} color="#1DB954" />
              <Text style={dynamicStyles.question}>{item.q}</Text>
            </View>
            <Text style={dynamicStyles.answer}>{item.a}</Text>
          </View>
        ))}

        <TouchableOpacity style={dynamicStyles.communityBtn}>
          <MaterialCommunityIcons name="discord" size={24} color="#fff" />
          <Text style={dynamicStyles.communityText}>Join our Discord Community</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: any, accentColor: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 10, 
    marginBottom: 20
  },
  backBtn: { marginRight: 15 },
  title: { color: theme.text, fontSize: 22, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 60 },
  supportGrid: { flexDirection: 'row', gap: 12, marginBottom: 30 },
  supportCard: { 
    flex: 1, 
    backgroundColor: theme.surface, 
    padding: 20, 
    borderRadius: 24, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: theme.surface 
  },
  iconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  cardTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
  cardDesc: { color: theme.textSecondary, fontSize: 11, marginTop: 4 },
  sectionHeader: { color: accentColor, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16, marginLeft: 4 },
  faqCard: { backgroundColor: theme.surface, padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: theme.surface },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  question: { color: theme.text, fontSize: 15, fontWeight: '600' },
  answer: { color: theme.textSecondary, fontSize: 13, lineHeight: 20, marginLeft: 30 },
  communityBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 12, 
    backgroundColor: '#5865F2', 
    padding: 16, 
    borderRadius: 20, 
    marginTop: 20 
  },
  communityText: { color: theme.text, fontWeight: '700', fontSize: 15 }
});

