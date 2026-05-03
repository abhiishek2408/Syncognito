import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
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
  const { theme, accentColor } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);

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
  const isPremium = user?.isPremium || false;

  const togglePremium = async () => {
    if (!auth.token) return;
    try {
      const resp = await axios.post(`${API_URL}/api/ngl/premium-toggle`, {}, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      if (auth.refreshProfile) await auth.refreshProfile();
    } catch (err) {
      console.warn('Failed to toggle premium:', err);
    }
  };

  return (
    <ScrollView style={dynamicStyles.container} contentContainerStyle={dynamicStyles.content}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>

        {/* Header gradient area */}
        <View style={dynamicStyles.headerBg}>
          <View style={dynamicStyles.glowCircle1} />
          <View style={dynamicStyles.glowCircle2} />

          {/* Avatar */}
          <View style={dynamicStyles.avatarContainer}>
            <View style={[dynamicStyles.avatarRing, isPremium && dynamicStyles.premiumRing]}>
              {(user?.avatar) ? (
                <Image
                  source={{ uri: user.avatar }}
                  style={dynamicStyles.avatar}
                />
              ) : (
                <View style={[dynamicStyles.avatar, dynamicStyles.avatarPlaceholder]}>
                  <MaterialCommunityIcons name="account" size={60} color={isPremium ? '#8A2BE2' : "#1DB954"} />
                </View>
              )}
            </View>
            <View style={[dynamicStyles.statusDot, { backgroundColor: statusColor(status) }]} />
            {isPremium && (
              <View style={dynamicStyles.premiumBadge}>
                <MaterialCommunityIcons name="star" size={10} color="#000" />
                <Text style={dynamicStyles.premiumBadgeText}>PRO</Text>
              </View>
            )}
          </View>

          <Text style={dynamicStyles.name}>{user?.name || 'Guest User'}</Text>
          <Text style={dynamicStyles.email}>{user?.email || 'Not signed in'}</Text>
          {(user as any)?.bio ? (
            <Text style={dynamicStyles.bioText} numberOfLines={3}>{(user as any).bio}</Text>
          ) : null}
        </View>

        {user ? (
          <>
            <View style={dynamicStyles.statsRow}>
              <View style={dynamicStyles.statItem}>
                <MaterialCommunityIcons name="music-circle" size={24} color="#1DB954" />
                <Text style={dynamicStyles.statValue}>{stats.rooms}</Text>
                <Text style={dynamicStyles.statLabel}>Rooms</Text>
              </View>
              <View style={dynamicStyles.statDivider} />
              <View style={dynamicStyles.statItem}>
                <MaterialCommunityIcons name="account-group" size={24} color="#64B5F6" />
                <Text style={dynamicStyles.statValue}>{stats.friends}</Text>
                <Text style={dynamicStyles.statLabel}>Friends</Text>
              </View>
              <View style={dynamicStyles.statDivider} />
              <View style={dynamicStyles.statItem}>
                <MaterialCommunityIcons name="alarm" size={24} color="#FFB74D" />
                <Text style={dynamicStyles.statValue}>{stats.alarms}</Text>
                <Text style={dynamicStyles.statLabel}>Alarms</Text>
              </View>
            </View>

            <View style={dynamicStyles.cardSection}>
              <Text style={dynamicStyles.sectionTitle}>Account Info</Text>
              <View style={dynamicStyles.infoCard}>
                <View style={[dynamicStyles.infoRow, { borderBottomWidth: 0, borderColor: '#FFB74D30' }]}>
                  <View style={[dynamicStyles.infoIcon, { backgroundColor: '#FFB74D15' }]}>
                    <MaterialCommunityIcons name="earth" size={18} color="#FFB74D" />
                  </View>
                  <View style={dynamicStyles.infoContent}>
                    <Text style={dynamicStyles.infoLabel}>Timezone</Text>
                    <Text style={dynamicStyles.infoValue}>{(user as any).timezone || 'UTC'}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={16} color="#333" />
                </View>
              </View>
            </View>

            <View style={dynamicStyles.cardSection}>
              <Text style={dynamicStyles.sectionTitle}>Quick Actions</Text>
              <View style={dynamicStyles.actionsGrid}>
                <TouchableOpacity style={dynamicStyles.actionCard} onPress={() => navigation.navigate('Settings')}>
                  <View style={[dynamicStyles.actionIcon, { backgroundColor: '#64B5F615' }]}>
                    <MaterialCommunityIcons name="cog" size={18} color="#64B5F6" />
                  </View>
                  <Text style={dynamicStyles.actionText}>Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dynamicStyles.actionCard} onPress={() => navigation.navigate('Help')}>
                  <View style={[dynamicStyles.actionIcon, { backgroundColor: '#FF704315' }]}>
                    <MaterialCommunityIcons name="help-circle" size={18} color="#FF7043" />
                  </View>
                  <Text style={dynamicStyles.actionText}>Help</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dynamicStyles.actionCard} onPress={() => navigation.navigate('EditProfile')}>
                  <View style={[dynamicStyles.actionIcon, { backgroundColor: '#BB86FC15' }]}>
                    <MaterialCommunityIcons name="pencil" size={18} color="#BB86FC" />
                  </View>
                  <Text style={dynamicStyles.actionText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[dynamicStyles.actionCard, dynamicStyles.logoutCard]}
                onPress={async () => {
                  await auth.signOut();
                }}
              >
                <MaterialCommunityIcons name="logout" size={22} color="#EF5350" />
                <Text style={[dynamicStyles.actionText, { color: '#EF5350' }]}>Sign Out</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[dynamicStyles.actionCard, { marginTop: 12, width: '100%', borderColor: isPremium ? '#8A2BE240' : theme.border, backgroundColor: isPremium ? 'rgba(138,43,226,0.05)' : theme.surface }]}
                onPress={togglePremium}
              >
                <MaterialCommunityIcons name={isPremium ? "star" : "star-outline"} size={22} color={isPremium ? "#8A2BE2" : "#888"} />
                <Text style={[dynamicStyles.actionText, isPremium && { color: '#8A2BE2' }]}>
                  {isPremium ? 'Sync Pro Active' : 'Upgrade to Pro'}
                </Text>
              </TouchableOpacity>
            </View>
          </>

        ) : (
          <View style={[dynamicStyles.cardSection, { alignItems: 'center', marginTop: 40 }]}>
             <TouchableOpacity
                style={[dynamicStyles.actionCard, dynamicStyles.logoutCard, { width: '80%' }]}
                onPress={async () => {
                  await auth.signOut();
                }}
              >
                <MaterialCommunityIcons name="login" size={22} color="#1DB954" />
                <Text style={[dynamicStyles.actionText, { color: '#1DB954' }]}>Go to Login</Text>
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

const getStyles = (theme: any, accentColor: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { paddingBottom: 100 },
  headerBg: { alignItems: 'center', paddingTop: 10, paddingBottom: 16 },
  glowCircle1: { position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: accentColor, opacity: 0.05 },
  glowCircle2: { position: 'absolute', bottom: -20, left: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: '#7E57C2', opacity: 0.04 },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: accentColor, justifyContent: 'center', alignItems: 'center', padding: 2 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: theme.surface },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  statusDot: { position: 'absolute', bottom: 8, right: 8, width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: theme.background, zIndex: 10 },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(29, 185, 84, 0.08)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: 'rgba(29, 185, 84, 0.15)' },
  editProfileText: { color: accentColor, fontSize: 13, fontWeight: '800' },
  name: { color: theme.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  email: { color: theme.textSecondary, fontSize: 11, marginTop: 2, textAlign: 'center' },
  bioText: { color: theme.textSecondary, fontSize: 13, marginTop: 12, textAlign: 'center', paddingHorizontal: 40, fontStyle: 'italic', lineHeight: 18 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 12, backgroundColor: theme.surface, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 10, borderWidth: 1, borderColor: theme.border },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: theme.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: theme.textSecondary, fontSize: 11 },
  statDivider: { width: 1, height: 30, backgroundColor: theme.border },
  cardSection: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  infoCard: { backgroundColor: theme.surfaceDarker, borderRadius: 24, paddingVertical: 8, paddingHorizontal: 4, borderWidth: 1, borderColor: theme.surface },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.surface },
  infoIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface },
  infoContent: { flex: 1 },
  infoLabel: { color: theme.textSecondary, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { color: theme.text, fontSize: 13, fontWeight: '700', marginTop: 1 },
  aboutText: { color: theme.textSecondary, fontSize: 14, lineHeight: 20 },
  infoSeparator: { display: 'none' },
  statusIndicator: { width: 8, height: 8, borderRadius: 4 },
  actionsGrid: { flexDirection: 'row', gap: 20, justifyContent: 'center' },
  actionCard: { width: 85, backgroundColor: theme.surface, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: theme.border, gap: 6 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  actionText: { color: theme.textSecondary, fontSize: 11, fontWeight: '600' },
  logoutCard: { flexDirection: 'row', marginTop: 12, width: '100%', justifyContent: 'center', borderColor: '#EF535030' },
  premiumRing: { borderColor: '#8A2BE2', borderWidth: 3, shadowColor: '#8A2BE2', shadowOpacity: 0.8, shadowRadius: 15, elevation: 20 },
  premiumBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 2, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  premiumBadgeText: { color: '#000', fontSize: 8, fontWeight: '900' },
});
