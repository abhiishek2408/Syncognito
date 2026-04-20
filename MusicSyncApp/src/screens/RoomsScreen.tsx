import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  Modal, ActivityIndicator, ScrollView, Alert, Share
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
  const auth = useContext(AuthContext);
  const { showToast } = useToast();
  const { currentTrack, isPlaying, togglePlayback, activeRoomCode, leaveRoom } = usePlayer();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
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
        navigation.navigate('Room', { room: resp.data, isAnonymous: false });
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
        style={styles.roomCard}
        onPress={() => navigation.navigate('Room', { room: item, isAnonymous: false })}
        activeOpacity={0.7}
      >
        <View style={styles.roomHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.roomStats}>
              <MaterialCommunityIcons name="account-group" size={12} color="#888" />
              <Text style={styles.roomMeta}>{item.members?.length || 0} listening</Text>
              {item.isPublic ? (
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
              {item.currentTrack?.isPlaying && (
                <View style={styles.liveIndicatorMini}>
                  <View style={styles.liveDotMini} />
                  <Text style={styles.liveTextMini}>LIVE</Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {activeRoomCode === item.roomCode && currentTrack.url && (
              <TouchableOpacity 
                style={styles.cardPlayBtn} 
                onPress={(e) => { e.stopPropagation(); togglePlayback(); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name={isPlaying ? 'pause' : 'play'} size={18} color="#000" />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.roomCodeBadge}
              onPress={(e) => { e.stopPropagation(); shareRoomLink(item.roomCode); }}
            >
              <MaterialCommunityIcons name="export-variant" size={12} color="#1DB954" style={{ marginRight: 4 }} />
              <Text style={styles.roomCodeText}>#{item.roomCode}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {item.currentTrack?.title ? (
          <View style={styles.trackContainer}>
            <MaterialCommunityIcons name="music-note" size={14} color="#1DB954" />
            <Text style={styles.trackText} numberOfLines={1}>{item.currentTrack.title}</Text>
          </View>
        ) : null}

        <View style={styles.roomMetaRow}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.hostNameText} numberOfLines={1}>
              Host: {item.host?.name || (item.host === auth.user?._id ? auth.user?.name : 'Unknown')}
            </Text>
            {(item.host?._id === auth.user?._id || item.host === auth.user?._id) && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>YOU</Text>
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
            <View style={styles.joinAction}>
              <Text style={styles.joinActionText}>Join</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#1DB954" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}><MaterialCommunityIcons name="music-note" size={26} color="#1DB954" /> Rooms</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
          <MaterialCommunityIcons name="plus-circle" size={28} color="#1DB954" />
        </TouchableOpacity>
      </View>

      {/* Join by code */}
      <View style={styles.joinRow}>
        <TextInput
          style={styles.joinInput}
          value={joinCode}
          onChangeText={setJoinCode}
          placeholder="Enter room code..."
          placeholderTextColor="#555"
          autoCapitalize="characters"
          maxLength={6}
        />
        <TouchableOpacity style={styles.joinBtn} onPress={joinByCode}>
          <Text style={styles.joinBtnText}>Join</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.joinBtn, styles.anonBtn]}
          onPress={() => {
            if (!joinCode.trim()) return showToast('Enter a room code first', 'warning');
            axios.get(`${API_URL}/api/rooms/code/${joinCode.trim().toUpperCase()}`, { headers })
              .then(resp => {
                if (resp.data) navigation.navigate('Room', { room: resp.data, isAnonymous: true });
              })
              .catch(() => showToast('No room with that code', 'error'));
          }}
        >
          <MaterialCommunityIcons name="incognito" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Room list */}
      {loading ? (
        <ActivityIndicator size="large" color="#1DB954" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={item => item._id || item.roomCode}
          renderItem={renderRoom}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="music-off" size={48} color="#333" />
              <Text style={styles.emptyText}>No rooms found</Text>
              <Text style={styles.emptySubtext}>Create one or join via room code!</Text>
            </View>
          }
          onRefresh={loadRooms}
          refreshing={loading}
        />
      )}

      {/* Create Room Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create a Room</Text>

            <TextInput
              style={styles.modalInput}
              value={newRoomName}
              onChangeText={setNewRoomName}
              placeholder="Room name..."
              placeholderTextColor="#555"
              maxLength={40}
            />

            {/* Public/Private toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Visibility:</Text>
              <TouchableOpacity
                style={[styles.toggleBtn, newRoomPublic && styles.toggleActive]}
                onPress={() => setNewRoomPublic(true)}
              >
                <MaterialCommunityIcons name="earth" size={16} color={newRoomPublic ? '#fff' : '#888'} />
                <Text style={[styles.toggleText, newRoomPublic && styles.toggleTextActive]}>Public</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, !newRoomPublic && styles.toggleActive]}
                onPress={() => setNewRoomPublic(false)}
              >
                <MaterialCommunityIcons name="lock" size={16} color={!newRoomPublic ? '#fff' : '#888'} />
                <Text style={[styles.toggleText, !newRoomPublic && styles.toggleTextActive]}>Private</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={createRoom} disabled={creating}>
                {creating ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Delete Confirmation Modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <View style={[styles.modalOverlay, { justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.85)' }]}>
          <View style={[styles.modalContent, styles.deleteModalContent]}>
            <View style={styles.deleteIconContainer}>
              <MaterialCommunityIcons name="trash-can-outline" size={40} color="#EF5350" />
            </View>
            <Text style={styles.modalTitle}>Delete Room?</Text>
            <Text style={styles.deleteSubtext}>
              This will permanently remove the room and all its chat history. This action cannot be undone.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setRoomToDelete(null);
                }}
              >
                <Text style={styles.cancelText}>Keep it</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmBtn, { backgroundColor: '#EF5350' }]} 
                onPress={confirmDelete}
              >
                <Text style={[styles.confirmText, { color: '#fff' }]}>Yes, Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  createBtn: { padding: 4 },
  joinRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  joinInput: { flex: 1, backgroundColor: '#1A1A1A', color: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, fontSize: 15, letterSpacing: 2, borderWidth: 1, borderColor: '#2A2A2A' },
  joinBtn: { backgroundColor: '#1DB954', paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  joinBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  anonBtn: { backgroundColor: '#7E57C2', paddingHorizontal: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  roomCard: { 
    backgroundColor: '#0D0D0D', 
    borderRadius: 16, 
    padding: 14, 
    marginBottom: 12, 
    borderWidth: 1.5, 
    borderColor: '#333',
  },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  roomName: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  roomStats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomMeta: { color: '#666', fontSize: 11, fontWeight: '500' },
  liveIndicatorMini: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#1DB95410', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  liveDotMini: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#1DB954' },
  liveTextMini: { color: '#1DB954', fontSize: 8, fontWeight: '900' },
  roomCodeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#333' },
  roomCodeText: { color: '#1DB954', fontSize: 9, fontWeight: '800' },
  trackContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', padding: 8, borderRadius: 8, gap: 6, borderWidth: 1, borderColor: '#151515', marginTop: 8 },
  trackText: { color: '#1DB954', fontSize: 12, fontWeight: '500', flex: 1 },
  roomMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1A1A1A' },
  hostNameText: { color: '#555', fontSize: 11, fontWeight: '600' },
  youBadge: { backgroundColor: '#1DB95420', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  youBadgeText: { color: '#1DB954', fontSize: 9, fontWeight: '800' },
  joinAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  joinActionText: { color: '#1DB954', fontSize: 12, fontWeight: '800' },
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
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#555', fontSize: 16, marginTop: 12 },
  emptySubtext: { color: '#444', fontSize: 13, marginTop: 4 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  modalInput: { backgroundColor: '#0F0F0F', color: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  toggleLabel: { color: '#AAA', fontSize: 14, marginRight: 8, marginBottom: 8 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#333', gap: 6 },
  toggleActive: { backgroundColor: '#1DB954', borderColor: '#1DB954' },
  toggleText: { color: '#888', fontSize: 13 },
  toggleTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, backgroundColor: '#333', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelText: { color: '#fff', fontWeight: '600' },
  confirmBtn: { flex: 1, backgroundColor: '#1DB954', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmText: { color: '#000', fontWeight: '700', fontSize: 16 },
  // Delete Modal specific
  deleteModalContent: {
    marginHorizontal: 30,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(239, 83, 80, 0.3)',
    backgroundColor: '#0A0A0A',
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
    color: '#888',
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
    backgroundColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
    justifyContent: 'space-between'
  },
  miniInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  miniDisc: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  miniTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  miniArtist: { color: '#666', fontSize: 11, marginTop: 2 },
  miniPlayBtn: { padding: 4 },
  miniLeaveBtn: { padding: 8, marginLeft: 4, borderLeftWidth: 1, borderLeftColor: '#222' },
});
