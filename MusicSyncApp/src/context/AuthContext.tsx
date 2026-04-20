import React, { createContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import axios from 'axios';
import { getToken, setToken as persistToken, removeToken } from '../utils/auth';
import API_URL from '../utils/api';

export type User = { _id?: string; name?: string; email?: string; anonSlug?: string; avatar?: string; profile_pic?: string; role?: string; profile_status?: string } | null;

export type AuthContextType = {
  user: User;
  token: string | null;
  initializing: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  updatePushToken: (pushToken: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUser: (user: User) => void;
};

const defaultContext: AuthContextType = {
  user: null,
  token: null,
  initializing: true,
  signIn: async () => {},
  signOut: async () => {},
  updatePushToken: async () => {},
  refreshProfile: async () => {},
  updateUser: () => {},
};

const AuthContext = createContext<AuthContextType>(defaultContext);

const host = API_URL;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);

  useEffect(() => {
    // Global Frontend Security & Performance Setup
    axios.defaults.timeout = 15000; // Global timeout to prevent hanging requests

    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Automatically logout user if token is compromised or expired
        if (error.response && error.response.status === 401) {
          console.warn('[Security] Unauthorized 401 detected globally. Enforcing logout.');
          await removeToken();
          setToken(null);
          setUser(null);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const t = await getToken();
        if (t) {
          console.log('[Auth] Token found in storage:', t.substring(0, 15) + '...');
          setToken(t);
          try {
            const resp = await axios.get(`${host}/api/users/me`, { 
              headers: { Authorization: `Bearer ${t}` },
              timeout: 10000 
            });
            console.log('[Auth] Profile fetched successfully');
            if (mounted) {
              setUser(resp.data);
              // Travel-safe: Check and update timezone if it changed
              const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
              if (resp.data.timezone !== localTz) {
                axios.put(`${host}/api/users/me/timezone`, { timezone: localTz }, { headers: { Authorization: `Bearer ${t}` } })
                  .then(updated => {
                    if (mounted) setUser(updated.data);
                  })
                  .catch(e => console.warn('Failed to sync travel timezone', e));
              }
            }
          } catch (err: any) {
            if (err.response?.status === 401) {
              console.warn('[Auth] Token invalid (401), logging out');
              await removeToken();
              if (mounted) {
                setToken(null);
                setUser(null);
              }
            } else {
              console.log('[Auth] Network/Server error, keeping token:', err.message || 'Unknown error');
            }
          }
        } else {
          console.log('[Auth] No token found in storage');
        }
      } catch (e: any) {
        console.error('[Auth] Init error:', e.message);
      } finally {
        if (mounted) setInitializing(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const signIn = async (t: string) => {
    await persistToken(t);
    setToken(t);
    try {
      const resp = await axios.get(`${host}/api/users/me`, { headers: { Authorization: `Bearer ${t}` } });
      setUser(resp.data);
    } catch (err: any) {
      Alert.alert('Sign in', 'Failed to fetch profile');
    }
  };

  const signOut = async () => {
    await removeToken();
    setToken(null);
    setUser(null);
  };
  const updatePushToken = async (pushToken: string) => {
    if (!token) return;
    try {
      await axios.put(`${host}/api/users/me/push-token`, { pushToken }, { headers: { Authorization: `Bearer ${token}` } });
      console.log('[Auth] Push token registered');
    } catch (err) {
      console.warn('[Auth] Failed to register push token', err);
    }
  };
  const refreshProfile = async () => {
    if (!token) return;
    try {
      const resp = await axios.get(`${host}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      setUser(resp.data);
    } catch (err) {
      console.warn('[Auth] Failed to refresh profile', err);
    }
  };
  
  const updateUser = (userData: User) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, token, initializing, signIn, signOut, updatePushToken, refreshProfile, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
