import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { usePlayer } from '../context/PlayerContext';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function MiniPlayer() {
  const { currentTrack, isPlaying, togglePlayback, activeRoomCode, leaveRoom } = usePlayer();
  const navigation = useNavigation<any>();
  const route = useRoute();

  // Don't show if no track or if we are already in the Room screen (since it has a full player)
  if (!currentTrack.url || route.name === 'Room') {
    return null;
  }

  return (
    <TouchableOpacity 
      style={styles.miniPlayer} 
      activeOpacity={0.9}
      onPress={() => {
         // Navigate to Room (assuming Room screen exists in the stack)
         navigation.navigate('Room', { 
           room: { roomCode: activeRoomCode, name: 'Active Room' }, 
           isAnonymous: false 
         });
      }}
    >
      <View style={styles.miniInfo}>
        <View style={styles.miniDisc}>
          <MaterialCommunityIcons name="music-note" size={20} color="#1DB954" />
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.miniTitle} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={styles.miniArtist} numberOfLines={1}>{activeRoomCode ? `In Room #${activeRoomCode}` : 'Playing'}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TouchableOpacity onPress={togglePlayback} style={styles.miniPlayBtn}>
          <MaterialCommunityIcons name={isPlaying ? 'pause' : 'play'} size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={(e) => {
            e.stopPropagation();
            leaveRoom();
          }} 
          style={styles.miniLeaveBtn}
        >
          <MaterialCommunityIcons name="close" size={20} color="#888" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  miniPlayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
    justifyContent: 'space-between',
    zIndex: 9999,
  },
  miniInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  miniDisc: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  miniTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  miniArtist: { color: '#666', fontSize: 11, marginTop: 2 },
  miniPlayBtn: { padding: 4 },
  miniLeaveBtn: { padding: 8, marginLeft: 4, borderLeftWidth: 1, borderLeftColor: '#222' },
});
