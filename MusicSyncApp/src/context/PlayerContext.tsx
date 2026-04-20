import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import Video from 'react-native-video';
import { getSocket } from '../utils/socket';
import AuthContext from './AuthContext';

type Track = {
  title: string | null;
  artist: string | null;
  url: string | null;
  duration: number;
  position: number;
};

type PlayerContextType = {
  currentTrack: Track;
  isPlaying: boolean;
  position: number;
  duration: number;
  activeRoomCode: string | null;
  joinRoom: (room: any, isAnonymous: boolean) => void;
  leaveRoom: () => void;
  togglePlayback: () => void;
  seek: (pos: number) => void;
  pickTrack: (track: Track) => void;
  unloadTrack: () => void;
};

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socket = getSocket();
  const auth = useContext(AuthContext);

  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track>({ title: '', artist: '', url: '', duration: 0, position: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoRef = useRef<any>(null);
  const positionRef = useRef(0);

  useEffect(() => {
    socket.on('room-playback-sync', (data: any) => {
      setCurrentTrack(data.currentTrack);
      setIsPlaying(data.currentTrack.isPlaying);
      setDuration(data.currentTrack.duration);
      
      const diff = Math.abs(positionRef.current - data.currentTrack.position);
      if (diff > 2 && videoRef.current) {
        videoRef.current.seek(data.currentTrack.position);
      }
      setPosition(data.currentTrack.position);
      positionRef.current = data.currentTrack.position;
    });

    socket.on('room-state', (state: any) => {
      if (state.currentTrack) {
        setCurrentTrack(state.currentTrack);
        setIsPlaying(state.currentTrack.isPlaying);
        setPosition(state.currentTrack.position);
        setDuration(state.currentTrack.duration);
      }
    });

    return () => {
      socket.off('room-playback-sync');
      socket.off('room-state');
    };
  }, [socket]);

  useEffect(() => {
    let localTimer: any;
    if (isPlaying) {
      localTimer = setInterval(() => {
        setPosition(prev => {
          const next = prev + 0.5;
          positionRef.current = next;
          return next;
        });
      }, 500);
    }
    return () => {
      if (localTimer) clearInterval(localTimer);
    };
  }, [isPlaying]);

  const joinRoom = (room: any, isAnonymous: boolean) => {
    setActiveRoomCode(room.roomCode);
    socket.emit('join-room', {
      roomCode: room.roomCode,
      isAnonymous,
      userId: auth.user?._id,
      displayName: auth.user?.name
    });
  };

  const leaveRoom = () => {
    socket.emit('leave-room');
    setActiveRoomCode(null);
    setCurrentTrack({ title: '', artist: '', url: '', duration: 0, position: 0 });
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    const action = isPlaying ? 'pause' : 'play';
    socket.emit('room-playback', { roomCode: activeRoomCode, action, position: positionRef.current });
    setIsPlaying(!isPlaying);
  };

  const seek = (pos: number) => {
    socket.emit('room-playback', { roomCode: activeRoomCode, action: 'seek', position: pos });
  };

  const pickTrack = (track: Track) => {
    socket.emit('room-playback', { roomCode: activeRoomCode, action: 'track-change', track });
  };

  const unloadTrack = () => {
    socket.emit('room-playback', { roomCode: activeRoomCode, action: 'unload' });
  };

  return (
    <PlayerContext.Provider value={{
      currentTrack, isPlaying, position, duration, activeRoomCode,
      joinRoom, leaveRoom, togglePlayback, seek, pickTrack, unloadTrack
    }}>
      {children}
      {currentTrack.url ? (
        <Video
          ref={videoRef}
          source={{ uri: currentTrack.url }}
          paused={!isPlaying}
          onProgress={(data) => {
            if (isPlaying) {
              setPosition(data.currentTime);
              positionRef.current = data.currentTime;
            }
          }}
          onLoad={(data) => setDuration(data.duration)}
          style={{ width: 0, height: 0 }}
          playInBackground={true}
          ignoreSilentSwitch="ignore"
        />
      ) : null}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
};
