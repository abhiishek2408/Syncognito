import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Animated, Dimensions, Image, RefreshControl
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import API_URL from '../utils/api';
import { usePlayer } from '../context/PlayerContext';
import { AlarmCountdown } from '../components/AlarmCountdown';
import { useAlarms } from '../context/AlarmContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');



export default function HomeScreen({ navigation }: { navigation: any }) {
  const auth = useContext(AuthContext);
  const { currentTrack, isPlaying, togglePlayback, activeRoomCode, leaveRoom } = usePlayer();
  const { alarms, loadAlarms } = useAlarms();
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [globalStats, setGlobalStats] = useState({ listeners: 0, activeRooms: 0, friends: 0 });
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const headers = React.useMemo(() => auth.token ? { Authorization: `Bearer ${auth.token}` } : {}, [auth.token]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    
    try {
      const [roomsResp, statsResp, userStatsResp] = await Promise.all([
        axios.get(`${API_URL}/api/rooms/public`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/rooms/stats/global`).catch(() => ({ data: { listeners: 0, activeRooms: 0 } })),
        auth.token ? axios.get(`${API_URL}/api/users/me/stats`, { headers }).catch(() => ({ data: { friends: 0 } })) : Promise.resolve({ data: { friends: 0 } })
      ]);
      
      setPublicRooms((roomsResp.data || []).slice(0, 5));
      setGlobalStats({
        listeners: statsResp.data.listeners || 0,
        activeRooms: statsResp.data.activeRooms || 0,
        friends: userStatsResp.data.friends || 0
      });
      loadAlarms();
    } catch (err) {
      console.warn('Home load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }
  }, [auth.token, headers, loadAlarms, fadeAnim]);

  // Derived state for upcoming alarms
  const upcomingAlarms = (alarms || [])
    .filter((a: any) => !a.isTriggered && new Date(a.triggerAt) > new Date())
    .slice(0, 3);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogout = async () => {
    await auth.signOut();
    // No manual navigation needed here - App.tsx handles the switch when token becomes null
  };

  const formatRelative = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
    return `${Math.floor(diffDays / 365)} years`;
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => loadData(true)} 
            tintColor="#1DB954"
            colors={["#1DB954"]}
            progressBackgroundColor="#1A1A1A"
          />
        }
      >
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* Welcome */}
        <View style={styles.welcomeSection}>
          <View>
            <Text style={styles.greeting}>
              Hey, {auth.user?.name?.split(' ')[0] || 'there'}{' '}
              <MaterialCommunityIcons name="hand-wave" size={28} color="#FFB74D" />
            </Text>
            <Text style={styles.subtitle}>Connect and listen with friends</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile', { screen: 'ProfileMain' })} style={styles.profileBtn}>
            {auth.user?.profile_pic || auth.user?.avatar ? (
              <Image source={{ uri: auth.user.profile_pic || auth.user.avatar }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <MaterialCommunityIcons name="account" size={24} color="#1DB954" />
              </View>
            )}
          </TouchableOpacity>
        </View>



        {/* Quick Actions Compact Row (No Scroll) */}
        <View style={styles.quickCardRow}>
          {/* Public Rooms */}
          <TouchableOpacity 
            style={[styles.gridCard, { backgroundColor: '#1DB95410' }]} 
            onPress={() => navigation.navigate('Rooms')} 
            activeOpacity={0.8}
          >
            <View style={[styles.gridBlob, { backgroundColor: '#1DB95415' }]} />
            <View style={styles.gridIconBubble}>
              <MaterialCommunityIcons name="broadcast" size={20} color="#1DB954" />
            </View>
            <Text style={styles.gridTitle} numberOfLines={1}>Rooms</Text>
            <View style={[styles.gridDot, { backgroundColor: '#1DB95440' }]} />
          </TouchableOpacity>

          {/* NGL Anonymous Notes */}
          <TouchableOpacity 
            style={[styles.gridCard, { backgroundColor: '#100E1D' }]} 
            onPress={() => navigation.navigate('Profile', { screen: 'Ngl' })} 
            activeOpacity={0.8}
          >
            <View style={[styles.gridBlob, { backgroundColor: '#BB86FC15' }]} />
            <View style={styles.gridIconBubble}>
              <MaterialCommunityIcons name="incognito" size={20} color="#BB86FC" />
            </View>
            <Text style={styles.gridTitle} numberOfLines={1}>Anonymous</Text>
            <View style={[styles.gridDot, { backgroundColor: '#BB86FC40' }]} />
          </TouchableOpacity>

          {/* Global Alarms */}
          <TouchableOpacity 
            style={[styles.gridCard, { backgroundColor: '#1A1208' }]} 
            onPress={() => navigation.navigate('Alarms')} 
            activeOpacity={0.8}
          >
            <View style={[styles.gridBlob, { backgroundColor: '#FFB74D15' }]} />
            <View style={styles.gridIconBubble}>
              <MaterialCommunityIcons name="alarm" size={20} color="#FFB74D" />
            </View>
            <Text style={styles.gridTitle} numberOfLines={1}>Alarms</Text>
            <View style={[styles.gridDot, { backgroundColor: '#FFB74D40' }]} />
          </TouchableOpacity>
        </View>

        {/* Spotlight Card: Private Sync */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.spotlightCard} 
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Rooms')} 
          >
            <View style={styles.spotlightBlob} />
            <View style={styles.spotlightContent}>
              <View style={[styles.liveBadge, { borderColor: '#BB86FC40' }]}>
                <View style={[styles.liveBeam, { backgroundColor: '#BB86FC' }]} />
                <Text style={styles.liveBadgeText}>PRIVATE SYNC</Text>
              </View>
              <Text style={styles.spotlightTitle}>Host Your Own {'\n'}Music Room</Text>
              <Text style={styles.spotlightDesc}>Create a private space, invite your friends, and listen to your favorite tracks together in real-time.</Text>
              <View style={styles.spotlightFooter}>
                <View style={styles.avatarGroup}>
                  <MaterialCommunityIcons name="account-multiple-plus" size={16} color="#666" />
                  <Text style={styles.avatarGroupText}>Invite anyone via link</Text>
                </View>
                <TouchableOpacity style={[styles.joinSpotlightBtn, { backgroundColor: '#BB86FC' }]} onPress={() => navigation.navigate('Rooms')}>
                  <Text style={[styles.joinSpotlightText, { color: '#000' }]}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </View>


        {/* Active Rooms */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}><MaterialCommunityIcons name="fire" size={20} color="#FF7043" /> Active Rooms</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Rooms')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>


          {loading ? (
            <ActivityIndicator color="#1DB954" style={{ marginTop: 20 }} />
          ) : publicRooms.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="music-off" size={32} color="#333" />
              <Text style={styles.emptyText}>No active rooms</Text>
              <TouchableOpacity style={styles.createRoomBtn} onPress={() => navigation.navigate('Rooms')}>
                <Text style={styles.createRoomText}>Create one!</Text>
              </TouchableOpacity>
            </View>
          ) : (
            publicRooms.map((room, i) => (
              <TouchableOpacity
                key={room._id || i}
                style={styles.roomPreview}
                onPress={() => navigation.navigate('Room', { room, isAnonymous: false })}
                activeOpacity={0.7}
              >
                <View style={styles.roomPreviewHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roomPreviewName} numberOfLines={1}>{room.name}</Text>
                    <View style={styles.roomPreviewStats}>
                      <MaterialCommunityIcons name="account-group" size={12} color="#888" />
                      <Text style={styles.roomPreviewMeta}>{room.members?.length || 0} listening</Text>
                      {room.isPublic ? (
                        <View style={[styles.liveIndicatorMini, { backgroundColor: '#1DB95415' }]}>
                          <MaterialCommunityIcons name="earth" size={10} color="#1DB954" />
                          <Text style={[styles.liveTextMini, { color: '#1DB954' }]}>PUBLIC</Text>
                        </View>
                      ) : (
                        <View style={[styles.liveIndicatorMini, { backgroundColor: '#FFB74D15' }]}>
                          <MaterialCommunityIcons name="lock" size={10} color="#FFB74D" />
                          <Text style={[styles.liveTextMini, { color: '#FFB74D' }]}>PRIVATE</Text>
                        </View>
                      )}
                      {room.currentTrack?.isPlaying && (
                        <View style={styles.liveIndicatorMini}>
                          <View style={styles.liveDotMini} />
                          <Text style={styles.liveTextMini}>LIVE</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {activeRoomCode === room.roomCode && currentTrack.url && (
                      <TouchableOpacity 
                        style={styles.cardPlayBtn} 
                        onPress={() => togglePlayback()}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <MaterialCommunityIcons name={isPlaying ? 'pause' : 'play'} size={18} color="#000" />
                      </TouchableOpacity>
                    )}
                    <View style={styles.roomPreviewCodeBadge}>
                      <Text style={styles.roomPreviewCode}>#{room.roomCode}</Text>
                    </View>
                  </View>
                </View>
                
                {room.currentTrack?.title ? (
                  <View style={styles.roomPreviewTrackContainer}>
                    <MaterialCommunityIcons name="music-note" size={14} color="#1DB954" />
                    <Text style={styles.roomPreviewTrack} numberOfLines={1}>{room.currentTrack.title}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Upcoming Alarms */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}><MaterialCommunityIcons name="alarm" size={20} color="#FFB74D" /> Upcoming Alarms</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Alarms')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {upcomingAlarms.length > 0 ? (
            upcomingAlarms.map((alarm, i) => (
              <View key={alarm._id || i} style={styles.alarmPreview}>
                <MaterialCommunityIcons name="alarm" size={20} color="#FFB74D" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.alarmPreviewTitle}>{alarm.title}</Text>
                  {alarm.message ? <Text style={styles.alarmPreviewMsg} numberOfLines={1}>{alarm.message}</Text> : null}
                </View>
                <AlarmCountdown 
                  triggerAt={alarm.triggerAt} 
                  isPast={new Date(alarm.triggerAt) < new Date()} 
                  color="#FFB74D" 
                  style={styles.alarmPreviewTime} 
                />
              </View>
            ))
          ) : (
            <View style={[styles.emptyCard, { paddingVertical: 45, borderStyle: 'solid' }]}>
               <MaterialCommunityIcons name="alarm-off" size={24} color="#333" />
               <Text style={[styles.emptyText, { fontSize: 12, marginTop: 12 }]}>No alarms scheduled. Start your day with music! 🎵</Text>
            </View>
          )}
        </View>

        {/* Global Trending Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}><MaterialCommunityIcons name="trending-up" size={20} color="#BB86FC" /> Around the World</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 10 }}>
            <View style={styles.trendingCard}>
              <View style={[styles.trendingIcon, { backgroundColor: '#1DB95420' }]}>
                <MaterialCommunityIcons name="headphones" size={24} color="#1DB954" />
              </View>
              <Text style={styles.trendingVal}>{globalStats.listeners > 1000 ? `${(globalStats.listeners / 1000).toFixed(1)}k` : globalStats.listeners}</Text>
              <Text style={styles.trendingLabel}>Listeners Live</Text>
            </View>
            
            <View style={styles.trendingCard}>
              <View style={[styles.trendingIcon, { backgroundColor: '#BB86FC20' }]}>
                <MaterialCommunityIcons name="playlist-music" size={24} color="#BB86FC" />
              </View>
              <Text style={styles.trendingVal}>{globalStats.activeRooms}</Text>
              <Text style={styles.trendingLabel}>Active Rooms</Text>
            </View>

            <View style={styles.trendingCard}>
              <View style={[styles.trendingIcon, { backgroundColor: '#64B5F620' }]}>
                <MaterialCommunityIcons name="account-group" size={24} color="#64B5F6" />
              </View>
              <Text style={styles.trendingVal}>{globalStats.friends}</Text>
              <Text style={styles.trendingLabel}>{auth.token ? 'My Friends' : 'Community'}</Text>
            </View>
          </ScrollView>
        </View>


        {/* App Feature Spotlight (Showpiece) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}><MaterialCommunityIcons name="star-face" size={20} color="#FFB74D" /> Featured In App</Text>
          </View>
          <View style={styles.pulseGrid}>
            {[
              { name: 'Sync Rooms', color: '#1DB954', icon: 'broadcast' },
              { name: 'AI Alarms', color: '#64B5F6', icon: 'alarm-panel' },
              { name: 'Anon Vibes', color: '#BB86FC', icon: 'incognito' },
              { name: 'Social Chat', color: '#FF7043', icon: 'chat-processing' }
            ].map((p, i) => (
              <View key={i} style={[styles.pulseCard, { borderColor: p.color + '25' }]}>
                <View style={[styles.pulseIconWrap, { backgroundColor: p.color + '10' }]}>
                  <MaterialCommunityIcons name={p.icon as any} size={20} color={p.color} />
                </View>
                <Text style={[styles.pulseName, { color: p.color }]}>{p.name}</Text>
                <View style={[styles.pulseDot, { backgroundColor: p.color }]} />
              </View>
            ))}
          </View>
        </View>



      </Animated.View>
    </ScrollView>


      {/* Mini Player */}
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  // Welcome
  welcomeSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  greeting: { color: '#fff', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#888', fontSize: 14, marginTop: 4 },
  profileBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    overflow: 'hidden', 
    borderWidth: 1.5, 
    borderColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8
  },
  headerAvatar: { width: '100%', height: '100%' },
  headerAvatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  logoutBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  // Quick Compact Row
  quickCardRow: { 
    paddingHorizontal: 16, 
    flexDirection: 'row', 
    gap: 12,
    marginTop: 16,
    justifyContent: 'space-between'
  },
  gridCard: {
    width: (SCREEN_WIDTH - 56) / 3, // Perfect for 3 items
    height: 110,
    borderRadius: 20,
    padding: 12,
    overflow: 'hidden',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    borderWidth: 1.5,
    borderColor: '#333',
  },
  gridBlob: {
    position: 'absolute',
    top: -15,
    right: -15,
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  gridIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  gridTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  gridDesc: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  gridDot: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Section
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  seeAll: { color: '#1DB954', fontSize: 13, fontWeight: '700' },
  // Room preview
  roomPreview: { 
    backgroundColor: '#0D0D0D', 
    borderRadius: 16, 
    padding: 18, 
    marginBottom: 12, 
    borderWidth: 1.5, 
    borderColor: '#333',
  },
  roomPreviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  roomPreviewName: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  roomPreviewStats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomPreviewMeta: { color: '#666', fontSize: 11, fontWeight: '500' },
  liveIndicatorMini: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#1DB95410', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  liveDotMini: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#1DB954' },
  liveTextMini: { color: '#1DB954', fontSize: 8, fontWeight: '900' },
  roomPreviewCodeBadge: { backgroundColor: '#1A1A1A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roomPreviewCode: { color: '#1DB954', fontSize: 9, fontWeight: '800' },
  roomPreviewTrackContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', padding: 8, borderRadius: 8, gap: 6, borderWidth: 1, borderColor: '#151515' },
  roomPreviewTrack: { color: '#1DB954', fontSize: 12, fontWeight: '500', flex: 1 },
  // Empty
  emptyCard: { 
    alignItems: 'center', 
    paddingVertical: 40, 
    backgroundColor: '#080808', 
    borderRadius: 24, 
    borderWidth: 1.5, 
    borderColor: '#333',
    borderStyle: 'dashed'
  },
  emptyText: { color: '#333', marginTop: 12, fontSize: 14 },
  createRoomBtn: { backgroundColor: '#1DB954', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24, marginTop: 16 },
  createRoomText: { color: '#000', fontWeight: '800', fontSize: 15 },
  // Alarm preview
  alarmPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: '#333' },
  alarmPreviewTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  alarmPreviewMsg: { color: '#888', fontSize: 12, marginTop: 2 },
  alarmPreviewTime: { color: '#FFB74D', fontSize: 12, fontWeight: '600' },
  cardPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1DB954',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3
  },
  miniPlayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: 1.5,
    borderTopColor: '#333',
    justifyContent: 'space-between'
  },
  miniInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  miniDisc: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  miniTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  miniArtist: { color: '#666', fontSize: 11, marginTop: 2 },
  miniPlayBtn: { padding: 4 },
  miniLeaveBtn: { padding: 8, marginLeft: 4, borderLeftWidth: 1, borderLeftColor: '#222' },
  // Trending
  trendingCard: { 
    width: 130, 
    backgroundColor: '#0D0D0D', 
    borderRadius: 24, 
    padding: 16, 
    borderWidth: 1.5, 
    borderColor: '#1E1E1E',
    alignItems: 'center',
    gap: 8
  },
  trendingIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  trendingVal: { color: '#fff', fontSize: 18, fontWeight: '800' },
  trendingLabel: { color: '#666', fontSize: 11, fontWeight: '600' },
  // Spotlight
  spotlightCard: { 
    height: 180, 
    borderRadius: 32, 
    backgroundColor: '#111', 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: '#1DB95430',
    shadowColor: '#1DB954',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10
  },
  spotlightBlob: { 
    position: 'absolute', 
    top: -50, 
    right: -50, 
    width: 200, 
    height: 200, 
    borderRadius: 100, 
    backgroundColor: '#1DB954', 
    opacity: 0.1 
  },
  spotlightContent: { flex: 1, padding: 20, justifyContent: 'space-between' },
  liveBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    alignSelf: 'flex-start', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)' 
  },
  liveBeam: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1DB954' },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  spotlightTitle: { color: '#fff', fontSize: 24, fontWeight: '900', lineHeight: 28 },
  spotlightDesc: { color: '#888', fontSize: 12, lineHeight: 18 },
  spotlightFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatarGroup: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#333', borderWidth: 1.5 },
  avatarGroupText: { color: '#666', fontSize: 10, marginLeft: 8, fontWeight: '600' },
  joinSpotlightBtn: { backgroundColor: '#1DB954', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  joinSpotlightText: { color: '#000', fontSize: 13, fontWeight: '800' },
  // Pulse
  pulseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  pulseCard: { 
    width: (SCREEN_WIDTH - 42) / 2, 
    backgroundColor: '#0A0A0A', 
    height: 60, 
    borderRadius: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    borderWidth: 1, 
    gap: 12 
  },
  pulseIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  pulseName: { fontSize: 14, fontWeight: '700' },
  pulseDot: { position: 'absolute', top: 12, right: 12, width: 4, height: 4, borderRadius: 2, opacity: 0.5 },
});
