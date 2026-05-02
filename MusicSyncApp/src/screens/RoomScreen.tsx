import React, { useState, useEffect, useContext, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  Alert, ScrollView, Animated, Dimensions, LogBox, Modal, ActivityIndicator, Share, Platform, PermissionsAndroid
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

// Ignore specific annoying library errors that shouldn't show in Red Box
LogBox.ignoreLogs(['user canceled the document picker']);
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from '@react-native-documents/picker';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getSocket } from '../utils/socket';
import { usePlayer } from '../context/PlayerContext';
import API_URL from '../utils/api';
import axios from 'axios';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = { navigation: any; route: any };

const FloatingEmoji = ({ emoji, x }: { emoji: string, x: number }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT * 0.7, 0],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 1, 1, 0],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 1.5, 1],
  });

  return (
    <Animated.View style={{
      position: 'absolute',
      left: `${x}%`,
      transform: [{ translateY }, { scale }],
      opacity,
    }}>
      <Text style={{ fontSize: 32 }}>{emoji}</Text>
    </Animated.View>
  );
};

export default function RoomScreen({ navigation, route }: Props) {
  const { theme, accentColor } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);

  const params = route?.params || {};
  const { room: initialRoom = {}, isAnonymous = false, isHost: initialIsHost = false } = params;
  
  const auth = useContext(AuthContext);
  const { showToast: _showToast } = useToast();
  const socket = getSocket();

  const { 
    currentTrack, isPlaying, position, duration, activeRoomCode,
    togglePlayback, seek, pickTrack, unloadTrack, joinRoom, setRoomState, leaveRoom 
  } = usePlayer();

  const hasJoinedRef = useRef(false);

  const [isPicking, setIsPicking] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatText, setChatText] = useState('');
  const [activeTab, setActiveTab] = useState<'player' | 'chat' | 'requests' | 'members' | 'queue'>('player');
  const [members, setMembers] = useState<any[]>(initialRoom.members || []);
  const [hostInfo, setHostInfo] = useState({ name: initialRoom.host?.name || '', avatar: initialRoom.host?.avatar || '' });
  const [hasPermission, setHasPermission] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'rejected'>('none');
  const [showExitModal, setShowExitModal] = useState(false);
  const [showNglModal, setShowNglModal] = useState(false);
  const [nglText, setNglText] = useState('');
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [sendingNgl, setSendingNgl] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(initialRoom.theme || 'default');
  const [reactions, setReactions] = useState<any[]>([]);
  const [songQueue, setSongQueue] = useState<any[]>(initialRoom.songQueue || []);
  const [showGuessModal, setShowGuessModal] = useState(false);
  const [selectedSongForGuess, setSelectedSongForGuess] = useState<any>(null);
  const [gameMode, setGameMode] = useState(initialRoom.gameMode || 'none');
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [allowDJAccess, setAllowDJAccess] = useState(initialRoom.allowDJAccess || false);
  const loadingProgress = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  const THEMES: any = {
    default: { primary: '#1DB954', accent: '#1DB95408', bg: '#000', text: '#FFF' },
    neon: { primary: '#FF00FF', accent: '#FF00FF08', bg: '#000', text: '#FFF' },
    ocean: { primary: '#00BFFF', accent: '#00BFFF08', bg: '#000', text: '#FFF' },
    sunset: { primary: '#FF4500', accent: '#FF450008', bg: '#000', text: '#FFF' },
    emerald: { primary: '#50C878', accent: '#50C87808', bg: '#000', text: '#FFF' },
    royal: { primary: '#8A2BE2', accent: '#8A2BE208', bg: '#000', text: '#FFF' },
    gold: { primary: '#FFD700', accent: '#FFD70008', bg: '#000', text: '#FFF' },
    crimson: { primary: '#DC143C', accent: '#DC143C08', bg: '#000', text: '#FFF' },
    bubblegum: { primary: '#FF69B4', accent: '#FF69B408', bg: '#000', text: '#FFF' },
  };
  const roomTheme = THEMES[currentTheme] || THEMES.default;

  // Wrapper: auto-inject room theme color into all toasts
  const showToast = (msg: string, type?: any, duration?: number, action?: any) => {
    _showToast(msg, type, duration, action, accentColor);
  };

  const isHost = (auth.user && initialRoom?.host?._id === auth.user?._id) || initialIsHost;

  // Permanent socket listeners
  useEffect(() => {
    socket.on('room-message', (msg: any) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('hand-raised', (request: any) => {
      if (isHost) {
        setPendingRequests(prev => [...prev, request]);
        showToast(`${request.displayName} wants to play music`, 'info', 6000, {
          label: 'APPROVE',
          onPress: () => approveRequest(request.socketId)
        });
      }
    });

    socket.on('permission-status', (data: any) => {
      if (data.status === 'approved') {
        setHasPermission(true);
        setRequestStatus('none');
        showToast('Host granted you permission to pick songs!', 'success');
      } else if (data.status === 'revoked') {
        setHasPermission(false);
        setRequestStatus('none');
        showToast('Host revoked your music control access', 'warning');
      } else {
        setHasPermission(false);
        setRequestStatus('rejected');
        showToast('Host rejected your request', 'error');
      }
    });

    socket.on('room-state', (data: any) => {
      setIsWaitingApproval(false);
      if (data.members) setMembers(data.members);
      if (data.messages) setMessages(data.messages);
      if (data.songQueue) setSongQueue(data.songQueue);
      if (data.allowDJAccess !== undefined) setAllowDJAccess(data.allowDJAccess);
    });

    socket.on('error-msg', (data: any) => {
      showToast(data.message, 'error');
    });

    socket.on('room-update', (data: any) => {
      if (data.members) {
        setMembers(data.members);
        // Safety: If I am in the members list, I am definitely not waiting anymore
        const me = data.members.find((m: any) => m.socketId === socket.id);
        if (me) setIsWaitingApproval(false);
      }
    });

    socket.on('room-closed', (data: any) => {
      showToast(data.message || 'Room has been closed by host', 'warning');
      leaveRoom();
      navigation.goBack();
    });

    socket.on('host-disconnected', (data: any) => {
      showToast('Host briefly disconnected. Waiting for reconnection...', 'warning', 8000);
    });

    socket.on('waiting-for-approval', (data: any) => {
      setIsWaitingApproval(true);
      showToast(data.message, 'info');
    });

    socket.on('join-approved', (data: any) => {
      setIsWaitingApproval(false);
      hasJoinedRef.current = true;
      showToast('Joined successfully!', 'success');
      if (data.roomState) {
        setMembers(data.roomState.members || []);
        setMessages(data.roomState.messages || []);
        if (data.roomState.allowDJAccess !== undefined) setAllowDJAccess(data.roomState.allowDJAccess);
        // Use setRoomState instead of joinRoom to avoid re-emitting 'join-room'
        setRoomState(data.roomState);
      }
    });

    socket.on('join-rejected', (data: any) => {
      setIsWaitingApproval(false);
      showToast(data.message, 'error');
      navigation.goBack();
    });

    socket.on('new-join-request', (data: any) => {
      if (isHost) {
        setJoinRequests(prev => [...prev, data]);
        showToast(`Join request: ${data.displayName}`, 'info', 6000, {
          label: 'ACCEPT',
          onPress: () => approveJoin(data.socketId)
        });
      }
    });

    socket.on('pending-update', (data: any) => {
      if (isHost && data.pendingMembers) {
        setJoinRequests(data.pendingMembers);
      }
    });

    socket.on('theme-changed', (data: any) => {
      setCurrentTheme(data.theme);
      showToast(`Room theme changed to ${data.theme}`, 'info');
    });

    socket.on('new-reaction', (data: any) => {
      const id = Math.random().toString(36).substr(2, 9);
      setReactions(prev => [...prev, { id, emoji: data.emoji, x: Math.random() * 80 + 10 }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 3000);
    });

    socket.on('song-queue-update', (data: any) => {
      setSongQueue(data.queue);
    });

    socket.on('guess-result', (data: any) => {
      showToast(data.correct ? 'Correct! +10 Points' : 'Wrong guess!', data.correct ? 'success' : 'error');
    });

    socket.on('game-mode-changed', (data: any) => {
      setGameMode(data.gameMode);
      showToast(`Game Mode: ${data.gameMode}`, 'info');
    });

    socket.on('dj-access-changed', (data: any) => {
      setAllowDJAccess(data.allowDJAccess);
      if (!data.allowDJAccess) {
        setHasPermission(false);
        setRequestStatus('none');
      }
    });

    return () => {
      socket.off('room-message');
      socket.off('hand-raised');
      socket.off('permission-status');
      socket.off('error-msg');
      socket.off('room-update');
      socket.off('room-state');
      socket.off('room-closed');
      socket.off('host-disconnected');
      socket.off('waiting-for-approval');
      socket.off('join-approved');
      socket.off('join-rejected');
      socket.off('new-join-request');
      socket.off('pending-update');
      socket.off('theme-changed');
      socket.off('new-reaction');
      socket.off('song-queue-update');
      socket.off('guess-result');
      socket.off('game-mode-changed');
      socket.off('dj-access-changed');
    };
  }, [socket, isHost, showToast]);

  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPlaying, pulseAnim]);

  useEffect(() => {
    // Only emit join-room ONCE when first entering the screen
    if (initialRoom.roomCode && !hasJoinedRef.current && !isWaitingApproval) {
       hasJoinedRef.current = true;
       joinRoom(initialRoom, isAnonymous);
    }
  }, [initialRoom.roomCode]);

  useEffect(() => {
    let syncTimer: any;
    if (isHost && isPlaying && position > 0) {
      syncTimer = setInterval(() => {
        socket.emit('room-playback', {
          roomCode: initialRoom.roomCode,
          action: 'position-update', // Use position-update for background sync
          position: position
        });
      }, 5000); // Sync every 5 seconds
    }

    return () => {
      if (syncTimer) clearInterval(syncTimer);
    };
  }, [socket, initialRoom.roomCode, isHost, isPlaying, position]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, { toValue: 1, duration: 8000, useNativeDriver: false }),
        Animated.timing(bgAnim, { toValue: 0, duration: 8000, useNativeDriver: false })
      ])
    ).start();
  }, [bgAnim]);

  const bgColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [roomTheme.bg, accentColor],
  });

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const unloadSong = () => {
    if (isHost || hasPermission) {
      socket.emit('room-playback', { 
        roomCode: initialRoom.roomCode, 
        action: 'unload' 
      });
      showToast('Song unloaded', 'info');
    }
  };



  const pickSong = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          Platform.Version >= 33 
            ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO 
            : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          showToast('Storage permission denied', 'error');
          return;
        }
      } catch (err) {
        console.warn(err);
      }
    }

    if (isPlaying) {
      togglePlayback();
    }

    const res = await DocumentPicker.pick({ 
      type: ['audio/*'] 
    }).catch(() => null);

    if (!res || res.length === 0) {
      return;
    }

    const file = res[0];
    showToast(`Uploading: ${file.name}...`, 'info', 10000);
    
    setIsPicking(true);
    loadingProgress.setValue(0);
    Animated.timing(loadingProgress, {
      toValue: 0.7,
      duration: 3000,
      useNativeDriver: false,
    }).start();

    try {
      // Upload audio file to server so all members can access it
      const formData = new FormData();
      formData.append('audio', {
        uri: file.uri,
        type: file.type || 'audio/mpeg',
        name: file.name || 'audio.mp3',
      } as any);

      const uploadRes = await fetch(`${API_URL}/api/rooms/upload-audio`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }

      const uploadData = await uploadRes.json();
      
      // Complete the progress animation
      Animated.timing(loadingProgress, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }).start();

      setTimeout(() => {
        setIsPicking(false);
        loadingProgress.setValue(0);
      }, 600);

      showToast(`Now Playing: ${file.name}`, 'success');
      
      // Use the SERVER URL so all members can access the audio
      pickTrack({ title: file.name, artist: 'Room Audio', duration: 180, url: uploadData.url, position: 0 });
    } catch (err) {
      console.error('Audio upload error:', err);
      setIsPicking(false);
      loadingProgress.setValue(0);
      showToast('Failed to upload audio. Try again.', 'error');
    }
  };

  const raiseHand = () => {
    if (requestStatus === 'pending') return;
    socket.emit('raise-hand', { roomCode: initialRoom.roomCode });
    setRequestStatus('pending');
    showToast('Permission request sent to Host', 'info');
  };

  const approveRequest = (targetSocketId: string) => {
    socket.emit('approve-hand', { targetSocketId, roomCode: initialRoom.roomCode });
    setPendingRequests(prev => prev.filter(r => r.socketId !== targetSocketId));
  };

  const rejectRequest = (targetSocketId: string) => {
    socket.emit('reject-hand', { targetSocketId, roomCode: initialRoom.roomCode });
    setPendingRequests(prev => prev.filter(r => r.socketId !== targetSocketId));
  };

  const approveJoin = (targetSocketId: string) => {
    socket.emit('approve-join', { targetSocketId, roomCode: initialRoom.roomCode });
    setJoinRequests(prev => prev.filter(r => r.socketId !== targetSocketId));
  };

  const rejectJoin = (targetSocketId: string) => {
    socket.emit('reject-join', { targetSocketId, roomCode: initialRoom.roomCode });
    setJoinRequests(prev => prev.filter(r => r.socketId !== targetSocketId));
  };

  const togglePermission = (targetSocketId: string, currentlyGranted: boolean) => {
    socket.emit('toggle-permission', { targetSocketId, grant: !currentlyGranted });
  };

  const sendReaction = (emoji: string) => {
    socket.emit('send-reaction', { emoji });
  };

  const changeTheme = (themeName: string) => {
    socket.emit('change-theme', { theme: themeName });
  };

  const voteSong = (songId: string, vote: number) => {
    socket.emit('vote-song', { songId, vote });
  };

  const submitGuess = (songId: string, guessedHostId: string) => {
    socket.emit('submit-guess', { songId, guessedHostId });
  };

  const sendChat = () => {
    if (!chatText.trim()) return;
    try {
      socket.emit('room-chat', { text: chatText.trim(), roomCode: initialRoom.roomCode });
      setChatText('');
    } catch (err) {
      console.error('room-chat error:', err);
    }
  };

  const submitNgl = async () => {
    const hostId = initialRoom.host?._id || initialRoom.host;
    if (!nglText.trim() || !hostId) return;
    setSendingNgl(true);
    try {
      await axios.post(`${API_URL}/api/ngl/send`, { 
        recipientId: hostId, 
        text: nglText.trim() 
      });
      showToast('Anonymous note sent to Host! 🤫', 'success');
      setShowNglModal(false);
      setNglText('');
    } catch (err) {
      showToast('Failed to send', 'error');
    } finally {
      setSendingNgl(false);
    }
  };
  const shareRoomLink = () => {
    const link = `https://syncognito-nine.vercel.app/join/${initialRoom.roomCode}`;
    Clipboard.setString(link);
    Share.share({
      message: `Join my music room on Syncognito! 🎵\nRoom Code: #${initialRoom.roomCode}\n\nJoin here: ${link}`,
      url: link
    }).catch(() => {
      showToast('Invite link copied!', 'success');
    });
  };

  return (
    <View style={dynamicStyles.container}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {reactions.map(r => (
          <FloatingEmoji key={r.id} emoji={r.emoji} x={r.x} />
        ))}
      </View>

      {/* Guessing Modal */}
      <Modal visible={showGuessModal} transparent animationType="slide">
        <View style={dynamicStyles.modalOverlay}>
          <View style={[dynamicStyles.nglModal, { paddingBottom: 20 }]}>
            <Text style={dynamicStyles.modalTitle}>Who added this?</Text>
            <Text style={dynamicStyles.modalSub}>{selectedSongForGuess?.title}</Text>
            <ScrollView style={{ maxHeight: 300, width: '100%' }}>
              {members.map(m => (
                <TouchableOpacity 
                  key={m.userId} 
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222', flexDirection: 'row', justifyContent: 'space-between' }}
                  onPress={() => {
                    submitGuess(selectedSongForGuess?._id, m.userId);
                    setShowGuessModal(false);
                  }}
                >
                   <Text style={{ color: '#FFF', fontSize: 16 }}>{m.displayName}</Text>
                   <MaterialCommunityIcons name="chevron-right" size={20} color={accentColor} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[dynamicStyles.cancelBtn, { marginTop: 20, width: '100%' }]} onPress={() => setShowGuessModal(false)}>
              <Text style={dynamicStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {isWaitingApproval && (
        <View style={dynamicStyles.waitingOverlay}>
          <MaterialCommunityIcons name="clock-outline" size={80} color={accentColor} />
          <Text style={dynamicStyles.waitingTitle}>Waiting for Approval</Text>
          <Text style={dynamicStyles.waitingSub}>The host will let you in shortly...</Text>
          <ActivityIndicator size="large" color={accentColor} style={{ marginTop: 30 }} />
          <TouchableOpacity 
            style={dynamicStyles.cancelWaitBtn} 
            onPress={() => {
              socket.emit('leave-room');
              setIsWaitingApproval(false);
              navigation.goBack();
            }}
          >
            <Text style={dynamicStyles.cancelWaitText}>CANCEL REQUEST</Text>
          </TouchableOpacity>
        </View>
      )}
      <Modal
        visible={showExitModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.exitModalRoot}>
            <View style={dynamicStyles.exitIconCircle}>
              <MaterialCommunityIcons name={isHost ? "power" : "logout"} size={24} color={isHost ? accentColor : "#FFF"} />
            </View>
            <Text style={dynamicStyles.exitTitle}>{isHost ? "Close Room?" : "Leave Room?"}</Text>
            <Text style={dynamicStyles.exitSubtitle}>
              {isHost 
                ? "As the host, closing the room will end the session for all listeners."
                : "You'll stop syncing with this room. You can rejoin anytime!"}
            </Text>
            
            <View style={dynamicStyles.exitActionRow}>
              <TouchableOpacity 
                style={dynamicStyles.exitCancelBtn} 
                onPress={() => setShowExitModal(false)}
              >
                <Text style={dynamicStyles.exitCancelText}>CANCEL</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[dynamicStyles.exitConfirmBtn, { backgroundColor: accentColor }]} 
                onPress={() => {
                  setShowExitModal(false);
                  leaveRoom();
                  navigation.goBack();
                }}
              >
                <Text style={dynamicStyles.exitConfirmText}>{isHost ? "CLOSE ROOM" : "LEAVE"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showNglModal} transparent animationType="fade">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.nglModal}>
            <View style={dynamicStyles.nglHeader}>
              <MaterialCommunityIcons name="incognito" size={24} color="#BB86FC" />
              <Text style={dynamicStyles.nglTitle}>Note to {initialRoom.host?.name?.split(' ')[0]}</Text>
            </View>
            <Text style={dynamicStyles.nglSub}>Your identity is strictly hidden</Text>
            <TextInput
              style={dynamicStyles.nglInput}
              placeholder="Tell the host something anonymously..."
              placeholderTextColor="#444"
              multiline
              numberOfLines={4}
              value={nglText}
              onChangeText={setNglText}
            />
            <View style={dynamicStyles.nglActions}>
              <TouchableOpacity style={dynamicStyles.nglCancel} onPress={() => setShowNglModal(false)}>
                <Text style={dynamicStyles.nglCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[dynamicStyles.nglSend, !nglText.trim() && { opacity: 0.5 }]} 
                onPress={submitNgl}
                disabled={sendingNgl || !nglText.trim()}
              >
                {sendingNgl ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={dynamicStyles.nglSendText}>SEND ANONYMOUSLY</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={dynamicStyles.headerIcon}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={dynamicStyles.headerTitle}>{initialRoom.name || 'Room'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={dynamicStyles.headerSubtitle}>#{initialRoom.roomCode}</Text>
          </View>
        </View>
        {isHost && (
          <TouchableOpacity 
            onPress={() => setShowThemeSelector(!showThemeSelector)} 
            style={[dynamicStyles.headerIcon, { borderColor: accentColor + '40', borderWidth: 1, marginRight: 10 }]}
          >
            <MaterialCommunityIcons name="palette" size={22} color={accentColor} />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          onPress={shareRoomLink} 
          style={[dynamicStyles.headerIcon, { borderColor: accentColor + '40', borderWidth: 1, marginRight: 10 }]}
        >
          <MaterialCommunityIcons name="account-plus" size={22} color={accentColor} />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setShowExitModal(true)} 
          style={[dynamicStyles.leaveBtn, { borderColor: isHost ? '#FF525240' : accentColor + '40' }]}
        >
          <MaterialCommunityIcons name={isHost ? "power" : "logout"} size={16} color={isHost ? "#FF5252" : "#FFF"} />
          <Text style={[dynamicStyles.leaveText, { color: isHost ? "#FF5252" : "#FFF" }]}>{isHost ? "CLOSE" : "LEAVE"}</Text>
        </TouchableOpacity>
      </View>

      {isHost && activeTab === 'player' && showThemeSelector && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dynamicStyles.themeBar} contentContainerStyle={{ gap: 8 }}>
          {Object.keys(THEMES).map(t => (
            <TouchableOpacity 
              key={t} 
              onPress={() => {
                changeTheme(t);
                // Optional: hide after selection? Let's keep it for now as user didn't say.
              }}
              style={[
                dynamicStyles.themeDot, 
                { backgroundColor: THEMES[t].primary },
                currentTheme === t && { borderWidth: 2, borderColor: '#FFF' }
              ]} 
            />
          ))}
        </ScrollView>
      )}

      <View style={dynamicStyles.tabContainer}>
        <TouchableOpacity onPress={() => setActiveTab('player')} style={[dynamicStyles.tab, activeTab === 'player' && { borderBottomWidth: 3, borderBottomColor: accentColor }]}><Text style={[dynamicStyles.tabText, activeTab === 'player' && dynamicStyles.activeTabText]}>PLAYER</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('queue')} style={[dynamicStyles.tab, activeTab === 'queue' && { borderBottomWidth: 3, borderBottomColor: accentColor }]}><Text style={[dynamicStyles.tabText, activeTab === 'queue' && dynamicStyles.activeTabText]}>QUEUE</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('chat')} style={[dynamicStyles.tab, activeTab === 'chat' && { borderBottomWidth: 3, borderBottomColor: accentColor }]}><Text style={[dynamicStyles.tabText, activeTab === 'chat' && dynamicStyles.activeTabText]}>CHAT</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('members')} style={[dynamicStyles.tab, activeTab === 'members' && { borderBottomWidth: 3, borderBottomColor: accentColor }]}><Text style={[dynamicStyles.tabText, activeTab === 'members' && dynamicStyles.activeTabText]}>MEMBERS</Text></TouchableOpacity>
        {isHost && (
          <TouchableOpacity onPress={() => setActiveTab('requests')} style={[dynamicStyles.tab, activeTab === 'requests' && { borderBottomWidth: 3, borderBottomColor: accentColor }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[dynamicStyles.tabText, activeTab === 'requests' && dynamicStyles.activeTabText]}>REQUESTS</Text>
              {(pendingRequests.length > 0 || joinRequests.length > 0) && <View style={dynamicStyles.notifBadge} />}
            </View>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {activeTab === 'player' ? (
        <Animated.View style={{ flex: 1, backgroundColor: bgColor }}>
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 10 }}>
          <Animated.View style={[dynamicStyles.disc, { transform: [{ scale: pulseAnim }] }]}>
            <MaterialCommunityIcons name="music-circle" size={100} color={accentColor} />
          </Animated.View>

          {isPicking && (
            <View style={dynamicStyles.loaderContainer}>
              <Animated.View 
                style={[
                  dynamicStyles.loaderBar, 
                  { 
                    backgroundColor: accentColor,
                    width: loadingProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    }) 
                  }
                ]} 
              />
            </View>
          )}

          <View style={[dynamicStyles.hostBadge, { backgroundColor: accentColor }]}>
            <View style={[dynamicStyles.hostDot, { backgroundColor: accentColor }]} />
            <Text style={[dynamicStyles.hostNameText, { color: accentColor }]}>HOSTED BY {hostInfo.name.toUpperCase()}</Text>
            {!isHost && (
              <TouchableOpacity onPress={() => setShowNglModal(true)} style={{ marginLeft: 10 }}>
                <MaterialCommunityIcons name="incognito" size={16} color="#BB86FC" />
              </TouchableOpacity>
            )}
          </View>

          <View style={dynamicStyles.titleRow}>
            <Text style={dynamicStyles.title} numberOfLines={1}>{currentTrack.title || 'No Track'}</Text>
          </View>
          <Text style={dynamicStyles.artist}>{currentTrack.artist || 'Waiting for host...'}</Text>

          {currentTrack.url && (isHost || hasPermission) && (
            <TouchableOpacity onPress={unloadSong} style={dynamicStyles.unloadAction} activeOpacity={0.7}>
              <MaterialCommunityIcons name="eject-outline" size={16} color="#FF5252" />
              <Text style={dynamicStyles.unloadActionText}>UNLOAD TRACK</Text>
            </TouchableOpacity>
          )}
          
          {currentTrack.url ? (
            <View style={dynamicStyles.timerContainer}>
              <View style={dynamicStyles.progressWrapper}>
                <View style={dynamicStyles.progressBg}>
                  <View style={[dynamicStyles.progressFill, { width: `${(position / (duration || 1)) * 100}%`, backgroundColor: accentColor, shadowColor: accentColor }]} />
                  {/* Glow Knob */}
                  <View style={[dynamicStyles.progressKnob, { left: `${(position / (duration || 1)) * 100}%`, backgroundColor: accentColor, shadowColor: accentColor }]} />
                </View>
                <TouchableOpacity 
                   style={StyleSheet.absoluteFill} 
                   activeOpacity={1}
                   onPress={(e) => {
                     if (isHost || hasPermission) {
                        const { locationX } = e.nativeEvent;
                        // Better calculation: Use 85% width which is timerContainer's width
                        const seekPos = (locationX / (SCREEN_WIDTH * 0.85)) * duration;
                        seek(seekPos);
                      }
                   }} 
                />
              </View>
              <View style={dynamicStyles.timeRow}>
                <Text style={dynamicStyles.timeLabel}>{formatTime(position)}</Text>
                <Text style={dynamicStyles.timeLabel}>{formatTime(duration)}</Text>
              </View>
            </View>
          ) : null}
          
          {isHost && pendingRequests.length > 0 && (
             <TouchableOpacity onPress={() => setActiveTab('requests')} style={[dynamicStyles.requestBanner, { backgroundColor: accentColor }]}>
                <Text style={[dynamicStyles.requestBannerText, { color: accentColor }]}>{pendingRequests.length} pending control requests</Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={accentColor} />
             </TouchableOpacity>
          )}

          {isHost && (
            <TouchableOpacity onPress={togglePlayback} style={[dynamicStyles.playBtn, { backgroundColor: accentColor, shadowColor: accentColor }]}>
              <MaterialCommunityIcons name={isPlaying ? 'pause' : 'play'} size={40} color="#000" />
            </TouchableOpacity>
          )}

          {(isHost || hasPermission) && !currentTrack.url && (
            <TouchableOpacity onPress={pickSong} style={[dynamicStyles.pickBtn, { borderColor: accentColor + '40' }]} disabled={isPicking}>
              <MaterialCommunityIcons name="folder-music-outline" size={20} color={accentColor} />
              <Text style={[dynamicStyles.pickBtnText, { color: accentColor }]}>{isPicking ? 'PICKING...' : 'SELECT FROM DEVICE'}</Text>
            </TouchableOpacity>
          )}

          {!isHost && !hasPermission && allowDJAccess && (
            <TouchableOpacity 
              onPress={raiseHand} 
              style={[dynamicStyles.raiseHandBtn, requestStatus === 'pending' && { opacity: 0.5 }, { borderColor: accentColor + '40' }]}
              disabled={requestStatus === 'pending'}
            >
              <MaterialCommunityIcons name="hand-back-right" size={20} color={accentColor} />
              <Text style={[dynamicStyles.raiseHandText, { color: accentColor }]}>
                {requestStatus === 'pending' ? 'REQUEST SENT' : 'REQUEST TO PLAY MUSIC'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={dynamicStyles.reactionContainer}>
          {['🔥', '❤️', '🙌', '💯', '✨', '⚡'].map((emoji) => (
            <TouchableOpacity 
              key={emoji} 
              onPress={() => sendReaction(emoji)} 
              style={dynamicStyles.emojiBtn}
            >
              <Text style={{ fontSize: 18 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        </Animated.View>
      ) : activeTab === 'queue' ? (
        <View style={{ flex: 1, padding: 20 }}>
          <View style={dynamicStyles.queueHeader}>
             <Text style={dynamicStyles.queueTitle}>Up Next</Text>
             <Text style={dynamicStyles.queueCount}>{songQueue.length} songs</Text>
          </View>
          <FlatList
            data={songQueue}
            keyExtractor={item => item._id}
            renderItem={({ item }) => (
              <View style={dynamicStyles.queueCard}>
                <View style={{ flex: 1 }}>
                  <Text style={dynamicStyles.queueName}>{item.title}</Text>
                  <Text style={dynamicStyles.queueSub}>Added by {item.suggestedBy}</Text>
                  
                  {gameMode === 'guess-who-added' && (
                    <TouchableOpacity onPress={() => {
                      setSelectedSongForGuess(item);
                      setShowGuessModal(true);
                    }} style={dynamicStyles.guessBtnSmall}>
                      <Text style={dynamicStyles.guessBtnText}>GUESS USER</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={dynamicStyles.voteControls}>
                  <TouchableOpacity onPress={() => voteSong(item._id, 1)} style={dynamicStyles.voteBtn}>
                    <MaterialCommunityIcons name="chevron-up" size={24} color={accentColor} />
                  </TouchableOpacity>
                  <Text style={dynamicStyles.voteCount}>{item.votes || 0}</Text>
                  <TouchableOpacity onPress={() => voteSong(item._id, -1)} style={dynamicStyles.voteBtn}>
                    <MaterialCommunityIcons name="chevron-down" size={24} color="#FF5252" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      ) : activeTab === 'chat' ? (
        <View style={{ flex: 1 }}>
          <FlatList 
            data={messages} 
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
            renderItem={({ item }) => {
              const isMe = item.senderId === auth.user?._id;
              return (
                <View style={[dynamicStyles.messageRow, isMe ? dynamicStyles.myMessage : dynamicStyles.otherMessage]}>
                  {!isMe && <Text style={dynamicStyles.senderNameSmall}>{item.sender}</Text>}
                  <View style={[dynamicStyles.bubble, isMe ? dynamicStyles.myBubble : dynamicStyles.otherBubble]}>
                    <Text style={[dynamicStyles.messageText, isMe && dynamicStyles.myMessageText]}>
                      {item.text}
                    </Text>
                  </View>
                </View>
              );
            }} 
          />
          <View style={dynamicStyles.chatInputRow}>
            <TextInput 
              value={chatText} 
              onChangeText={setChatText} 
              style={dynamicStyles.msgInput} 
              placeholder="Type a message..." 
              placeholderTextColor="#666" 
              onSubmitEditing={sendChat} 
            />
            <TouchableOpacity onPress={sendChat} style={dynamicStyles.sendMsgBtn}>
              <MaterialCommunityIcons name="send" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      ) : activeTab === 'requests' ? (
        <ScrollView style={{ flex: 1, padding: 20 }}>
          {joinRequests.length > 0 && (
            <View style={{ marginBottom: 30 }}>
              <Text style={dynamicStyles.requestTitle}>Join Room Requests</Text>
              {joinRequests.map((item) => (
                <View key={item.socketId} style={dynamicStyles.requestRow}>
                  <View>
                    <Text style={dynamicStyles.requestName}>{item.displayName}</Text>
                    <Text style={dynamicStyles.requestSub}>Wants to join the room</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => rejectJoin(item.socketId)} style={dynamicStyles.rejectBtn}>
                      <MaterialCommunityIcons name="close" size={22} color="#FF5252" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => approveJoin(item.socketId)} style={dynamicStyles.approveBtn}>
                      <MaterialCommunityIcons name="check-bold" size={22} color="#1DB954" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={dynamicStyles.requestTitle}>Music Control Requests</Text>
          {pendingRequests.length === 0 ? (
            <View style={dynamicStyles.emptyRequests}>
              <MaterialCommunityIcons name="hand-back-right-off" size={48} color="#222" />
              <Text style={dynamicStyles.emptyRequestsText}>No pending requests</Text>
            </View>
          ) : (
            pendingRequests.map((item) => (
              <View key={item.socketId} style={dynamicStyles.requestRow}>
                <View>
                  <Text style={dynamicStyles.requestName}>{item.displayName}</Text>
                  <Text style={dynamicStyles.requestSub}>Wants to select music</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => rejectRequest(item.socketId)} style={dynamicStyles.rejectBtn}>
                    <MaterialCommunityIcons name="close" size={22} color="#FF5252" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => approveRequest(item.socketId)} style={dynamicStyles.approveBtn}>
                    <MaterialCommunityIcons name="check-bold" size={22} color="#1DB954" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={dynamicStyles.requestTitle}>Active Listeners ({members.length})</Text>
            {isHost && (
              <TouchableOpacity
                onPress={() => {
                  const next = !allowDJAccess;
                  setAllowDJAccess(next);
                  socket.emit('toggle-dj-access', { allow: next });
                }}
                style={[dynamicStyles.djAccessToggle, allowDJAccess && { backgroundColor: accentColor + '20', borderColor: accentColor + '40' }]}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="music-note" size={14} color={allowDJAccess ? accentColor : '#666'} />
                <Text style={[dynamicStyles.djAccessText, allowDJAccess && { color: accentColor }]}>
                  {allowDJAccess ? 'DJ ON' : 'DJ OFF'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {members.length === 0 ? (
            <View style={dynamicStyles.emptyRequests}>
              <MaterialCommunityIcons name="account-group-outline" size={48} color="#222" />
              <Text style={dynamicStyles.emptyRequestsText}>Nobody else is here</Text>
            </View>
          ) : (
            <FlatList
              data={[...members].sort((a, b) => {
                const aIsHost = a.userId === initialRoom.host?._id ? -2 : 0;
                const bIsHost = b.userId === initialRoom.host?._id ? -2 : 0;
                const aIsDJ = a.hasPermission ? -1 : 0;
                const bIsDJ = b.hasPermission ? -1 : 0;
                return (aIsHost + aIsDJ) - (bIsHost + bIsDJ);
              })}
              keyExtractor={(item, index) => item.socketId || index.toString()}
              renderItem={({ item }) => (
                <View style={dynamicStyles.memberRow}>
                  <View style={[dynamicStyles.memberAvatar, item.hasPermission && { backgroundColor: accentColor }]}>
                    <Text style={dynamicStyles.memberInitial}>{(item.displayName || 'U').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={dynamicStyles.memberName}>{item.displayName || 'Unknown User'}</Text>
                      {item.userId === initialRoom.host?._id && (
                        <View style={[dynamicStyles.roleBadge, { backgroundColor: '#FFD70020' }]}>
                          <MaterialCommunityIcons name="crown" size={12} color="#FFD700" />
                          <Text style={[dynamicStyles.roleBadgeText, { color: '#FFD700' }]}>HOST</Text>
                        </View>
                      )}
                      {item.hasPermission && (
                        <View style={[dynamicStyles.roleBadge, { backgroundColor: accentColor + '20' }]}>
                          <MaterialCommunityIcons name="music" size={12} color={accentColor} />
                          <Text style={[dynamicStyles.roleBadgeText, { color: accentColor }]}>DJ</Text>
                        </View>
                      )}
                      {item.userId === auth.user?._id && (
                        <Text style={{ color: '#666', fontSize: 10 }}>(You)</Text>
                      )}
                    </View>
                    <Text style={dynamicStyles.memberSub}>{item.isAnonymous ? 'Listening Anonymously' : 'Active Listener'}</Text>
                  </View>
                  {/* Permission toggle — host only, not on host's own card, only when DJ access enabled */}
                  {isHost && item.userId !== initialRoom.host?._id && allowDJAccess ? (
                    <TouchableOpacity
                      onPress={() => togglePermission(item.socketId, !!item.hasPermission)}
                      style={[dynamicStyles.permToggle, item.hasPermission && { backgroundColor: accentColor }]}
                      activeOpacity={0.7}
                    >
                      <View style={[dynamicStyles.permToggleKnob, item.hasPermission && dynamicStyles.permToggleKnobOn]} />
                    </TouchableOpacity>
                  ) : (
                    <View style={dynamicStyles.onlineDot} />
                  )}
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* Video is now global and managed in PlayerContext */}
      </View>
    </View>
  );
}

const getStyles = (theme: any, accentColor: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 30 },
  headerTitle: { color: theme.text, fontSize: 18, fontWeight: '800' },
  hostBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#1DB95410', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1DB95430'
  },
  hostDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: accentColor, marginRight: 8 },
  hostNameText: { color: accentColor, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.surfaceDarker, justifyContent: 'center', gap: 5 },
  tab: { paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: accentColor },
  tabText: { color: theme.textSecondary, fontWeight: '700', fontSize: 11, letterSpacing: 0.5 },
  activeTabText: { color: theme.text },
  headerIcon: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 20 },
  headerSubtitle: { color: theme.textSecondary, fontSize: 12, fontWeight: '600' },
  leaveBtn: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12, 
    paddingVertical: 6,
    borderRadius: 12, 
    backgroundColor: '#FF525215', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: '#FF525230' 
  },
  leaveText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  notifBadge: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF5252', marginLeft: 4, marginTop: -8 },
  requestBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1DB95410', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#1DB95430', width: '85%', justifyContent: 'space-between' },
  requestBannerText: { color: accentColor, fontWeight: '700', fontSize: 12 },
  emptyRequests: { flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.5 },
  emptyRequestsText: { color: theme.textSecondary, marginTop: 10, fontSize: 14, fontWeight: '600' },
  requestSub: { color: theme.textSecondary, fontSize: 10, marginTop: 2 },
  disc: { width: 120, height: 120, borderRadius: 60, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { color: theme.text, fontSize: 22, fontWeight: '800' },
  artist: { color: theme.textSecondary, fontSize: 13, marginBottom: 10 },
  requestContainer: { backgroundColor: theme.surface, width: '90%', padding: 12, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: theme.border },
  requestTitle: { color: theme.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  requestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.surfaceDarker, padding: 10, borderRadius: 12, marginBottom: 6 },
  requestName: { color: theme.text, fontWeight: '600' },
  approveBtn: { backgroundColor: '#1DB95420', padding: 4, borderRadius: 10 },
  rejectBtn: { backgroundColor: '#FF525220', padding: 4, borderRadius: 10 },
  raiseHandBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surfaceDarker, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 30, borderWidth: 1, borderColor: theme.border, marginTop: 15 },
  raiseHandText: { color: accentColor, fontWeight: '800', fontSize: 13 },
  playBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: accentColor, justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: accentColor, shadowOpacity: 0.4, shadowRadius: 15, elevation: 10 },
  pickBtn: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.surface, 
    paddingHorizontal: 20, 
    paddingVertical: 8, 
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#1DB95490',
    borderStyle: 'dashed',
    shadowColor: accentColor,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5
  },
  pickBtnText: { color: theme.text, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  messageRow: { marginBottom: 12, maxWidth: '85%' },
  myMessage: { alignSelf: 'flex-end' },
  otherMessage: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  myBubble: { backgroundColor: accentColor, borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: theme.surfaceDarker, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.border },
  senderNameSmall: { color: theme.textSecondary, fontSize: 10, fontWeight: '700', marginBottom: 4, marginLeft: 12 },
  messageText: { color: theme.text, fontSize: 14, lineHeight: 18 },
  myMessageText: { color: theme.background, fontWeight: '600' },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: theme.surfaceDarker, backgroundColor: theme.background },
  msgInput: { flex: 1, backgroundColor: theme.surface, color: theme.text, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 25, fontSize: 14, borderWidth: 1, borderColor: theme.border },
  sendMsgBtn: { marginLeft: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: accentColor, justifyContent: 'center', alignItems: 'center', shadowColor: accentColor, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  loaderContainer: { width: '80%', height: 4, backgroundColor: theme.surface, borderRadius: 2, marginBottom: 20, overflow: 'hidden' },
  loaderBar: { height: '100%', backgroundColor: accentColor, shadowColor: accentColor, shadowOpacity: 0.8, shadowRadius: 10 },
  timerContainer: { width: '85%', marginTop: 0, marginBottom: 12 },
  progressWrapper: { height: 24, justifyContent: 'center' },
  progressBg: { height: 3, backgroundColor: theme.surfaceDarker, borderRadius: 2, width: '100%', overflow: 'visible' },
  progressFill: { height: '100%', backgroundColor: accentColor, borderRadius: 2, shadowOpacity: 0.6, shadowRadius: 8, elevation: 5 },
  progressKnob: { position: 'absolute', width: 10, height: 10, borderRadius: 5, top: -3.5, marginLeft: -5, shadowOpacity: 0.8, shadowRadius: 10, elevation: 8 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  timeLabel: { color: theme.text, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'], opacity: 0.9, letterSpacing: 0.5 },
  unloadAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF525208',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF525225',
    marginBottom: 6,
    marginTop: 5
  },
  unloadActionText: { color: '#FF5252', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '85%' },
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: theme.surfaceDarker },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: accentColor, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  memberInitial: { color: theme.background, fontWeight: '900', fontSize: 16 },
  memberName: { color: theme.text, fontWeight: '700', fontSize: 14 },
  memberSub: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: accentColor, shadowColor: accentColor, shadowOpacity: 0.5, shadowRadius: 5 },
  permToggle: { width: 40, height: 22, borderRadius: 11, backgroundColor: theme.border, justifyContent: 'center', paddingHorizontal: 2 },
  permToggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.text, shadowColor: theme.background, shadowOpacity: 0.3, shadowRadius: 3, elevation: 3 },
  permToggleKnobOn: { alignSelf: 'flex-end' },
  djAccessToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: theme.surfaceDarker, borderWidth: 1, borderColor: theme.border },
  djAccessText: { color: theme.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  hostBadgeSmall: { backgroundColor: '#1DB95420', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  hostBadgeTextSmall: { color: accentColor, fontSize: 8, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  exitModalRoot: { width: '75%', backgroundColor: theme.background, borderRadius: 20, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  exitIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.surfaceDarker, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  exitTitle: { color: theme.text, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  exitSubtitle: { color: theme.textSecondary, fontSize: 11, textAlign: 'center', lineHeight: 16, marginBottom: 20, paddingHorizontal: 5 },
  exitActionRow: { flexDirection: 'row', gap: 10, width: '100%' },
  exitCancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: theme.border },
  exitCancelText: { color: theme.textSecondary, fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  exitConfirmBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  exitConfirmText: { color: theme.background, fontWeight: '800', fontSize: 11, letterSpacing: 1 },

  nglModal: { width: '85%', backgroundColor: theme.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: theme.surfaceDarker },
  nglHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  modalTitle: { color: theme.text, fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  nglTitle: { color: theme.text, fontSize: 18, fontWeight: '800' },
  nglSub: { color: theme.textSecondary, fontSize: 12, marginBottom: 16 },
  nglInput: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, color: theme.text, fontSize: 15, textAlignVertical: 'top', height: 120, borderWidth: 1, borderColor: theme.border, marginBottom: 20 },
  nglActions: { flexDirection: 'row', gap: 10 },
  nglCancel: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: theme.surfaceDarker },
  nglCancelText: { color: theme.textSecondary, fontWeight: '800', fontSize: 12 },
  cancelBtn: { backgroundColor: theme.border, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelText: { color: theme.text, fontWeight: '600' },
  nglSend: { flex: 2, paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: '#BB86FC' },
  nglSendText: { color: theme.background, fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  
  waitingOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: theme.background, 
    zIndex: 9999, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 40 
  },
  waitingTitle: { color: theme.text, fontSize: 24, fontWeight: '800', marginTop: 20 },
  waitingSub: { color: theme.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 10 },
  cancelWaitBtn: { marginTop: 60, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, borderWidth: 1, borderColor: theme.border },
  cancelWaitText: { color: theme.textSecondary, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  themeBar: { maxHeight: 30, marginTop: 0, marginBottom: 5, paddingHorizontal: 20 },
  themeDot: { width: 20, height: 20, borderRadius: 10, marginRight: 10 },
  reactionContainer: { 
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 12, 
    width: '100%',
    paddingVertical: 10 
  },
  emojiBtn: { backgroundColor: 'rgba(255,255,255,0.08)', padding: 8, borderRadius: 16 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleBadgeText: { fontSize: 9, fontWeight: '900' },
  queueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  queueTitle: { color: theme.text, fontSize: 18, fontWeight: '800' },
  queueCount: { color: theme.textSecondary, fontSize: 12 },
  queueCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 20, marginBottom: 12 },
  queueName: { color: theme.text, fontSize: 15, fontWeight: '700' },
  queueSub: { color: theme.textSecondary, fontSize: 11, marginTop: 4 },
  voteControls: { alignItems: 'center', gap: 4, marginLeft: 10 },
  voteBtn: { padding: 4 },
  voteCount: { color: theme.text, fontSize: 14, fontWeight: '800' },
  guessBtnSmall: { backgroundColor: '#BB86FC20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 8, alignSelf: 'flex-start' },
  guessBtnText: { color: '#BB86FC', fontSize: 9, fontWeight: '900' },
  modalSub: { color: theme.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: 20 },
});
