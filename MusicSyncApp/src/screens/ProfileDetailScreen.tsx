import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, Animated, Dimensions, ActivityIndicator
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import API_URL from '../utils/api';
import AuthContext from '../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileDetailScreen({ route, navigation }: any) {
  const { theme, accentColor } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);
  const auth = React.useContext(AuthContext);

  const { userId, userName } = route.params;
  const [userData, setUserData] = useState<any>(null);
  const [stats, setStats] = useState({ rooms: 0, friends: 0, alarms: 0 });
  const [loading, setLoading] = useState(true);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchUserProfile();
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : {};
      const [userResp, statsResp] = await Promise.all([
        axios.get(`${API_URL}/api/users/${userId}`, { headers }),
        axios.get(`${API_URL}/api/users/${userId}/stats`, { headers })
      ]);
      setUserData(userResp.data);
      setStats(statsResp.data);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } catch (err) {
      console.warn('Failed to fetch user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[dynamicStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.appBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={dynamicStyles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={dynamicStyles.appBarTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={dynamicStyles.content}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={dynamicStyles.headerBg}>
            <View style={dynamicStyles.avatarContainer}>
              <View style={dynamicStyles.avatarRing}>
                {userData?.avatar ? (
                  <Image source={{ uri: userData.avatar }} style={dynamicStyles.avatar} />
                ) : (
                  <View style={[dynamicStyles.avatar, dynamicStyles.avatarPlaceholder]}>
                    <MaterialCommunityIcons name="account" size={60} color={accentColor} />
                  </View>
                )}
              </View>
            </View>
            <Text style={dynamicStyles.name}>{userData?.name || userName}</Text>
            <Text style={dynamicStyles.email}>{userData?.email || 'Listener'}</Text>
          </View>

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
            <Text style={dynamicStyles.sectionTitle}>About</Text>
            <View style={dynamicStyles.infoCard}>
               <Text style={dynamicStyles.aboutText}>
                 {userData?.bio || "This user hasn't added a bio yet. They love sync listening!"}
               </Text>
            </View>
          </View>

          <View style={dynamicStyles.actionRow}>
             <TouchableOpacity 
               style={[dynamicStyles.primaryBtn, { backgroundColor: accentColor }]}
               onPress={() => navigation.navigate('Friends', { screen: 'Find' })}
             >
               <MaterialCommunityIcons name="account-plus" size={20} color={theme.background} />
               <Text style={[dynamicStyles.primaryBtnText, { color: theme.background }]}>ADD FRIEND</Text>
             </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: any, accentColor: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  appBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  appBarTitle: { color: theme.text, fontSize: 18, fontWeight: '800' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: theme.surface },
  content: { paddingBottom: 60 },
  headerBg: { alignItems: 'center', paddingVertical: 20 },
  avatarContainer: { marginBottom: 16 },
  avatarRing: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: accentColor, justifyContent: 'center', alignItems: 'center', padding: 4 },
  avatar: { width: 106, height: 106, borderRadius: 53, backgroundColor: theme.surface },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  name: { color: theme.text, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  email: { color: theme.textSecondary, fontSize: 14, marginTop: 4, textAlign: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 20, marginTop: 20, backgroundColor: theme.surface, borderRadius: 24, paddingVertical: 20, borderWidth: 1, borderColor: theme.border },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: theme.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: theme.textSecondary, fontSize: 12 },
  statDivider: { width: 1, height: 40, backgroundColor: theme.border },
  cardSection: { marginHorizontal: 20, marginTop: 30 },
  sectionTitle: { color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  infoCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: theme.border },
  aboutText: { color: theme.textSecondary, fontSize: 15, lineHeight: 22 },
  actionRow: { marginHorizontal: 20, marginTop: 40 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 20, shadowColor: accentColor, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  primaryBtnText: { fontSize: 15, fontWeight: '900', letterSpacing: 1 }
});
