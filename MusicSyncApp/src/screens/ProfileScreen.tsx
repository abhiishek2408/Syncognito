import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, Animated, Dimensions, ActivityIndicator
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AuthContext from '../context/AuthContext';
import axios from 'axios';
import API_URL from '../utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileScreen({ navigation }: any) {
  const auth = React.useContext(AuthContext);
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [stats, setStats] = useState({ rooms: 0, friends: 0, alarms: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
    fetchStats();
  }, [scaleAnim, fadeAnim]);

  const fetchStats = async () => {
    if (!auth.token) return;
    try {
      const resp = await axios.get(`${API_URL}/api/users/me/stats`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      setStats(resp.data);
    } catch (err) {
      console.warn('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (base64: string, mime: string) => {
    // Moved to EditProfileScreen
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return '#1DB954';
      case 'inactive': return '#FFB74D';
      case 'banned': return '#EF5350';
      default: return '#888';
    }
  };

  const user = auth.user;
  const status = user?.profile_status || 'active';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>

        {/* Header gradient area */}
        <View style={styles.headerBg}>
          <View style={styles.glowCircle1} />
          <View style={styles.glowCircle2} />

          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarRing}>
              {(user?.avatar) ? (
                <Image
                  source={{ uri: user.avatar }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <MaterialCommunityIcons name="account" size={60} color="#1DB954" />
                </View>
              )}
            </View>
            <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
          </View>

          <Text style={styles.name}>{user?.name || 'Guest User'}</Text>
          <Text style={styles.email}>{user?.email || 'Not signed in'}</Text>
        </View>

        {user ? (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="music-circle" size={24} color="#1DB954" />
                <Text style={styles.statValue}>{stats.rooms}</Text>
                <Text style={styles.statLabel}>Rooms</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="account-group" size={24} color="#64B5F6" />
                <Text style={styles.statValue}>{stats.friends}</Text>
                <Text style={styles.statLabel}>Friends</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="alarm" size={24} color="#FFB74D" />
                <Text style={styles.statValue}>{stats.alarms}</Text>
                <Text style={styles.statLabel}>Alarms</Text>
              </View>
            </View>

            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Account Info</Text>
              <View style={styles.infoCard}>
                <View style={[styles.infoRow, { borderColor: '#1DB95430' }]}>
                  <View style={[styles.infoIcon, { backgroundColor: '#1DB95415' }]}>
                    <MaterialCommunityIcons name="shield-account" size={18} color="#1DB954" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Role</Text>
                    <Text style={styles.infoValue}>{(user.role || 'user').charAt(0).toUpperCase() + (user.role || 'user').slice(1)}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={16} color="#333" />
                </View>
                
                <View style={[styles.infoRow, { borderColor: statusColor(status) + '30' }]}>
                  <View style={[styles.infoIcon, { backgroundColor: statusColor(status) + '15' }]}>
                    <MaterialCommunityIcons name="circle" size={18} color={statusColor(status)} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Status</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.statusIndicator, { backgroundColor: statusColor(status) }]} />
                      <Text style={[styles.infoValue, { color: statusColor(status) }]}>{status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={16} color="#333" />
                </View>

                <View style={[styles.infoRow, { borderBottomWidth: 0, borderColor: '#FFB74D30' }]}>
                  <View style={[styles.infoIcon, { backgroundColor: '#FFB74D15' }]}>
                    <MaterialCommunityIcons name="earth" size={18} color="#FFB74D" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Timezone</Text>
                    <Text style={styles.infoValue}>{(user as any).timezone || 'UTC'}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={16} color="#333" />
                </View>
              </View>
            </View>

            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsGrid}>
                <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Settings')}>
                  <View style={[styles.actionIcon, { backgroundColor: '#64B5F615' }]}>
                    <MaterialCommunityIcons name="cog" size={18} color="#64B5F6" />
                  </View>
                  <Text style={styles.actionText}>Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Help')}>
                  <View style={[styles.actionIcon, { backgroundColor: '#FF704315' }]}>
                    <MaterialCommunityIcons name="help-circle" size={18} color="#FF7043" />
                  </View>
                  <Text style={styles.actionText}>Help</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('EditProfile')}>
                  <View style={[styles.actionIcon, { backgroundColor: '#BB86FC15' }]}>
                    <MaterialCommunityIcons name="pencil" size={18} color="#BB86FC" />
                  </View>
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.actionCard, styles.logoutCard]}
                onPress={async () => {
                  await auth.signOut();
                }}
              >
                <MaterialCommunityIcons name="logout" size={22} color="#EF5350" />
                <Text style={[styles.actionText, { color: '#EF5350' }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </>

        ) : (
          <View style={[styles.cardSection, { alignItems: 'center', marginTop: 40 }]}>
             <TouchableOpacity
                style={[styles.actionCard, styles.logoutCard, { width: '80%' }]}
                onPress={async () => {
                  await auth.signOut();
                }}
              >
                <MaterialCommunityIcons name="login" size={22} color="#1DB954" />
                <Text style={[styles.actionText, { color: '#1DB954' }]}>Go to Login</Text>
              </TouchableOpacity>
              <Text style={{ color: '#444', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
                You are currently in guest mode. Log in to sync with friends!
              </Text>
          </View>
        )}


      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { paddingBottom: 100 },
  headerBg: { alignItems: 'center', paddingTop: 10, paddingBottom: 16 },
  glowCircle1: { position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: '#1DB954', opacity: 0.05 },
  glowCircle2: { position: 'absolute', bottom: -20, left: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: '#7E57C2', opacity: 0.04 },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: '#1DB954', justifyContent: 'center', alignItems: 'center', padding: 2 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#111' },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  statusDot: { position: 'absolute', bottom: 8, right: 8, width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#000', zIndex: 10 },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(29, 185, 84, 0.08)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: 'rgba(29, 185, 84, 0.15)' },
  editProfileText: { color: '#1DB954', fontSize: 13, fontWeight: '800' },
  name: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  email: { color: '#666', fontSize: 11, marginTop: 2, textAlign: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 12, backgroundColor: '#0A0A0A', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 10, borderWidth: 1, borderColor: '#1E1E1E' },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#666', fontSize: 11 },
  statDivider: { width: 1, height: 30, backgroundColor: '#2A2A2A' },
  cardSection: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  infoCard: { backgroundColor: '#080808', borderRadius: 24, paddingVertical: 8, paddingHorizontal: 4, borderWidth: 1, borderColor: '#111' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#111' },
  infoIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  infoContent: { flex: 1 },
  infoLabel: { color: '#444', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 1 },
  infoSeparator: { display: 'none' },
  statusIndicator: { width: 8, height: 8, borderRadius: 4 },
  actionsGrid: { flexDirection: 'row', gap: 20, justifyContent: 'center' },
  actionCard: { width: 85, backgroundColor: '#0A0A0A', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: '#1E1E1E', gap: 6 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  actionText: { color: '#AAA', fontSize: 11, fontWeight: '600' },
  logoutCard: { flexDirection: 'row', marginTop: 12, width: '100%', justifyContent: 'center', borderColor: '#EF535030' },
});
