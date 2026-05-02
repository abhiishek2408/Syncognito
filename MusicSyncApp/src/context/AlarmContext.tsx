import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Alert, View, Text, StyleSheet, TouchableOpacity, PanResponder, Animated as RNAnimated, Modal, Dimensions } from 'react-native';
import axios from 'axios';
import AuthContext from './AuthContext';
import API_URL from '../utils/api';
import Video from 'react-native-video';
import { useToast } from './ToastContext';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Alarm = {
  _id: string;
  triggerAt: string;
  message: string;
  title: string;
  isTriggered: boolean;
  toneUrl?: string | null;
  duration?: number;
  repetitionOn?: boolean;
  repeatCount?: number;
};

type AlarmContextType = {
  alarms: Alarm[];
  loadAlarms: () => Promise<void>;
  activeToneUrl: string | null;
  dismissAlarm: (id: string) => Promise<void>;
};

const AlarmContext = createContext<AlarmContextType | undefined>(undefined);

export const AlarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useContext(AuthContext);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [activeToneUrl, setActiveToneUrl] = useState<string | null>(null);
  const [activeAlarmId, setActiveAlarmId] = useState<string | null>(null);
  const activeAlarmIdRef = useRef<string | null>(null);
  const [activeAlarmTitle, setActiveAlarmTitle] = useState('');
  const triggeredRef = useRef<Set<string>>(new Set());
  const toneTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { showToast } = useToast();

  const swipeX = useRef(new RNAnimated.Value(0)).current;

  const { theme, accentColor } = useTheme();
  const styles = getStyles(theme, accentColor);

  const headers = useMemo(() => auth.token ? { Authorization: `Bearer ${auth.token}` } : {}, [auth.token]);

  const loadAlarms = useCallback(async () => {
    if (!auth.token) return;
    try {
      const resp = await axios.get(`${API_URL}/api/alarms`, { headers });
      setAlarms(resp.data || []);
    } catch (err) {
      console.warn('Global alarm load error:', err);
    }
  }, [auth.token, headers]);

  const stopAlarmSound = useCallback(() => {
    setActiveToneUrl(null);
    setActiveAlarmId(null);
    activeAlarmIdRef.current = null;
    setActiveAlarmTitle('');
    swipeX.setValue(0);
    if (toneTimerRef.current) {
      clearTimeout(toneTimerRef.current);
      toneTimerRef.current = null;
    }
  }, [swipeX]);

  const markTriggered = useCallback(async (id: string) => {
    try {
      await axios.put(`${API_URL}/api/alarms/${id}`, { isTriggered: true }, { headers } as any);
      loadAlarms();
    } catch (err) {}
  }, [headers, loadAlarms]);

  const dismissAlarm = useCallback(async (id: string) => {
    stopAlarmSound();
    if (id) await markTriggered(id);
  }, [markTriggered, stopAlarmSound]);

  useEffect(() => {
    loadAlarms();
  }, [loadAlarms]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!auth.token) return;
      const now = new Date();
      alarms.forEach(alarm => {
        const triggerTime = new Date(alarm.triggerAt).getTime();
        if (!alarm.isTriggered && !triggeredRef.current.has(alarm._id) && triggerTime <= (now.getTime() + 2000)) {
          triggeredRef.current.add(alarm._id);
          
          // Play sound: use toneUrl or fallback to local 'alarm_tone'
          const tone = alarm.toneUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
          setActiveToneUrl(tone);
          setActiveAlarmId(alarm._id);
          activeAlarmIdRef.current = alarm._id;
          setActiveAlarmTitle(alarm.title);

          showToast(
            `${alarm.title}: ${alarm.message || 'Alarm triggered!'}`, 
            'warning', 
            30000, 
            { label: 'STOP', onPress: () => dismissAlarm(alarm._id) }
          );
          
          // Auto-stop logic based on duration (default 30s)
          const duration = (alarm.duration || 30) * 1000;
          if (toneTimerRef.current) clearTimeout(toneTimerRef.current);
          toneTimerRef.current = setTimeout(() => {
            stopAlarmSound();
          }, duration);

          markTriggered(alarm._id);
          triggeredRef.current.delete(alarm._id);
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [alarms, auth.token, markTriggered, showToast, stopAlarmSound, dismissAlarm]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          swipeX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SCREEN_WIDTH * 0.6) {
          RNAnimated.timing(swipeX, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            if (activeAlarmIdRef.current) {
              dismissAlarm(activeAlarmIdRef.current);
            }
          });
        } else {
          RNAnimated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <AlarmContext.Provider value={{ alarms, loadAlarms, activeToneUrl, dismissAlarm }}>
      {children}

      {/* Swipe Overlay Modal */}
      <Modal visible={!!activeAlarmId} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.alarmModal}>
             <MaterialCommunityIcons name="alarm-bell" size={60} color="#1DB954" style={styles.bellIcon} />
             <Text style={styles.alarmTitle}>{activeAlarmTitle || 'Alarm'}</Text>
             <Text style={styles.alarmSub}>WAKE UP & VIBE</Text>
             
             <View style={styles.swipeContainer}>
               <RNAnimated.View 
                 style={[styles.swipeTrack, { 
                   opacity: swipeX.interpolate({ inputRange: [0, SCREEN_WIDTH * 0.5], outputRange: [1, 0.3] }) 
                 }]}
               >
                 <Text style={styles.swipeText}>Swipe right to stop</Text>
               </RNAnimated.View>
               
               <RNAnimated.View 
                 {...panResponder.panHandlers}
                 style={[styles.swipeHandle, { transform: [{ translateX: swipeX }] }]}
               >
                 <MaterialCommunityIcons name="chevron-right" size={30} color="#000" />
               </RNAnimated.View>
             </View>
          </View>
        </View>
      </Modal>

      {activeToneUrl && (
        <Video 
          key={activeToneUrl}
          source={{ uri: activeToneUrl }}
          repeat={true}
          paused={false}
          volume={1.0}
          muted={false}
          style={{ width: 1, height: 1, opacity: 0, position: 'absolute' }}
          ignoreSilentSwitch="ignore"
          playInBackground={true}
          playWhenInactive={true}
          audioOnly={true}
          onLoad={() => {
            // showToast('Alarm music starting...', 'info');
          }}
          onError={(e) => {
            console.error('Alarm sound error:', e);
            showToast(`Alarm Sound Error: ${e.error?.errorString || 'File not found or no internet'}`, 'error');
          }}
        />
      )}
    </AlarmContext.Provider>
  );
};

export const useAlarms = () => {
  const context = useContext(AlarmContext);
  if (!context) throw new Error('useAlarms must be used within AlarmProvider');
  return context;
};

const getStyles = (theme: any, accentColor: string) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  alarmModal: { width: '85%', alignItems: 'center', padding: 30, backgroundColor: theme.surface, borderRadius: 40, borderWidth: 1, borderColor: '#1DB95430' },
  bellIcon: { marginBottom: 20 },
  alarmTitle: { color: theme.text, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  alarmSub: { color: accentColor, fontSize: 12, fontWeight: '800', marginTop: 5, letterSpacing: 2 },
  swipeContainer: { width: '100%', height: 60, backgroundColor: theme.surface, borderRadius: 30, marginTop: 40, justifyContent: 'center', padding: 4, overflow: 'hidden' },
  swipeTrack: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  swipeText: { color: theme.textSecondary, fontSize: 14, fontWeight: '700' },
  swipeHandle: { width: 52, height: 52, borderRadius: 26, backgroundColor: accentColor, justifyContent: 'center', alignItems: 'center', elevation: 5 },
});
