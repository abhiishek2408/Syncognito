import { API_URL as ENV_API_URL } from '@env';
import { Platform } from 'react-native';

const PRODUCTION_URL = 'https://syncognito.onrender.com';
export const API_URL = ENV_API_URL || PRODUCTION_URL;
export default API_URL;

