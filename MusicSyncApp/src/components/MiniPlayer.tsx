import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { usePlayer } from '../context/PlayerContext';
import { useNavigation, useNavigationState } from '@react-navigation/native';

export default function MiniPlayer() {
  const { theme, accentColor } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);

  const { currentTrack, isPlaying, togglePlayback, activeRoomCode, leaveRoom } = usePlayer();
  const navigation = useNavigation<any>();
  
  const state = useNavigationState(s => s);

  const checkIfRoomActive = (navState: any): boolean => {
    if (!navState) return false;
    const route = navState.routes[navState.index];
    if (route.name === 'Room') return true;
    if (route.state) return checkIfRoomActive(route.state);
    return false;
  };

  const isRoomScreen = checkIfRoomActive(state);

  // Don't show if no track, no active room, or if we are already in the Room screen (since it has a full player)
  if (!currentTrack.url || !activeRoomCode || isRoomScreen) {
    return null;
  }

  return (
    <TouchableOpacity 
      style={dynamicStyles.miniPlayer} 
      activeOpacity={0.9}
      onPress={() => {
         // Navigate to Room (assuming Room screen exists in the stack)
         navigation.navigate('Room', { 
           room: { roomCode: activeRoomCode, name: 'Active Room' }, 
           isAnonymous: false 
         });
      }}
    >
      <View style={dynamicStyles.miniInfo}>
        <View style={dynamicStyles.miniDisc}>
          <MaterialCommunityIcons name="music-note" size={20} color="#1DB954" />
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={dynamicStyles.miniTitle} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={dynamicStyles.miniArtist} numberOfLines={1}>{activeRoomCode ? `In Room #${activeRoomCode}` : 'Playing'}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TouchableOpacity onPress={togglePlayback} style={dynamicStyles.miniPlayBtn}>
          <MaterialCommunityIcons name={isPlaying ? 'pause' : 'play'} size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={(e) => {
            e.stopPropagation();
            leaveRoom();
          }} 
          style={dynamicStyles.miniLeaveBtn}
        >
          <MaterialCommunityIcons name="close" size={20} color="#888" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (theme: any, accentColor: string) => StyleSheet.create({
  miniPlayer: {
    position: 'absolute',
    bottom: 85,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    justifyContent: 'space-between',
    zIndex: 9999,
  },
  miniInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  miniDisc: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' },
  miniTitle: { color: theme.text, fontSize: 13, fontWeight: '700' },
  miniArtist: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
  miniPlayBtn: { padding: 4 },
  miniLeaveBtn: { padding: 8, marginLeft: 4, borderLeftWidth: 1, borderLeftColor: theme.border },
});
