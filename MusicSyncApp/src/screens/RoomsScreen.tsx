import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  Modal, ActivityIndicator, ScrollView, Alert, Share, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useToast } from '../context/ToastContext';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import API_URL from '../utils/api';
import { usePlayer } from '../context/PlayerContext';

type Props = { navigation: any };

export default function RoomsScreen({ navigation }: Props) {
  const { theme, accentColor } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);

  const auth = useContext(AuthContext);
  const { showToast } = useToast();
  const { currentTrack, isPlaying, togglePlayback, activeRoomCode, leaveRoom } = usePlayer();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [activeTab, setActiveTab] = useState<'active'|'my_rooms'>('active');
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPublic, setNewRoomPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);

  const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : {};

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${API_URL}/api/rooms/public`;
      const resp = await axios.get(url, { headers });
      setRooms(resp.data || []);
    } catch (err) {
      console.warn('Failed to load rooms', err);
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    loadRooms();
    const unsubscribe = navigation.addListener('focus', loadRooms);
    return unsubscribe;
  }, [navigation, loadRooms]);

  const joinByCode = async () => {
    if (!joinCode.trim()) return;
    try {
      const resp = await axios.get(`${API_URL}/api/rooms/code/${joinCode.trim().toUpperCase()}`, { headers });
      if (resp.data) {
        const isHost = (resp.data.host?._id === auth.user?._id || resp.data.host === auth.user?._id);
        if (resp.data.status === 'offline' && !isHost) {
          showToast('Room has not been started by the host yet.', 'warning');
          return;
        }
        navigation.navigate('Room', { room: resp.data, isAnonymous: false, isHost });
      }
    } catch (err: any) {
      showToast('No room found with that code', 'error');
    }
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) {
      showToast('Please enter a room name', 'warning');
      return;
    }
    setCreating(true);
    try {
      const resp = await axios.post(`${API_URL}/api/rooms`, {
        name: newRoomName.trim(),
        isPublic: newRoomPublic,
      }, { headers });
      setShowCreate(false);
      setNewRoomName('');
      navigation.navigate('Room', { room: resp.data, isAnonymous: false, isHost: true });
    } catch (err: any) {
      showToast('Failed to create room', 'error');
    } finally {
      setCreating(false);
    }
  };

  const deleteRoom = async (roomId: string) => {
    setRoomToDelete(roomId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!roomToDelete) return;
    try {
      await axios.delete(`${API_URL}/api/rooms/${roomToDelete}`, { headers });
      showToast('Room deleted successfully', 'success');
      loadRooms();
    } catch (err) {
      showToast('Failed to delete room', 'error');
    } finally {
      setShowDeleteConfirm(false);
      setRoomToDelete(null);
    }
  };

  const shareRoomLink = (roomCode: string) => {
    const link = `https://syncognito-nine.vercel.app/join/${roomCode}`;
    Clipboard.setString(link);
    Share.share({
      message: `Join this music room on Syncognito! 🎵\nRoom Code: #${roomCode}\n\nJoin here: ${link}`,
      url: link
    }).catch(() => {
      showToast('Invite link copied!', 'success');
    });
  };


  const renderRoom = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={dynamicStyles.roomCard}
        onPress={() => {
          const isHost = (item.host?._id === auth.user?._id || item.host === auth.user?._id);
          if (item.status === 'offline' && !isHost) {
            showToast('Room has not been started by the host yet.', 'warning');
            return;
          }
          navigation.navigate('Room', { room: item, isAnonymous: false, isHost });
        }}
        activeOpacity={0.7}
      >
        <View style={dynamicStyles.roomHeader}>
          <View style={{ flex: 1 }}>
            <Text style={dynamicStyles.roomName} numberOfLines={1}>{item.name}</Text>
            <View style={dynamicStyles.roomStats}>
              <MaterialCommunityIcons name="account-group" size={12} color="#888" />
              <Text style={dynamicStyles.roomMeta}>{item.members?.length || 0} listening</Text>
              {item.isPublic ? (
                <View style={[dynamicStyles.liveIndicatorMini, { backgroundColor: '#1DB95415' }]}>
                  <MaterialCommunityIcons name="earth" size={10} color="#1DB954" />
                  <Text style={[dynamicStyles.liveTextMini, { color: '#1DB954' }]}>PUBLIC</Text>
                </View>
              ) : (
                <View style={[dynamicStyles.liveIndicatorMini, { backgroundColor: '#FFB74D15' }]}>
                  <MaterialCommunityIcons name="lock" size={10} color="#FFB74D" />
                  <Text style={[dynamicStyles.liveTextMini, { color: '#FFB74D' }]}>PRIVATE</Text>
                </View>
              )}
              {item.currentTrack?.isPlaying && (
                <View style={dynamicStyles.liveIndicatorMini}>
                  <View style={dynamicStyles.liveDotMini} />
                  <Text style={dynamicStyles.liveTextMini}>LIVE</Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {activeRoomCode === item.roomCode && currentTrack.url && (
              <TouchableOpacity 
                style={dynamicStyles.cardPlayBtn} 
                onPress={(e) => { e.stopPropagation(); togglePlayback(); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name={isPlaying ? 'pause' : 'play'} size={18} color="#000" />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={dynamicStyles.roomCodeBadge}
              onPress={(e) => { e.stopPropagation(); shareRoomLink(item.roomCode); }}
            >
              <MaterialCommunityIcons name="export-variant" size={12} color="#1DB954" style={{ marginRight: 4 }} />
              <Text style={dynamicStyles.roomCodeText}>#{item.roomCode}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {item.currentTrack?.title ? (
          <View style={dynamicStyles.trackContainer}>
            <MaterialCommunityIcons name="music-note" size={14} color="#1DB954" />
            <Text style={dynamicStyles.trackText} numberOfLines={1}>{item.currentTrack.title}</Text>
          </View>
        ) : null}

        <View style={dynamicStyles.roomMetaRow}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={dynamicStyles.hostNameText} numberOfLines={1}>
              Host: {item.host?.name || (item.host === auth.user?._id ? auth.user?.name : 'Unknown')}
            </Text>
            {(item.host?._id === auth.user?._id || item.host === auth.user?._id) && (
              <View style={dynamicStyles.youBadge}>
                <Text style={dynamicStyles.youBadgeText}>YOU</Text>
              </View>
            )}
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {(item.host?._id === auth.user?._id || item.host === auth.user?._id) && (
              <TouchableOpacity 
                onPress={(e) => { e.stopPropagation(); deleteRoom(item._id); }}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <MaterialCommunityIcons name="delete-outline" size={20} color="#EF5350" />
              </TouchableOpacity>
            )}
            <View style={dynamicStyles.joinAction}>
              <Text style={dynamicStyles.joinActionText}>Join</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#1DB954" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={dynamicStyles.container}>
      {/* Header */}
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}><MaterialCommunityIcons name="music-note" size={26} color="#1DB954" /> Rooms</Text>
        <TouchableOpacity style={dynamicStyles.createBtn} onPress={() => setShowCreate(true)}>
          <MaterialCommunityIcons name="plus-circle" size={28} color="#1DB954" />
        </TouchableOpacity>
      </View>

      {/* Join by code */}
      <View style={dynamicStyles.joinRow}>
        <TextInput
          style={dynamicStyles.joinInput}
          value={joinCode}
          onChangeText={setJoinCode}
          placeholder="Enter room code..."
          placeholderTextColor="#555"
          autoCapitalize="characters"
          maxLength={6}
        />
        <TouchableOpacity style={dynamicStyles.joinBtn} onPress={joinByCode}>
          <Text style={dynamicStyles.joinBtnText}>Join</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[dynamicStyles.joinBtn, dynamicStyles.anonBtn]}
          onPress={() => {
            if (!joinCode.trim()) return showToast('Enter a room code first', 'warning');
            axios.get(`${API_URL}/api/rooms/code/${joinCode.trim().toUpperCase()}`, { headers })
              .then(resp => {
                if (resp.data) {
                  const isHost = (resp.data.host?._id === auth.user?._id || resp.data.host === auth.user?._id);
                  if (resp.data.status === 'offline' && !isHost) {
                    showToast('Room has not been started by the host yet.', 'warning');
                    return;
                  }
                  navigation.navigate('Room', { room: resp.data, isAnonymous: true, isHost });
                }
              })
              .catch(() => showToast('No room with that code', 'error'));
          }}
        >
          <MaterialCommunityIcons name="incognito" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={dynamicStyles.tabContainer}>
        <TouchableOpacity 
          style={[dynamicStyles.tabBtn, activeTab === 'active' && dynamicStyles.tabBtnActive]} 
          onPress={() => setActiveTab('active')}
        >
          <Text style={[dynamicStyles.tabText, activeTab === 'active' && dynamicStyles.tabTextActive]}>Active Rooms</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[dynamicStyles.tabBtn, activeTab === 'my_rooms' && dynamicStyles.tabBtnActive]} 
          onPress={() => setActiveTab('my_rooms')}
        >
          <Text style={[dynamicStyles.tabText, activeTab === 'my_rooms' && dynamicStyles.tabTextActive]}>My Rooms</Text>
        </TouchableOpacity>
      </View>

      {/* Room list */}
      {loading ? (
        <ActivityIndicator size="large" color="#1DB954" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rooms.filter(r => {
            if (activeTab === 'active') return r.status === 'online' && r.isPublic;
            return r.host?._id === auth.user?._id || r.host === auth.user?._id;
          })}
          keyExtractor={item => item._id || item.roomCode}
          renderItem={renderRoom}
          contentContainerStyle={dynamicStyles.list}
          ListEmptyComponent={
            <View style={dynamicStyles.empty}>
              <MaterialCommunityIcons name="music-off" size={48} color="#333" />
              <Text style={dynamicStyles.emptyText}>No rooms found</Text>
              <Text style={dynamicStyles.emptySubtext}>Create one or join via room code!</Text>
            </View>
          }
          onRefresh={loadRooms}
          refreshing={loading}
        />
      )}

      {/* Create Room Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => { setShowCreate(false); Keyboard.dismiss(); }}>
          <View style={dynamicStyles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={dynamicStyles.modalContent}>
                <Text style={dynamicStyles.modalTitle}>Create a Room</Text>

            <TextInput
              style={dynamicStyles.modalInput}
              value={newRoomName}
              onChangeText={setNewRoomName}
              placeholder="Room name..."
              placeholderTextColor="#555"
              maxLength={40}
            />

            {/* Public/Private toggle */}
            <View style={dynamicStyles.toggleRow}>
              <Text style={dynamicStyles.toggleLabel}>Visibility:</Text>
              <TouchableOpacity
                style={[dynamicStyles.toggleBtn, newRoomPublic && dynamicStyles.toggleActive]}
                onPress={() => setNewRoomPublic(true)}
              >
                <MaterialCommunityIcons name="earth" size={16} color={newRoomPublic ? '#fff' : '#888'} />
                <Text style={[dynamicStyles.toggleText, newRoomPublic && dynamicStyles.toggleTextActive]}>Public</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.toggleBtn, !newRoomPublic && dynamicStyles.toggleActive]}
                onPress={() => setNewRoomPublic(false)}
              >
                <MaterialCommunityIcons name="lock" size={16} color={!newRoomPublic ? '#fff' : '#888'} />
                <Text style={[dynamicStyles.toggleText, !newRoomPublic && dynamicStyles.toggleTextActive]}>Private</Text>
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity style={dynamicStyles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={dynamicStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.confirmBtn} onPress={createRoom} disabled={creating}>
                {creating ? <ActivityIndicator color="#000" /> : <Text style={dynamicStyles.confirmText}>Create</Text>}
              </TouchableOpacity>
            </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Custom Delete Confirmation Modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <View style={[dynamicStyles.modalOverlay, { justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.85)' }]}>
          <View style={[dynamicStyles.modalContent, dynamicStyles.deleteModalContent]}>
            <View style={dynamicStyles.deleteIconContainer}>
              <MaterialCommunityIcons name="trash-can-outline" size={40} color="#EF5350" />
            </View>
            <Text style={dynamicStyles.modalTitle}>Delete Room?</Text>
            <Text style={dynamicStyles.deleteSubtext}>
              This will permanently remove the room and all its chat history. This action cannot be undone.
            </Text>

            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity 
                style={dynamicStyles.cancelBtn} 
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setRoomToDelete(null);
                }}
              >
                <Text style={dynamicStyles.cancelText}>Keep it</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[dynamicStyles.confirmBtn, { backgroundColor: '#EF5350' }]} 
                onPress={confirmDelete}
              >
                <Text style={[dynamicStyles.confirmText, { color: '#fff' }]}>Yes, Delete</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  title: { color: theme.text, fontSize: 26, fontWeight: '800' },
  createBtn: { padding: 4 },
  joinRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 10, height: 40 },
  joinInput: { flex: 1, backgroundColor: '#18181A', color: theme.text, paddingHorizontal: 16, borderRadius: 14, fontSize: 14, letterSpacing: 1.5, borderWidth: 1, borderColor: theme.border },
  joinBtn: { backgroundColor: accentColor, paddingHorizontal: 20, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  joinBtnText: { color: theme.background, fontWeight: '800', fontSize: 13 },
  anonBtn: { backgroundColor: '#7E57C2', width: 40, paddingHorizontal: 0, justifyContent: 'center', alignItems: 'center' },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 14, gap: 8 },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: 'transparent' },
  tabBtnActive: { backgroundColor: accentColor, borderColor: accentColor },
  tabText: { color: theme.textSecondary, fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: theme.background },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  roomCard: { 
    backgroundColor: theme.card, 
    borderRadius: 16, 
    padding: 14, 
    marginBottom: 12, 
    borderWidth: 1.5, 
    borderColor: theme.border,
  },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  roomName: { color: theme.text, fontSize: 16, fontWeight: '700', flex: 1 },
  roomStats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomMeta: { color: theme.textSecondary, fontSize: 11, fontWeight: '500' },
  liveIndicatorMini: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#1DB95410', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  liveDotMini: { width: 4, height: 4, borderRadius: 2, backgroundColor: accentColor },
  liveTextMini: { color: accentColor, fontSize: 8, fontWeight: '900' },
  roomCodeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceDarker, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: theme.border },
  roomCodeText: { color: accentColor, fontSize: 9, fontWeight: '800' },
  trackContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.background, padding: 8, borderRadius: 8, gap: 6, borderWidth: 1, borderColor: theme.border, marginTop: 8 },
  trackText: { color: accentColor, fontSize: 12, fontWeight: '500', flex: 1 },
  roomMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.surfaceDarker },
  hostNameText: { color: '#555', fontSize: 11, fontWeight: '600' },
  youBadge: { backgroundColor: '#1DB95420', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  youBadgeText: { color: accentColor, fontSize: 9, fontWeight: '800' },
  joinAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  joinActionText: { color: accentColor, fontSize: 12, fontWeight: '800' },
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
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#555', fontSize: 16, marginTop: 12 },
  emptySubtext: { color: theme.textSecondary, fontSize: 13, marginTop: 4 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.surfaceDarker, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { color: theme.text, fontSize: 22, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  modalInput: { backgroundColor: '#0F0F0F', color: theme.text, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  toggleLabel: { color: '#AAA', fontSize: 14, marginRight: 8, marginBottom: 8 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: theme.border, gap: 6 },
  toggleActive: { backgroundColor: accentColor, borderColor: accentColor },
  toggleText: { color: theme.textSecondary, fontSize: 13 },
  toggleTextActive: { color: theme.text },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, backgroundColor: theme.border, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelText: { color: theme.text, fontWeight: '600' },
  confirmBtn: { flex: 1, backgroundColor: accentColor, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmText: { color: theme.background, fontWeight: '700', fontSize: 16 },
  // Delete Modal specific
  deleteModalContent: {
    marginHorizontal: 30,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(239, 83, 80, 0.3)',
    backgroundColor: theme.surface,
    paddingVertical: 32,
  },
  deleteIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 83, 80, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  deleteSubtext: {
    color: theme.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
    paddingHorizontal: 10,
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
    borderTopWidth: 1,
    borderTopColor: theme.border,
    justifyContent: 'space-between'
  },
  miniInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  miniDisc: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' },
  miniTitle: { color: theme.text, fontSize: 13, fontWeight: '700' },
  miniArtist: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
  miniPlayBtn: { padding: 4 },
  miniLeaveBtn: { padding: 8, marginLeft: 4, borderLeftWidth: 1, borderLeftColor: theme.border },
});
