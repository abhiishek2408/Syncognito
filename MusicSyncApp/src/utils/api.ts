import { API_URL as ENV_API_URL } from '@env';
import { Platform } from 'react-native';

const PRODUCTION_URL = 'https://syncognito.onrender.com';
let host = ENV_API_URL || PRODUCTION_URL;

// Automatically point to local backend in development mode
if (__DEV__) {
  if (Platform.OS === 'android') {
    // Use 10.0.2.2 for Android Emulator to access host's localhost
    if (host === PRODUCTION_URL || host.includes('localhost') || host.includes('127.0.0.1')) {
      host = 'http://10.0.2.2:5000';
    }
  } else {
    // For iOS or Web, localhost is fine
    if (host === PRODUCTION_URL) {
      host = 'http://localhost:5000';
    }
  }
}

export const API_URL = host;
export default API_URL;

