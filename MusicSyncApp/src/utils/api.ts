import { Platform } from 'react-native';

const host = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

export const API_URL = host;
export default API_URL;
