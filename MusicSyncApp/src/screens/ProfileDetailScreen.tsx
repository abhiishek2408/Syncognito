import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, Animated, Dimensions, ActivityIndicator, Alert,
  Modal, TextInput
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import API_URL from '../utils/api';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileDetailScreen({ route, navigation }: any) {
  const { theme, accentColor } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);
  const auth = React.useContext(AuthContext);
  const { showToast } = useToast();

  const { userId, userName } = route.params;
  const [userData, setUserData] = useState<any>(null);
  const [stats, setStats] = useState({ rooms: 0, friends: 0, alarms: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'none' | 'friends' | 'received' | 'sent' | 'me'>('none');
  const [actionLoading, setActionLoading] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  
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

      if (auth.user?._id === userId) {
        setStatus('me');
      } else {
        const [friendsResp, requestsResp] = await Promise.all([
          axios.get(`${API_URL}/api/users/me/friends`, { headers }),
          axios.get(`${API_URL}/api/users/me/requests`, { headers })
        ]);

        const isFriend = friendsResp.data.some((f: any) => (f._id || f.id) === userId);
        const hasReceived = requestsResp.data.received.some((r: any) => (r._id || r.id) === userId);
        const hasSent = requestsResp.data.sent.some((r: any) => (r._id || r.id) === userId);

        if (isFriend) setStatus('friends');
        else if (hasReceived) setStatus('received');
        else if (hasSent) setStatus('sent');
        else setStatus('none');
      }

      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } catch (err) {
      console.warn('Failed to fetch user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFriendAction = async (action: string) => {
    setActionLoading(true);
    const headers = { Authorization: `Bearer ${auth.token}` };
    try {
      if (action === 'send') {
        await axios.post(`${API_URL}/api/users/me/friend-request/${userId}`, {}, { headers });
        setStatus('sent');
        showToast('Friend request sent!', 'success');
      } else if (action === 'accept') {
        await axios.post(`${API_URL}/api/users/me/friend-request/${userId}/accept`, {}, { headers });
        setStatus('friends');
        showToast('Connection accepted!', 'success');
      } else if (action === 'decline' || action === 'cancel') {
        await axios.post(`${API_URL}/api/users/me/friend-request/${userId}/cancel`, {}, { headers });
        setStatus('none');
        showToast('Request updated', 'info');
      } else if (action === 'unfriend') {
        Alert.alert('Unfollow', `Stop following ${userData?.name || userName}?`, [
          { text: 'Cancel', style: 'cancel', onPress: () => setActionLoading(false) },
          { text: 'Unfollow', style: 'destructive', onPress: async () => {
              try {
                setActionLoading(true);
                await axios.delete(`${API_URL}/api/users/me/friend/${userId}`, { headers });
                setStatus('none');
                showToast(`Unfollowed ${userData?.name || userName}`, 'info');
                fetchUserProfile();
              } catch (err) {
                showToast('Failed to unfollow', 'error');
              } finally {
                setActionLoading(false);
              }
          }}
        ]);
        return; 
      }
    } catch (err) {
      showToast('Action failed', 'error');
      console.warn('Friend action failed:', err);
    } finally {
      if (action !== 'unfriend') {
        setActionLoading(false);
        fetchUserProfile(); 
      }
    }
  };

  const handleSaveBio = async () => {
    if (savingBio) return;
    setSavingBio(true);
    try {
      await axios.put(`${API_URL}/api/users/me`, { bio: newBio }, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      setUserData({ ...userData, bio: newBio });
      setIsEditModalVisible(false);
      showToast('Bio updated successfully!', 'success');
    } catch (err) {
      showToast('Failed to update bio', 'error');
    } finally {
      setSavingBio(false);
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
      <ScrollView contentContainerStyle={dynamicStyles.content}>
        <View style={dynamicStyles.appBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={dynamicStyles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={dynamicStyles.appBarTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
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
            
            {status !== 'me' && (
              <View style={dynamicStyles.actionRow}>
                {status === 'none' && (
                  <TouchableOpacity 
                    style={[dynamicStyles.followBtn, { backgroundColor: accentColor }]}
                    onPress={() => handleFriendAction('send')}
                    disabled={actionLoading}
                  >
                    <MaterialCommunityIcons name="account-plus" size={16} color={theme.background} />
                    <Text style={[dynamicStyles.followBtnText, { color: theme.background }]}>FOLLOW</Text>
                  </TouchableOpacity>
                )}
                
                {status === 'received' && (
                  <View style={dynamicStyles.buttonRow}>
                    <TouchableOpacity 
                      style={[dynamicStyles.followBtn, { backgroundColor: '#1DB954' }]}
                      onPress={() => handleFriendAction('accept')}
                      disabled={actionLoading}
                    >
                      <MaterialCommunityIcons name="check" size={16} color="#fff" />
                      <Text style={[dynamicStyles.followBtnText, { color: '#fff' }]}>ACCEPT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[dynamicStyles.followBtn, { backgroundColor: '#EF5350' }]}
                      onPress={() => handleFriendAction('decline')}
                      disabled={actionLoading}
                    >
                      <MaterialCommunityIcons name="close" size={16} color="#fff" />
                      <Text style={[dynamicStyles.followBtnText, { color: '#fff' }]}>DECLINE</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {status === 'sent' && (
                  <TouchableOpacity 
                    style={[dynamicStyles.followBtn, { backgroundColor: theme.surfaceDarker }]}
                    onPress={() => handleFriendAction('cancel')}
                    disabled={actionLoading}
                  >
                    <MaterialCommunityIcons name="clock-outline" size={16} color={theme.textSecondary} />
                    <Text style={[dynamicStyles.followBtnText, { color: theme.textSecondary }]}>CANCEL REQUEST</Text>
                  </TouchableOpacity>
                )}

                {status === 'friends' && (
                  <TouchableOpacity 
                    style={[dynamicStyles.followBtn, { backgroundColor: theme.surface }]}
                    onPress={() => handleFriendAction('unfriend')}
                    disabled={actionLoading}
                  >
                    <MaterialCommunityIcons name="account-check" size={16} color={accentColor} />
                    <Text style={[dynamicStyles.followBtnText, { color: accentColor }]}>FOLLOWED</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={dynamicStyles.sectionTitle}>About</Text>
              {status === 'me' && (
                <TouchableOpacity onPress={() => {
                  setNewBio(userData?.bio || '');
                  setIsEditModalVisible(true);
                }}>
                  <MaterialCommunityIcons name="pencil-outline" size={20} color={accentColor} />
                </TouchableOpacity>
              )}
            </View>
            <View style={dynamicStyles.infoCard}>
               <Text style={dynamicStyles.aboutText}>
                 {userData?.bio || (status === 'me' ? "Tell the world about your music taste..." : "This user hasn't added a bio yet. They love sync listening!")}
               </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Edit Bio Modal */}
      <Modal visible={isEditModalVisible} transparent animationType="slide">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.editModal}>
            <Text style={dynamicStyles.modalTitle}>Edit About Me</Text>
            <TextInput
              style={dynamicStyles.bioInput}
              placeholder="Tell us about yourself..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              value={newBio}
              onChangeText={setNewBio}
              maxLength={200}
            />
            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity 
                style={dynamicStyles.cancelBtn} 
                onPress={() => setIsEditModalVisible(false)}
              >
                <Text style={dynamicStyles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[dynamicStyles.saveBtn, { backgroundColor: accentColor }]} 
                onPress={handleSaveBio}
                disabled={savingBio}
              >
                {savingBio ? (
                  <ActivityIndicator size="small" color={theme.background} />
                ) : (
                  <Text style={[dynamicStyles.saveBtnText, { color: theme.background }]}>SAVE</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  cardSection: { marginHorizontal: 20, marginTop: 15 },
  sectionTitle: { color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 0 },
  infoCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: theme.border },
  aboutText: { color: theme.textSecondary, fontSize: 15, lineHeight: 22 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  editModal: { width: '85%', backgroundColor: theme.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: theme.border },
  modalTitle: { color: theme.text, fontSize: 20, fontWeight: '800', marginBottom: 20 },
  bioInput: { backgroundColor: theme.background, borderRadius: 16, padding: 16, color: theme.text, fontSize: 16, textAlignVertical: 'top', height: 120, borderWidth: 1, borderColor: theme.border, marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: theme.surfaceDarker },
  cancelBtnText: { color: theme.textSecondary, fontWeight: '800' },
  saveBtn: { flex: 2, paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
  saveBtnText: { fontWeight: '900' },

  actionRow: { alignItems: 'center' },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, marginTop: 16, shadowColor: accentColor, shadowOpacity: 0.2, shadowRadius: 5, elevation: 3 },
  followBtnText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
