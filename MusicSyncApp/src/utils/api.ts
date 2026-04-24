import { API_URL as ENV_API_URL } from '@env';
import { Platform } from 'react-native';

const host = ENV_API_URL || 'https://syncognito.onrender.com';

export const API_URL = host;
export default API_URL;
