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
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');



export default function HomeScreen({ navigation }: { navigation: any }) {
  const { theme, accentColor, isDarkMode } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);

  const auth = useContext(AuthContext);
  const { currentTrack, isPlaying, togglePlayback, activeRoomCode, leaveRoom } = usePlayer();
  const { alarms, loadAlarms } = useAlarms();
  const { showToast } = useToast();
  
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [globalStats, setGlobalStats] = useState({ listeners: 0, activeRooms: 0, friends: 0 });
  const [startingRoomId, setStartingRoomId] = useState<string | null>(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [loading, pulseAnim]);

  const SkeletonItem = ({ style }: { style: any }) => (
    <Animated.View style={[style, { opacity: pulseAnim, backgroundColor: '#1A1A1A' }]} />
  );

  const HomeSkeleton = () => (
    <ScrollView style={dynamicStyles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={dynamicStyles.welcomeSection}>
        <View>
          <SkeletonItem style={{ width: 150, height: 28, borderRadius: 8, marginBottom: 8 }} />
          <SkeletonItem style={{ width: 200, height: 14, borderRadius: 4 }} />
        </View>
        <SkeletonItem style={{ width: 44, height: 44, borderRadius: 22 }} />
      </View>

      <View style={dynamicStyles.quickCardRow}>
        {[1, 2, 3].map(i => (
          <SkeletonItem key={i} style={[dynamicStyles.gridCard, { borderWidth: 0 }]} />
        ))}
      </View>

      <View style={dynamicStyles.section}>
        <SkeletonItem style={[dynamicStyles.spotlightCard, { borderWidth: 0 }]} />
      </View>

      <View style={dynamicStyles.section}>
        <View style={dynamicStyles.sectionHeader}>
          <SkeletonItem style={{ width: 120, height: 20, borderRadius: 6 }} />
        </View>
        {[1, 2].map(i => (
          <SkeletonItem key={i} style={[dynamicStyles.roomPreview, { height: 120, borderWidth: 0, marginBottom: 12 }]} />
        ))}
      </View>
    </ScrollView>
  );

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
    <View style={[dynamicStyles.container, { backgroundColor: theme.background }]}>
      {loading ? <HomeSkeleton /> : (
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => loadData(true)} 
            tintColor={accentColor}
            colors={[accentColor]}
            progressBackgroundColor={theme.surface}
          />
        }
      >
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* Welcome */}
        <View style={dynamicStyles.welcomeSection}>
          <View>
            <Text style={[dynamicStyles.greeting, { color: theme.text }]}>
              Hey, {auth.user?.name?.split(' ')[0] || 'there'}{' '}
              <MaterialCommunityIcons name="hand-wave" size={28} color="#FFB74D" />
            </Text>
            <Text style={[dynamicStyles.subtitle, { color: theme.textSecondary }]}>Connect and listen with friends</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile', { screen: 'ProfileMain' })} style={dynamicStyles.profileBtn}>
            {auth.user?.profile_pic || auth.user?.avatar ? (
              <Image source={{ uri: auth.user.profile_pic || auth.user.avatar }} style={dynamicStyles.headerAvatar} />
            ) : (
              <View style={dynamicStyles.headerAvatarPlaceholder}>
                <MaterialCommunityIcons name="account" size={24} color="#1DB954" />
              </View>
            )}
          </TouchableOpacity>
        </View>



        {/* Quick Actions Compact Row (No Scroll) */}
        <View style={dynamicStyles.quickCardRow}>
          {/* Public Rooms */}
          <TouchableOpacity 
            style={[dynamicStyles.gridCard, { backgroundColor: '#1DB95410' }]} 
            onPress={() => showToast('Music Rooms coming soon!', 'info')} 
            activeOpacity={0.8}
          >
            <View style={[dynamicStyles.gridBlob, { backgroundColor: '#1DB95415' }]} />
            <View style={dynamicStyles.gridIconBubble}>
              <MaterialCommunityIcons name="broadcast" size={20} color="#1DB954" />
            </View>
            <Text style={dynamicStyles.gridTitle} numberOfLines={1}>Rooms</Text>
            <View style={[dynamicStyles.gridDot, { backgroundColor: '#1DB95440' }]} />
          </TouchableOpacity>

          {/* NGL Anonymous Notes */}
          <TouchableOpacity 
            style={[dynamicStyles.gridCard, { backgroundColor: isDarkMode ? '#100E1D' : '#F4E8FF' }]} 
            onPress={() => navigation.navigate('Profile', { screen: 'Ngl' })} 
            activeOpacity={0.8}
          >
            <View style={[dynamicStyles.gridBlob, { backgroundColor: '#BB86FC15' }]} />
            <View style={dynamicStyles.gridIconBubble}>
              <MaterialCommunityIcons name="incognito" size={20} color="#BB86FC" />
            </View>
            <Text style={dynamicStyles.gridTitle} numberOfLines={1}>Anonymous</Text>
            <View style={[dynamicStyles.gridDot, { backgroundColor: '#BB86FC40' }]} />
          </TouchableOpacity>

          {/* Global Alarms */}
          <TouchableOpacity 
            style={[dynamicStyles.gridCard, { backgroundColor: isDarkMode ? '#1A1208' : '#FFF3E0' }]} 
            onPress={() => navigation.navigate('Alarms')} 
            activeOpacity={0.8}
          >
            <View style={[dynamicStyles.gridBlob, { backgroundColor: '#FFB74D15' }]} />
            <View style={dynamicStyles.gridIconBubble}>
              <MaterialCommunityIcons name="alarm" size={20} color="#FFB74D" />
            </View>
            <Text style={dynamicStyles.gridTitle} numberOfLines={1}>Alarms</Text>
            <View style={[dynamicStyles.gridDot, { backgroundColor: '#FFB74D40' }]} />
          </TouchableOpacity>
        </View>

        {/* Spotlight Card: Anonymous Messages */}
        <View style={dynamicStyles.section}>
          <TouchableOpacity 
            style={[dynamicStyles.spotlightCard, { borderColor: '#BB86FC30', shadowColor: '#BB86FC' }]} 
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Profile', { screen: 'Ngl' })} 
          >
            <View style={[dynamicStyles.spotlightBlob, { backgroundColor: '#BB86FC' }]} />
            <View style={dynamicStyles.spotlightContent}>
              <View style={[dynamicStyles.liveBadge, { borderColor: '#BB86FC40' }]}>
                <View style={[dynamicStyles.liveBeam, { backgroundColor: '#BB86FC' }]} />
                <Text style={[dynamicStyles.liveBadgeText, { color: '#BB86FC' }]}>TRENDING NOW</Text>
              </View>
              <Text style={dynamicStyles.spotlightTitle}>Get Anonymous {'\n'}Messages</Text>
              <Text style={dynamicStyles.spotlightDesc}>Share your unique link and receive honest, anonymous messages from your friends.</Text>
              <View style={dynamicStyles.spotlightFooter}>
                <View style={dynamicStyles.avatarGroup}>
                  <MaterialCommunityIcons name="incognito" size={16} color="#BB86FC" />
                  <Text style={[dynamicStyles.avatarGroupText, { color: '#BB86FC' }]}>Start receiving notes</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>


        {/* Active Rooms */}
        {/*
        <View style={dynamicStyles.section}>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}><MaterialCommunityIcons name="fire" size={20} color="#FF7043" /> Active Rooms</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Rooms')}>
              <Text style={dynamicStyles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>


          {publicRooms.length === 0 ? (
            <View style={dynamicStyles.emptyCard}>
              <MaterialCommunityIcons name="music-off" size={32} color="#333" />
              <Text style={dynamicStyles.emptyText}>No active rooms</Text>
              <TouchableOpacity style={dynamicStyles.createRoomBtn} onPress={() => navigation.navigate('Rooms')}>
                <Text style={dynamicStyles.createRoomText}>Create one!</Text>
              </TouchableOpacity>
            </View>
          ) : (
            publicRooms.map((room, i) => {
              const isHost = (room.host?._id === auth.user?._id || room.host === auth.user?._id);
              return (
              <View
                key={room._id || i}
                style={dynamicStyles.roomPreview}
              >
                <View style={dynamicStyles.roomPreviewHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={dynamicStyles.roomPreviewName} numberOfLines={1}>{room.name}</Text>
                    <View style={dynamicStyles.roomPreviewStats}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MaterialCommunityIcons name="account-group" size={12} color="#888" />
                        <Text style={dynamicStyles.roomPreviewMeta}>{room.members?.length || 0} listening</Text>
                      </View>

                      {room.status === 'online' ? (
                        <View style={[dynamicStyles.liveIndicatorMini, { backgroundColor: '#1DB95415', borderColor: '#1DB95430', borderWidth: 1 }]}>
                          <View style={[dynamicStyles.liveDotMini, { backgroundColor: '#1DB954' }]} />
                          <Text style={[dynamicStyles.liveTextMini, { color: '#1DB954' }]}>ONLINE</Text>
                        </View>
                      ) : (
                        <View style={[dynamicStyles.liveIndicatorMini, { backgroundColor: '#44415', borderColor: '#44430', borderWidth: 1 }]}>
                          <View style={[dynamicStyles.liveDotMini, { backgroundColor: '#888' }]} />
                          <Text style={[dynamicStyles.liveTextMini, { color: '#888' }]}>OFFLINE</Text>
                        </View>
                      )}

                      {room.isPublic ? (
                        <View style={[dynamicStyles.liveIndicatorMini, { backgroundColor: '#BB86FC15' }]}>
                          <MaterialCommunityIcons name="earth" size={10} color="#BB86FC" />
                          <Text style={[dynamicStyles.liveTextMini, { color: '#BB86FC' }]}>PUBLIC</Text>
                        </View>
                      ) : (
                        <View style={[dynamicStyles.liveIndicatorMini, { backgroundColor: '#FFB74D15' }]}>
                          <MaterialCommunityIcons name="lock" size={10} color="#FFB74D" />
                          <Text style={[dynamicStyles.liveTextMini, { color: '#FFB74D' }]}>PRIVATE</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={dynamicStyles.roomPreviewCodeBadge}>
                    <Text style={dynamicStyles.roomPreviewCode}>#{room.roomCode}</Text>
                  </View>
                </View>
                
                {room.currentTrack?.title ? (
                  <View style={dynamicStyles.roomPreviewTrackContainer}>
                    <MaterialCommunityIcons name="music-note" size={14} color="#1DB954" />
                    <Text style={dynamicStyles.roomPreviewTrack} numberOfLines={1}>{room.currentTrack.title}</Text>
                  </View>
                ) : null}

                <View style={dynamicStyles.roomActionRow}>
                  {isHost && room.status === 'offline' ? (
                    <TouchableOpacity 
                      style={dynamicStyles.startRoomCardBtn}
                      onPress={() => {
                        if (activeRoomCode && activeRoomCode !== room.roomCode) {
                          showToast('Please leave your current room first', 'warning');
                          return;
                        }
                        setStartingRoomId(room._id);
                        setTimeout(() => {
                          setStartingRoomId(null);
                          navigation.navigate('Room', { room, isAnonymous: false, isHost: true });
                        }, 1500);
                      }}
                      disabled={startingRoomId === room._id}
                    >
                      {startingRoomId === room._id ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="play-circle" size={16} color="#000" />
                          <Text style={dynamicStyles.startRoomCardText}>START ROOM SESSION</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : room.status === 'online' ? (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {isHost ? (
                        <>
                          <TouchableOpacity 
                            style={[dynamicStyles.joinRoomCardBtn, { flex: 3 }]}
                            onPress={() => navigation.navigate('Room', { room, isAnonymous: false, isHost: true })}
                          >
                            <MaterialCommunityIcons name="arrow-right-box" size={16} color="#FFF" />
                            <Text style={dynamicStyles.joinRoomCardText}>ENTER ROOM</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[dynamicStyles.joinRoomCardBtn, { flex: 1, backgroundColor: '#FF525215', borderColor: '#FF525240' }]}
                            onPress={() => {
                              // Trigger leave logic which closes the room for host
                              leaveRoom(); 
                              showToast('Closing session...', 'info');
                            }}
                          >
                            <MaterialCommunityIcons name="power" size={16} color="#FF5252" />
                          </TouchableOpacity>
                        </>
                      ) : activeRoomCode === room.roomCode ? (
                        <>
                          <TouchableOpacity 
                            style={[dynamicStyles.joinRoomCardBtn, { flex: 3 }]}
                            onPress={() => navigation.navigate('Room', { room, isAnonymous: false, isHost: false })}
                          >
                            <MaterialCommunityIcons name="login-variant" size={16} color="#FFF" />
                            <Text style={dynamicStyles.joinRoomCardText}>ENTER ROOM</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[dynamicStyles.joinRoomCardBtn, { flex: 1, backgroundColor: '#FF525215', borderColor: '#FF525240' }]}
                            onPress={() => leaveRoom()}
                          >
                            <MaterialCommunityIcons name="logout" size={16} color="#FF5252" />
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity 
                          style={[dynamicStyles.joinRoomCardBtn, { flex: 1 }]}
                          onPress={() => {
                            if (activeRoomCode && activeRoomCode !== room.roomCode) {
                              showToast('Please leave your current room first', 'warning');
                              return;
                            }
                            navigation.navigate('Room', { room, isAnonymous: false, isHost });
                          }}
                        >
                          <MaterialCommunityIcons name="login-variant" size={16} color="#FFF" />
                          <Text style={dynamicStyles.joinRoomCardText}>JOIN SYNC</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View style={dynamicStyles.offlineStatusFull}>
                      <MaterialCommunityIcons name="clock-outline" size={14} color="#666" />
                      <Text style={dynamicStyles.offlineStatusText}>Waiting for host to start...</Text>
                    </View>
                  )}
                </View>
              </View>
              );
            })
          )}
        </View>
        */
        }

        {/* Upcoming Alarms */}
        <View style={dynamicStyles.section}>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}><MaterialCommunityIcons name="alarm" size={20} color="#FFB74D" /> Upcoming Alarms</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Alarms')}>
              <Text style={dynamicStyles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {upcomingAlarms.length > 0 ? (
            upcomingAlarms.map((alarm, i) => (
              <View key={alarm._id || i} style={dynamicStyles.alarmPreview}>
                <MaterialCommunityIcons name="alarm" size={20} color="#FFB74D" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={dynamicStyles.alarmPreviewTitle}>{alarm.title}</Text>
                  {alarm.message ? <Text style={dynamicStyles.alarmPreviewMsg} numberOfLines={1}>{alarm.message}</Text> : null}
                </View>
                <AlarmCountdown 
                  triggerAt={alarm.triggerAt} 
                  isPast={new Date(alarm.triggerAt) < new Date()} 
                  color="#FFB74D" 
                  style={dynamicStyles.alarmPreviewTime} 
                />
              </View>
            ))
          ) : (
            <View style={[dynamicStyles.emptyCard, { paddingVertical: 45, borderStyle: 'solid' }]}>
               <MaterialCommunityIcons name="alarm-off" size={24} color="#333" />
               <Text style={[dynamicStyles.emptyText, { fontSize: 12, marginTop: 12 }]}>No alarms scheduled. Start your day with music! 🎵</Text>
            </View>
          )}
        </View>

        {/* Global Trending Section */}
        <View style={dynamicStyles.section}>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}><MaterialCommunityIcons name="trending-up" size={20} color="#BB86FC" /> Around the World</Text>
          </View>
          <View style={dynamicStyles.trendingRow}>
            <View style={dynamicStyles.trendingCard}>
              <View style={[dynamicStyles.trendingIcon, { backgroundColor: '#1DB95420' }]}>
                <MaterialCommunityIcons name="headphones" size={20} color="#1DB954" />
              </View>
              <Text style={dynamicStyles.trendingVal}>{globalStats.listeners > 1000 ? `${(globalStats.listeners / 1000).toFixed(1)}k` : globalStats.listeners}</Text>
              <Text style={dynamicStyles.trendingLabel} numberOfLines={1}>Listeners</Text>
            </View>
            
            <View style={dynamicStyles.trendingCard}>
              <View style={[dynamicStyles.trendingIcon, { backgroundColor: '#BB86FC20' }]}>
                <MaterialCommunityIcons name="playlist-music" size={20} color="#BB86FC" />
              </View>
              <Text style={dynamicStyles.trendingVal}>{globalStats.activeRooms}</Text>
              <Text style={dynamicStyles.trendingLabel} numberOfLines={1}>Rooms</Text>
            </View>

            <View style={dynamicStyles.trendingCard}>
              <View style={[dynamicStyles.trendingIcon, { backgroundColor: '#64B5F620' }]}>
                <MaterialCommunityIcons name="account-group" size={20} color="#64B5F6" />
              </View>
              <Text style={dynamicStyles.trendingVal}>{globalStats.friends}</Text>
              <Text style={dynamicStyles.trendingLabel} numberOfLines={1}>{auth.token ? 'Friends' : 'Users'}</Text>
            </View>
          </View>
        </View>


        {/* App Feature Spotlight (Showpiece) */}
        <View style={dynamicStyles.section}>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}><MaterialCommunityIcons name="star-face" size={20} color="#FFB74D" /> Featured In App</Text>
          </View>
          <View style={dynamicStyles.pulseGrid}>
            {[
              { name: 'Sync Rooms', color: '#1DB954', icon: 'broadcast' },
              { name: 'AI Alarms', color: '#64B5F6', icon: 'alarm-panel' },
              { name: 'Anon Vibes', color: '#BB86FC', icon: 'incognito' },
              { name: 'Social Chat', color: '#FF7043', icon: 'chat-processing' }
            ].map((p, i) => (
              <View key={i} style={[dynamicStyles.pulseCard, { borderColor: p.color + '25' }]}>
                <View style={[dynamicStyles.pulseIconWrap, { backgroundColor: p.color + '10' }]}>
                  <MaterialCommunityIcons name={p.icon as any} size={20} color={p.color} />
                </View>
                <Text style={[dynamicStyles.pulseName, { color: p.color }]}>{p.name}</Text>
                <View style={[dynamicStyles.pulseDot, { backgroundColor: p.color }]} />
              </View>
            ))}
          </View>
        </View>



      </Animated.View>
    </ScrollView>
      )}
    </View>
  );
}


const getStyles = (theme: any, accentColor: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  // Welcome
  welcomeSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  greeting: { color: theme.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: theme.textSecondary, fontSize: 14, marginTop: 4 },
  profileBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    overflow: 'hidden', 
    borderWidth: 1.5, 
    borderColor: accentColor,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
    shadowColor: accentColor,
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
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.border,
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
    color: theme.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  gridDesc: {
    color: theme.textSecondary,
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
  sectionTitle: { color: theme.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  seeAll: { color: accentColor, fontSize: 13, fontWeight: '700' },
  // Room preview
  roomPreview: { 
    backgroundColor: theme.card, 
    borderRadius: 16, 
    padding: 18, 
    marginBottom: 12, 
    borderWidth: 1.5, 
    borderColor: theme.border,
  },
  roomPreviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  roomPreviewName: { color: theme.text, fontSize: 16, fontWeight: '700', flex: 1 },
  roomPreviewStats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomPreviewMeta: { color: theme.textSecondary, fontSize: 11, fontWeight: '500' },
  liveIndicatorMini: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#1DB95410', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  liveDotMini: { width: 4, height: 4, borderRadius: 2, backgroundColor: accentColor },
  liveTextMini: { color: accentColor, fontSize: 8, fontWeight: '900' },
  roomPreviewCodeBadge: { backgroundColor: theme.surfaceDarker, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roomPreviewCode: { color: accentColor, fontSize: 9, fontWeight: '800' },
  roomPreviewTrackContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.background, padding: 8, borderRadius: 8, gap: 6, borderWidth: 1, borderColor: theme.border },
  roomPreviewTrack: { color: accentColor, fontSize: 12, fontWeight: '500', flex: 1 },
  // Empty
  emptyCard: { 
    alignItems: 'center', 
    paddingVertical: 40, 
    backgroundColor: theme.surfaceDarker, 
    borderRadius: 24, 
    borderWidth: 1.5, 
    borderColor: theme.border,
    borderStyle: 'dashed'
  },
  emptyText: { color: theme.border, marginTop: 12, fontSize: 14 },
  createRoomBtn: { backgroundColor: accentColor, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24, marginTop: 16 },
  createRoomText: { color: theme.background, fontWeight: '800', fontSize: 15 },
  // Alarm preview
  alarmPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: theme.border },
  alarmPreviewTitle: { color: theme.text, fontSize: 14, fontWeight: '600' },
  alarmPreviewMsg: { color: theme.textSecondary, fontSize: 12, marginTop: 2 },
  alarmPreviewTime: { color: '#FFB74D', fontSize: 12, fontWeight: '600' },
  cardPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: accentColor,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: accentColor,
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
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: 1.5,
    borderTopColor: theme.border,
    justifyContent: 'space-between'
  },
  miniInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  miniDisc: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' },
  miniTitle: { color: theme.text, fontSize: 13, fontWeight: '700' },
  miniArtist: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
  miniPlayBtn: { padding: 4 },
  miniLeaveBtn: { padding: 8, marginLeft: 4, borderLeftWidth: 1, borderLeftColor: theme.border },
  // Trending
  trendingRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
  },
  trendingCard: { 
    flex: 1,
    backgroundColor: theme.card, 
    borderRadius: 20, 
    padding: 12, 
    borderWidth: 1.5, 
    borderColor: theme.border,
    alignItems: 'center',
    gap: 6
  },
  trendingIcon: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  trendingVal: { color: theme.text, fontSize: 16, fontWeight: '800' },
  trendingLabel: { color: theme.textSecondary, fontSize: 10, fontWeight: '600' },
  // Spotlight
  spotlightCard: { 
    height: 180, 
    borderRadius: 32, 
    backgroundColor: theme.surface, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: '#1DB95430',
    shadowColor: accentColor,
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
    backgroundColor: accentColor, 
    opacity: 0.1 
  },
  spotlightContent: { flex: 1, padding: 20, justifyContent: 'space-between' },
  liveBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    alignSelf: 'flex-start',
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)' 
  },
  liveBeam: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: accentColor },
  liveBadgeText: { color: theme.text, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  spotlightTitle: { color: theme.text, fontSize: 24, fontWeight: '900', lineHeight: 28 },
  spotlightDesc: { color: theme.textSecondary, fontSize: 12, lineHeight: 18 },
  spotlightFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatarGroup: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.border, borderWidth: 1.5 },
  avatarGroupText: { color: theme.textSecondary, fontSize: 10, marginLeft: 8, fontWeight: '600' },
  joinSpotlightBtn: { backgroundColor: accentColor, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  joinSpotlightText: { color: theme.background, fontSize: 13, fontWeight: '800' },
  // Pulse
  pulseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  pulseCard: { 
    width: (SCREEN_WIDTH - 42) / 2, 
    backgroundColor: theme.surface, 
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
  startRoomCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: accentColor,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: accentColor,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5
  },
  startRoomCardText: {
    color: theme.background,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1
  },
  roomActionRow: { 
    marginTop: 15, 
    borderTopWidth: 1, 
    borderTopColor: theme.surfaceDarker, 
    paddingTop: 12,
  },
  joinRoomCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.surfaceDarker,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border
  },
  joinRoomCardText: { color: theme.text, fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  offlineStatusFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  offlineStatusText: { color: theme.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});
