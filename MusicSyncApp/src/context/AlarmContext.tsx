import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import AuthContext from './AuthContext';
import API_URL from '../utils/api';
import Video from 'react-native-video';
import { useToast } from './ToastContext';

type Alarm = {
  _id: string;
  triggerAt: string;
  message: string;
  title: string;
  isTriggered: boolean;
  toneUrl?: string | null;
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
  const triggeredRef = useRef<Set<string>>(new Set());
  const { showToast } = useToast();

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

  useEffect(() => {
    loadAlarms();
  }, [loadAlarms]);
  const markTriggered = useCallback(async (id: string) => {
    try {
      await axios.put(`${API_URL}/api/alarms/${id}`, { isTriggered: true }, { headers } as any);
      loadAlarms();
    } catch (err) {}
  }, [headers, loadAlarms]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!auth.token) return;
      const now = new Date();
      alarms.forEach(alarm => {
        if (!alarm.isTriggered && !triggeredRef.current.has(alarm._id) && new Date(alarm.triggerAt) <= now) {
          triggeredRef.current.add(alarm._id);
          
          if (alarm.toneUrl) {
            setActiveToneUrl(alarm.toneUrl);
          }

          showToast(`${alarm.title}: ${alarm.message || 'Alarm triggered!'}`, 'warning', 15000);
          
          // Still mark as triggered after showing toast
          markTriggered(alarm._id);
          triggeredRef.current.delete(alarm._id);
          // Note: we might want to stop tone on toast dismiss, but for now we let it play
          // or we can add a stop button in toast if we had custom actions.
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [alarms, auth.token]);

  const dismissAlarm = async (id: string) => {
    await markTriggered(id);
  };

  return (
    <AlarmContext.Provider value={{ alarms, loadAlarms, activeToneUrl, dismissAlarm }}>
      {children}
      {activeToneUrl && (
        <Video 
          source={{ uri: activeToneUrl }}
          repeat={true}
          style={{ width: 0, height: 0 }}
          ignoreSilentSwitch="ignore"
          playInBackground={true}
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
