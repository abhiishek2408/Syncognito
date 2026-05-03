import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Modal, Animated, Linking } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

export default function SettingsScreen({ navigation }: { navigation: any }) {
  const { isDarkMode, theme, accentColor, toggleDarkMode, setAccentColor } = useTheme();
  const styles = getStyles(theme);
  const [notifications, setNotifications] = useState(true);
  const [highQuality, setHighQuality] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Load Preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const notifPref = await AsyncStorage.getItem('@pref_notifications');
        const hqPref = await AsyncStorage.getItem('@pref_hq_audio');
        if (notifPref !== null) setNotifications(JSON.parse(notifPref));
        if (hqPref !== null) setHighQuality(JSON.parse(hqPref));
      } catch (e) {
        console.warn('Failed to load preferences.');
      }
    };
    loadPreferences();
  }, []);

  // Handlers for toggles
  const handleToggleNotifications = async (val: boolean) => {
    setNotifications(val);
    try { await AsyncStorage.setItem('@pref_notifications', JSON.stringify(val)); } catch (e) {}
  };

  const handleToggleHighQuality = async (val: boolean) => {
    setHighQuality(val);
    try { await AsyncStorage.setItem('@pref_hq_audio', JSON.stringify(val)); } catch (e) {}
  };

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Error', 'Cannot open the link at this time.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        </View>

        {/* Section: Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: accentColor }]}>Appearance</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: accentColor + '15' }]}>
                  <MaterialCommunityIcons name="theme-light-dark" size={20} color={accentColor} />
                </View>
                <Text style={[styles.rowLabel, { color: theme.text }]}>Dark Mode</Text>
              </View>
              <Switch 
                value={isDarkMode} 
                onValueChange={toggleDarkMode}
                trackColor={{ false: '#ccc', true: accentColor }}
                thumbColor="#fff"
              />
            </View>
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
            <View style={[styles.row, { flexDirection: 'column', alignItems: 'flex-start', paddingBottom: 20 }]}>
              <Text style={[styles.rowLabel, { color: theme.text, marginBottom: 15 }]}>Theme Color</Text>
              <View style={{ flexDirection: 'row', gap: 15 }}>
                {['#1DB954', '#BB86FC', '#FF4081', '#FFB74D', '#64B5F6'].map(color => (
                  <TouchableOpacity
                    key={color}
                    style={{
                      width: 32, height: 32, borderRadius: 16, backgroundColor: color,
                      borderWidth: accentColor === color ? 3 : 0,
                      borderColor: theme.text
                    }}
                    onPress={() => setAccentColor(color)}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Section: Preferences */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: accentColor }]}>Preferences</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: accentColor + '15' }]}>
                  <MaterialCommunityIcons name="bell-outline" size={20} color={accentColor} />
                </View>
                <Text style={[styles.rowLabel, { color: theme.text }]}>Push Notifications</Text>
              </View>
              <Switch 
                value={notifications} 
                onValueChange={handleToggleNotifications}
                trackColor={{ false: '#ccc', true: accentColor }}
                thumbColor="#fff"
              />
            </View>
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#64B5F615' }]}>
                  <MaterialCommunityIcons name="high-definition" size={20} color="#64B5F6" />
                </View>
                <Text style={[styles.rowLabel, { color: theme.text }]}>High Quality Audio</Text>
              </View>
              <Switch 
                value={highQuality} 
                onValueChange={handleToggleHighQuality}
                trackColor={{ false: '#ccc', true: accentColor }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Section: Privacy */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: accentColor }]}>Privacy & Security</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.row} onPress={() => openUrl('https://syncognito-nine.vercel.app/privacy')}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#FFB74D15' }]}>
                  <MaterialCommunityIcons name="lock-outline" size={20} color="#FFB74D" />
                </View>
                <Text style={[styles.rowLabel, { color: theme.text }]}>Privacy Policy</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.row} onPress={() => openUrl('https://syncognito-nine.vercel.app/terms')}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#FF704315' }]}>
                  <MaterialCommunityIcons name="file-document-outline" size={20} color="#FF7043" />
                </View>
                <Text style={[styles.rowLabel, { color: theme.text }]}>Terms of Service</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
            <TouchableOpacity style={styles.row} onPress={() => openUrl('https://syncognito-nine.vercel.app/data-deletion')}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#BB86FC15' }]}>
                  <MaterialCommunityIcons name="database-remove-outline" size={20} color="#BB86FC" />
                </View>
                <Text style={[styles.rowLabel, { color: theme.text }]}>Data Deletion Policy</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Danger */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: accentColor }]}>Account</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.row} onPress={() => setShowDeleteModal(true)}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#EF535015' }]}>
                  <MaterialCommunityIcons name="account-remove-outline" size={20} color="#EF5350" />
                </View>
                <Text style={[styles.rowLabel, { color: '#EF5350' }]}>Delete Account</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.version, { color: theme.textSecondary }]}>Version 1.0.0 (Build 2026)</Text>
      </ScrollView>

      {/* Beautiful Delete Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <View style={styles.dangerIconWrap}>
              <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF5350" />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Delete Account</Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>This action is permanent and cannot be undone. All your synced data will be lost.</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteModal(false)}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerBtn} onPress={() => { setShowDeleteModal(false); /* Add Delete Logic */ }}>
                <Text style={styles.dangerBtnText}>DELETE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
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
  section: { marginBottom: 25 },
  sectionTitle: { color: '#1DB954', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12, marginLeft: 4 },
  card: { backgroundColor: theme.surface, borderRadius: 20, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { color: theme.text, fontSize: 15, fontWeight: '500' },
  separator: { height: 1, backgroundColor: theme.border },
  version: { color: '#444', fontSize: 12, textAlign: 'center', marginTop: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: theme.surface, borderRadius: 28, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: theme.border, shadowColor: '#EF5350', shadowOpacity: 0.2, shadowRadius: 30, elevation: 15 },
  dangerIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(239, 83, 80, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(239, 83, 80, 0.3)' },
  infoIconWrap: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1 },
  modalTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  modalSub: { color: '#AAA', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  modalButtons: { flexDirection: 'row', width: '100%', gap: 16 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: '#222', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  cancelBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  dangerBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: '#EF5350', alignItems: 'center', shadowColor: '#EF5350', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5 },
  dangerBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  infoBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5 },
  infoBtnText: { color: '#000', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
});
