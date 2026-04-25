import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  Alert, ScrollView, Animated, Dimensions, LogBox, Modal, ActivityIndicator, Share
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
import axios from 'axios';
import API_URL from '../utils/api';

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
  const params = route?.params || {};
  const { room: initialRoom = {}, isAnonymous = false, isHost: initialIsHost = false } = params;
  
  const auth = useContext(AuthContext);
  const { showToast } = useToast();
  const socket = getSocket();

  const { 
    currentTrack, isPlaying, position, duration, activeRoomCode,
    togglePlayback, seek, pickTrack, unloadTrack, joinRoom, leaveRoom 
  } = usePlayer();

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
  const loadingProgress = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  const THEMES: any = {
    default: { primary: '#1DB954', accent: '#1DB95420', bg: '#000', text: '#FFF' },
    neon: { primary: '#FF00FF', accent: '#FF00FF20', bg: '#080008', text: '#FFF' },
    ocean: { primary: '#00BFFF', accent: '#00BFFF20', bg: '#00080F', text: '#FFF' },
    sunset: { primary: '#FF4500', accent: '#FF450020', bg: '#0F0500', text: '#FFF' },
    emerald: { primary: '#50C878', accent: '#50C87820', bg: '#000A05', text: '#FFF' },
  };
  const theme = THEMES[currentTheme] || THEMES.default;

  const isHost = (auth.user && initialRoom?.host?._id === auth.user?._id) || initialIsHost;

  // Permanent socket listeners
  useEffect(() => {
    socket.on('room-message', (msg: any) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('hand-raised', (request: any) => {
      if (isHost) {
        setPendingRequests(prev => [...prev, request]);
        showToast(`${request.displayName} wants to play music`, 'info');
      }
    });

    socket.on('permission-status', (data: any) => {
      if (data.status === 'approved') {
        setHasPermission(true);
        setRequestStatus('none');
        showToast('Host granted you permission to pick songs!', 'success');
      } else {
        setHasPermission(false);
        setRequestStatus('rejected');
        showToast('Host rejected your request', 'error');
      }
    });

    socket.on('error-msg', (data: any) => {
      showToast(data.message, 'error');
    });

    socket.on('room-update', (data: any) => {
      if (data.members) {
        setMembers(data.members);
      }
    });

    socket.on('room-closed', (data: any) => {
      showToast(data.message || 'Room has been closed by host', 'warning');
      leaveRoom();
      navigation.goBack();
    });

    socket.on('waiting-for-approval', (data: any) => {
      setIsWaitingApproval(true);
      showToast(data.message, 'info');
    });

    socket.on('join-approved', (data: any) => {
      setIsWaitingApproval(false);
      showToast('Joined successfully!', 'success');
      if (data.roomState) {
        setMembers(data.roomState.members || []);
        setMessages(data.roomState.messages || []);
        joinRoom(data.roomState, isAnonymous);
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
        showToast(`New join request from ${data.displayName}`, 'info');
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

    return () => {
      socket.off('room-message');
      socket.off('hand-raised');
      socket.off('permission-status');
      socket.off('error-msg');
      socket.off('room-update');
      socket.off('room-closed');
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
    if (initialRoom.roomCode !== activeRoomCode) {
       joinRoom(initialRoom, isAnonymous);
    }

    let syncTimer: any;
    if (isHost && isPlaying && position > 0) {
      syncTimer = setInterval(() => {
        socket.emit('room-playback', {
          roomCode: initialRoom.roomCode,
          action: 'seek',
          position: position
        });
      }, 7000);
    }

    return () => {
      if (syncTimer) clearInterval(syncTimer);
    };
  }, [joinRoom, socket, initialRoom, isAnonymous, activeRoomCode, isHost, isPlaying, position]);

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
    outputRange: [theme.bg, theme.accent],
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
    if (isPlaying) {
      togglePlayback();
    }

    setIsPicking(true);
    loadingProgress.setValue(0);
    Animated.timing(loadingProgress, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: false,
    }).start();
    
    const res = await DocumentPicker.pick({ 
      type: ['audio/*'] 
    }).catch(() => null);

    if (!res || res.length === 0) {
      setIsPicking(false);
      loadingProgress.setValue(0);
      return;
    }

    loadingProgress.setValue(1);
    setTimeout(() => {
      setIsPicking(false);
      loadingProgress.setValue(0);
    }, 600);

    const file = res[0];
    showToast(`Selected: ${file.name}`, 'success');
    
    pickTrack({ title: file.name, artist: 'My Device', duration: 180, url: file.uri, position: 0 });
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
  };

  const rejectJoin = (targetSocketId: string) => {
    socket.emit('reject-join', { targetSocketId, roomCode: initialRoom.roomCode });
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
    <Animated.View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {reactions.map(r => (
          <FloatingEmoji key={r.id} emoji={r.emoji} x={r.x} />
        ))}
      </View>

      {/* Guessing Modal */}
      <Modal visible={showGuessModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.nglModal, { paddingBottom: 20 }]}>
            <Text style={styles.modalTitle}>Who added this?</Text>
            <Text style={styles.modalSub}>{selectedSongForGuess?.title}</Text>
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
                   <MaterialCommunityIcons name="chevron-right" size={20} color={theme.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.cancelBtn, { marginTop: 20, width: '100%' }]} onPress={() => setShowGuessModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {isWaitingApproval && (
        <View style={styles.waitingOverlay}>
          <MaterialCommunityIcons name="clock-outline" size={80} color={theme.primary} />
          <Text style={styles.waitingTitle}>Waiting for Approval</Text>
          <Text style={styles.waitingSub}>The host will let you in shortly...</Text>
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 30 }} />
          <TouchableOpacity 
            style={styles.cancelWaitBtn} 
            onPress={() => {
              setIsWaitingApproval(false);
              navigation.goBack();
            }}
          >
            <Text style={styles.cancelWaitText}>CANCEL REQUEST</Text>
          </TouchableOpacity>
        </View>
      )}
      <Modal
        visible={showExitModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.exitModalRoot}>
            <View style={styles.exitIconCircle}>
              <MaterialCommunityIcons name={isHost ? "power" : "logout"} size={32} color={isHost ? "#FF5252" : "#FFF"} />
            </View>
            <Text style={styles.exitTitle}>{isHost ? "Close Room?" : "Leave Room?"}</Text>
            <Text style={styles.exitSubtitle}>
              {isHost 
                ? "As the host, closing the room will end the session for all listeners."
                : "You'll stop syncing with this room. You can rejoin anytime!"}
            </Text>
            
            <View style={styles.exitActionRow}>
              <TouchableOpacity 
                style={styles.exitCancelBtn} 
                onPress={() => setShowExitModal(false)}
              >
                <Text style={styles.exitCancelText}>CANCEL</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.exitConfirmBtn, { backgroundColor: isHost ? '#FF5252' : theme.primary }]} 
                onPress={() => {
                  setShowExitModal(false);
                  leaveRoom();
                  navigation.goBack();
                }}
              >
                <Text style={styles.exitConfirmText}>{isHost ? "CLOSE ROOM" : "LEAVE"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showNglModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.nglModal}>
            <View style={styles.nglHeader}>
              <MaterialCommunityIcons name="incognito" size={24} color="#BB86FC" />
              <Text style={styles.nglTitle}>Note to {initialRoom.host?.name?.split(' ')[0]}</Text>
            </View>
            <Text style={styles.nglSub}>Your identity is strictly hidden</Text>
            <TextInput
              style={styles.nglInput}
              placeholder="Tell the host something anonymously..."
              placeholderTextColor="#444"
              multiline
              numberOfLines={4}
              value={nglText}
              onChangeText={setNglText}
            />
            <View style={styles.nglActions}>
              <TouchableOpacity style={styles.nglCancel} onPress={() => setShowNglModal(false)}>
                <Text style={styles.nglCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.nglSend, !nglText.trim() && { opacity: 0.5 }]} 
                onPress={submitNgl}
                disabled={sendingNgl || !nglText.trim()}
              >
                {sendingNgl ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.nglSendText}>SEND ANONYMOUSLY</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>{initialRoom.name || 'Room'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.headerSubtitle}>#{initialRoom.roomCode}</Text>
            <TouchableOpacity onPress={shareRoomLink} style={styles.shareBadge}>
              <MaterialCommunityIcons name="content-copy" size={12} color={theme.primary} />
              <Text style={styles.shareBadgeText}>INVITE</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity 
          onPress={() => setShowExitModal(true)} 
          style={[styles.leaveCircle, { borderColor: theme.primary + '40' }]}
        >
          <MaterialCommunityIcons name={isHost ? "power" : "logout"} size={20} color="#FF5252" />
        </TouchableOpacity>
      </View>

      {isHost && activeTab === 'player' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.themeBar} contentContainerStyle={{ gap: 10 }}>
          {Object.keys(THEMES).map(t => (
            <TouchableOpacity 
              key={t} 
              onPress={() => changeTheme(t)}
              style={[
                styles.themeDot, 
                { backgroundColor: THEMES[t].primary },
                currentTheme === t && { borderWidth: 2, borderColor: '#FFF' }
              ]} 
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.tabContainer}>
        <TouchableOpacity onPress={() => setActiveTab('player')} style={[styles.tab, activeTab === 'player' && { borderBottomWidth: 3, borderBottomColor: theme.primary }]}><Text style={[styles.tabText, activeTab === 'player' && styles.activeTabText]}>PLAYER</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('queue')} style={[styles.tab, activeTab === 'queue' && { borderBottomWidth: 3, borderBottomColor: theme.primary }]}><Text style={[styles.tabText, activeTab === 'queue' && styles.activeTabText]}>QUEUE</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('chat')} style={[styles.tab, activeTab === 'chat' && { borderBottomWidth: 3, borderBottomColor: theme.primary }]}><Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>CHAT</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('members')} style={[styles.tab, activeTab === 'members' && { borderBottomWidth: 3, borderBottomColor: theme.primary }]}><Text style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>MEMBERS</Text></TouchableOpacity>
        {isHost && (
          <TouchableOpacity onPress={() => setActiveTab('requests')} style={[styles.tab, activeTab === 'requests' && { borderBottomWidth: 3, borderBottomColor: theme.primary }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>REQUESTS</Text>
              {(pendingRequests.length > 0 || joinRequests.length > 0) && <View style={styles.notifBadge} />}
            </View>
          </TouchableOpacity>
        )}
      </View>

      {activeTab === 'player' ? (
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 40 }}>
          <Animated.View style={[styles.disc, { transform: [{ scale: pulseAnim }] }]}>
            <MaterialCommunityIcons name="music-circle" size={100} color={theme.primary} />
          </Animated.View>

          {isPicking && (
            <View style={styles.loaderContainer}>
              <Animated.View 
                style={[
                  styles.loaderBar, 
                  { 
                    backgroundColor: theme.primary,
                    width: loadingProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    }) 
                  }
                ]} 
              />
            </View>
          )}

          <View style={[styles.hostBadge, { backgroundColor: theme.accent }]}>
            <View style={[styles.hostDot, { backgroundColor: theme.primary }]} />
            <Text style={[styles.hostNameText, { color: theme.primary }]}>HOSTED BY {hostInfo.name.toUpperCase()}</Text>
            {!isHost && (
              <TouchableOpacity onPress={() => setShowNglModal(true)} style={{ marginLeft: 10 }}>
                <MaterialCommunityIcons name="incognito" size={16} color="#BB86FC" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{currentTrack.title || 'No Track'}</Text>
          </View>
          <Text style={styles.artist}>{currentTrack.artist || 'Waiting for host...'}</Text>

          {currentTrack.url && (isHost || hasPermission) && (
            <TouchableOpacity onPress={unloadSong} style={styles.unloadAction} activeOpacity={0.7}>
              <MaterialCommunityIcons name="eject-outline" size={16} color="#FF5252" />
              <Text style={styles.unloadActionText}>UNLOAD TRACK</Text>
            </TouchableOpacity>
          )}
          
          {currentTrack.url ? (
            <View style={styles.timerContainer}>
              <View style={styles.progressWrapper}>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${(position / (duration || 1)) * 100}%`, backgroundColor: theme.primary }]} />
                </View>
                <TouchableOpacity 
                   style={StyleSheet.absoluteFill} 
                   onPress={(e) => {
                     if (isHost || hasPermission) {
                        const { locationX } = e.nativeEvent;
                        const seekPos = (locationX / (SCREEN_WIDTH * 0.8)) * duration;
                        seek(seekPos);
                      }
                   }} 
                />
              </View>
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>{formatTime(position)}</Text>
                <Text style={styles.timeLabel}>{formatTime(duration)}</Text>
              </View>
            </View>
          ) : null}
          
          {isHost && pendingRequests.length > 0 && (
             <TouchableOpacity onPress={() => setActiveTab('requests')} style={[styles.requestBanner, { backgroundColor: theme.accent }]}>
                <Text style={[styles.requestBannerText, { color: theme.primary }]}>{pendingRequests.length} pending control requests</Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={theme.primary} />
             </TouchableOpacity>
          )}

          {isHost && (
            <TouchableOpacity onPress={togglePlayback} style={[styles.playBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]}>
              <MaterialCommunityIcons name={isPlaying ? 'pause' : 'play'} size={40} color="#000" />
            </TouchableOpacity>
          )}

          {(isHost || hasPermission) && (
            <TouchableOpacity onPress={pickSong} style={[styles.pickBtn, { borderColor: theme.primary + '40' }]} disabled={isPicking}>
              <MaterialCommunityIcons name="folder-music-outline" size={20} color={theme.primary} />
              <Text style={[styles.pickBtnText, { color: theme.primary }]}>{isPicking ? 'PICKING...' : 'SELECT FROM DEVICE'}</Text>
            </TouchableOpacity>
          )}

          {!isHost && !hasPermission && (
            <TouchableOpacity 
              onPress={raiseHand} 
              style={[styles.raiseHandBtn, requestStatus === 'pending' && { opacity: 0.5 }, { borderColor: theme.primary + '40' }]}
              disabled={requestStatus === 'pending'}
            >
              <MaterialCommunityIcons name="hand-back-right" size={20} color={theme.primary} />
              <Text style={[styles.raiseHandText, { color: theme.primary }]}>
                {requestStatus === 'pending' ? 'REQUEST SENT' : 'REQUEST TO PLAY MUSIC'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.reactionContainer}>
            {['🔥', '❤️', '🙌', '💯', '✨', '⚡'].map(emoji => (
              <TouchableOpacity key={emoji} onPress={() => sendReaction(emoji)} style={styles.emojiBtn}>
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : activeTab === 'queue' ? (
        <View style={{ flex: 1, padding: 20 }}>
          <View style={styles.queueHeader}>
             <Text style={styles.queueTitle}>Up Next</Text>
             <Text style={styles.queueCount}>{songQueue.length} songs</Text>
          </View>
          <FlatList
            data={songQueue}
            keyExtractor={item => item._id}
            renderItem={({ item }) => (
              <View style={styles.queueCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.queueName}>{item.title}</Text>
                  <Text style={styles.queueSub}>Added by {item.suggestedBy}</Text>
                  
                  {gameMode === 'guess-who-added' && (
                    <TouchableOpacity onPress={() => {
                      setSelectedSongForGuess(item);
                      setShowGuessModal(true);
                    }} style={styles.guessBtnSmall}>
                      <Text style={styles.guessBtnText}>GUESS USER</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.voteControls}>
                  <TouchableOpacity onPress={() => voteSong(item._id, 1)} style={styles.voteBtn}>
                    <MaterialCommunityIcons name="chevron-up" size={24} color={theme.primary} />
                  </TouchableOpacity>
                  <Text style={styles.voteCount}>{item.votes || 0}</Text>
                  <TouchableOpacity onPress={() => voteSong(item._id, -1)} style={styles.voteBtn}>
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
                <View style={[styles.messageRow, isMe ? styles.myMessage : styles.otherMessage]}>
                  {!isMe && <Text style={styles.senderNameSmall}>{item.sender}</Text>}
                  <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
                    <Text style={[styles.messageText, isMe && styles.myMessageText]}>
                      {item.text}
                    </Text>
                  </View>
                </View>
              );
            }} 
          />
          <View style={styles.chatInputRow}>
            <TextInput 
              value={chatText} 
              onChangeText={setChatText} 
              style={styles.msgInput} 
              placeholder="Type a message..." 
              placeholderTextColor="#666" 
              onSubmitEditing={sendChat} 
            />
            <TouchableOpacity onPress={sendChat} style={styles.sendMsgBtn}>
              <MaterialCommunityIcons name="send" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      ) : activeTab === 'requests' ? (
        <ScrollView style={{ flex: 1, padding: 20 }}>
          {joinRequests.length > 0 && (
            <View style={{ marginBottom: 30 }}>
              <Text style={styles.requestTitle}>Join Room Requests</Text>
              {joinRequests.map((item) => (
                <View key={item.socketId} style={styles.requestRow}>
                  <View>
                    <Text style={styles.requestName}>{item.displayName}</Text>
                    <Text style={styles.requestSub}>Wants to join the room</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => rejectJoin(item.socketId)} style={styles.rejectBtn}>
                      <MaterialCommunityIcons name="close" size={22} color="#FF5252" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => approveJoin(item.socketId)} style={styles.approveBtn}>
                      <MaterialCommunityIcons name="check-bold" size={22} color="#1DB954" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.requestTitle}>Music Control Requests</Text>
          {pendingRequests.length === 0 ? (
            <View style={styles.emptyRequests}>
              <MaterialCommunityIcons name="hand-back-right-off" size={48} color="#222" />
              <Text style={styles.emptyRequestsText}>No pending requests</Text>
            </View>
          ) : (
            pendingRequests.map((item) => (
              <View key={item.socketId} style={styles.requestRow}>
                <View>
                  <Text style={styles.requestName}>{item.displayName}</Text>
                  <Text style={styles.requestSub}>Wants to select music</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => rejectRequest(item.socketId)} style={styles.rejectBtn}>
                    <MaterialCommunityIcons name="close" size={22} color="#FF5252" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => approveRequest(item.socketId)} style={styles.approveBtn}>
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
            <Text style={styles.requestTitle}>Active Listeners ({members.length})</Text>
          </View>
          {members.length === 0 ? (
            <View style={styles.emptyRequests}>
              <MaterialCommunityIcons name="account-group-outline" size={48} color="#222" />
              <Text style={styles.emptyRequestsText}>Nobody else is here</Text>
            </View>
          ) : (
            <FlatList
              data={members}
              keyExtractor={(item, index) => item.socketId || index.toString()}
              renderItem={({ item }) => (
                <View style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberInitial}>{(item.displayName || 'U').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.memberName}>{item.displayName || 'Unknown User'}</Text>
                      {item.userId === initialRoom.host?._id && (
                        <View style={[styles.roleBadge, { backgroundColor: '#FFD70020' }]}>
                          <MaterialCommunityIcons name="crown" size={12} color="#FFD700" />
                          <Text style={[styles.roleBadgeText, { color: '#FFD700' }]}>HOST</Text>
                        </View>
                      )}
                      {item.hasPermission && (
                        <View style={[styles.roleBadge, { backgroundColor: theme.primary + '20' }]}>
                          <MaterialCommunityIcons name="music" size={12} color={theme.primary} />
                          <Text style={[styles.roleBadgeText, { color: theme.primary }]}>DJ</Text>
                        </View>
                      )}
                      {item.userId === auth.user?._id && (
                        <Text style={{ color: '#666', fontSize: 10 }}>(You)</Text>
                      )}
                    </View>
                    <Text style={styles.memberSub}>{item.isAnonymous ? 'Listening Anonymously' : 'Active Listener'}</Text>
                  </View>
                  <View style={styles.onlineDot} />
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* Video is now global and managed in PlayerContext */}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 30 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
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
  hostDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1DB954', marginRight: 8 },
  hostNameText: { color: '#1DB954', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  tab: { flex: 1, padding: 15, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#1DB954' },
  tabText: { color: '#666', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  activeTabText: { color: '#FFF' },
  headerIcon: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111', borderRadius: 20 },
  headerSubtitle: { color: '#666', fontSize: 12, fontWeight: '600' },
  shareBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1DB95415', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#1DB95430' },
  shareBadgeText: { color: '#1DB954', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  leaveCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF525215', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FF525230' },
  notifBadge: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF5252', marginLeft: 4, marginTop: -8 },
  requestBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1DB95410', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#1DB95430', width: '85%', justifyContent: 'space-between' },
  requestBannerText: { color: '#1DB954', fontWeight: '700', fontSize: 12 },
  emptyRequests: { flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.5 },
  emptyRequestsText: { color: '#444', marginTop: 10, fontSize: 14, fontWeight: '600' },
  requestSub: { color: '#666', fontSize: 10, marginTop: 2 },
  disc: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  artist: { color: '#666', fontSize: 13, marginBottom: 10 },
  requestContainer: { backgroundColor: '#111', width: '90%', padding: 12, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  requestTitle: { color: '#888', fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  requestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1A1A', padding: 10, borderRadius: 12, marginBottom: 6 },
  requestName: { color: '#fff', fontWeight: '600' },
  approveBtn: { backgroundColor: '#1DB95420', padding: 4, borderRadius: 10 },
  rejectBtn: { backgroundColor: '#FF525220', padding: 4, borderRadius: 10 },
  raiseHandBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1A1A1A', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 30, borderWidth: 1, borderColor: '#333', marginTop: 15 },
  raiseHandText: { color: '#1DB954', fontWeight: '800', fontSize: 13 },
  playBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1DB954', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#1DB954', shadowOpacity: 0.4, shadowRadius: 15, elevation: 10 },
  pickBtn: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0A0A0A', 
    paddingHorizontal: 20, 
    paddingVertical: 8, 
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#1DB95460',
    shadowColor: '#1DB954',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5
  },
  pickBtnText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  messageRow: { marginBottom: 12, maxWidth: '85%' },
  myMessage: { alignSelf: 'flex-end' },
  otherMessage: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  myBubble: { backgroundColor: '#1DB954', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#1A1A1A', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#333' },
  senderNameSmall: { color: '#666', fontSize: 10, fontWeight: '700', marginBottom: 4, marginLeft: 12 },
  messageText: { color: '#FFF', fontSize: 14, lineHeight: 18 },
  myMessageText: { color: '#000', fontWeight: '600' },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: '#1A1A1A', backgroundColor: '#000' },
  msgInput: { flex: 1, backgroundColor: '#111', color: '#FFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 25, fontSize: 14, borderWidth: 1, borderColor: '#333' },
  sendMsgBtn: { marginLeft: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: '#1DB954', justifyContent: 'center', alignItems: 'center', shadowColor: '#1DB954', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  loaderContainer: { width: '80%', height: 4, backgroundColor: '#111', borderRadius: 2, marginBottom: 20, overflow: 'hidden' },
  loaderBar: { height: '100%', backgroundColor: '#1DB954', shadowColor: '#1DB954', shadowOpacity: 0.5, shadowRadius: 5 },
  timerContainer: { width: '85%', marginBottom: 30 },
  progressWrapper: { height: 20, justifyContent: 'center' },
  progressBg: { height: 4, backgroundColor: '#333', borderRadius: 2, width: '100%' },
  progressFill: { height: '100%', backgroundColor: '#1DB954', borderRadius: 2 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  timeLabel: { color: '#FFF', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'], opacity: 0.8 },
  unloadAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF525210',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF525230',
    marginBottom: 12
  },
  unloadActionText: { color: '#FF5252', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '85%' },
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A0A0A', padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#1A1A1A' },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1DB954', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  memberInitial: { color: '#000', fontWeight: '900', fontSize: 16 },
  memberName: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  memberSub: { color: '#666', fontSize: 11, marginTop: 2 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1DB954', shadowColor: '#1DB954', shadowOpacity: 0.5, shadowRadius: 5 },
  hostBadgeSmall: { backgroundColor: '#1DB95420', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  hostBadgeTextSmall: { color: '#1DB954', fontSize: 8, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  exitModalRoot: { width: '85%', backgroundColor: '#111', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  exitIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  exitTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  exitSubtitle: { color: '#888', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 30, paddingHorizontal: 10 },
  exitActionRow: { flexDirection: 'row', gap: 12, width: '100%' },
  exitCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: '#222' },
  exitCancelText: { color: '#888', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  exitConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  exitConfirmText: { color: '#FFF', fontWeight: '800', fontSize: 12, letterSpacing: 1 },

  nglModal: { width: '85%', backgroundColor: '#0A0A0A', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1A1A1A' },
  nglHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  nglTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  nglSub: { color: '#666', fontSize: 12, marginBottom: 16 },
  nglInput: { backgroundColor: '#111', borderRadius: 16, padding: 16, color: '#FFF', fontSize: 15, textAlignVertical: 'top', height: 120, borderWidth: 1, borderColor: '#222', marginBottom: 20 },
  nglActions: { flexDirection: 'row', gap: 10 },
  nglCancel: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: '#1A1A1A' },
  nglCancelText: { color: '#666', fontWeight: '800', fontSize: 12 },
  cancelBtn: { backgroundColor: '#333', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelText: { color: '#fff', fontWeight: '600' },
  nglSend: { flex: 2, paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: '#BB86FC' },
  nglSendText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  
  waitingOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: '#000', 
    zIndex: 9999, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 40 
  },
  waitingTitle: { color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 20 },
  waitingSub: { color: '#666', fontSize: 14, textAlign: 'center', marginTop: 10 },
  cancelWaitBtn: { marginTop: 60, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, borderWidth: 1, borderColor: '#333' },
  cancelWaitText: { color: '#666', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  themeBar: { maxHeight: 40, marginTop: 10, paddingHorizontal: 20 },
  themeDot: { width: 30, height: 30, borderRadius: 15, marginRight: 10 },
  reactionContainer: { flexDirection: 'row', justifyContent: 'center', gap: 15, marginTop: 30, paddingVertical: 10 },
  emojiBtn: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 20 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleBadgeText: { fontSize: 9, fontWeight: '900' },
  queueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  queueTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  queueCount: { color: '#666', fontSize: 12 },
  queueCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 20, marginBottom: 12 },
  queueName: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  queueSub: { color: '#888', fontSize: 11, marginTop: 4 },
  voteControls: { alignItems: 'center', gap: 4, marginLeft: 10 },
  voteBtn: { padding: 4 },
  voteCount: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  guessBtnSmall: { backgroundColor: '#BB86FC20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 8, alignSelf: 'flex-start' },
  guessBtnText: { color: '#BB86FC', fontSize: 9, fontWeight: '900' },
  modalSub: { color: '#888', fontSize: 12, textAlign: 'center', marginBottom: 20 },
});
