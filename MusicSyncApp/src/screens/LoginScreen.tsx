import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Image } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import API_URL from '../utils/api';
import { useToast } from '../context/ToastContext';

type Props = {
  navigation: any;
};

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);
  const { showToast } = useToast();

  const auth = React.useContext(AuthContext);

  React.useEffect(() => {
    // Configure with your Web client ID in environment or replace string below
    // Prefer environment override, otherwise default to the project's web client id for local testing.
    const webClientId = process.env.GOOGLE_WEB_CLIENT_ID || '882072576871-8278gh96jeqq4ajivm6n2fpgse4bsqif.apps.googleusercontent.com';
    if (!process.env.GOOGLE_WEB_CLIENT_ID) console.warn('Using default GOOGLE_WEB_CLIENT_ID; for production set GOOGLE_WEB_CLIENT_ID in your build environment');
    // IMPORTANT: offlineAccess:true is required to reliably receive idToken on Android
     GoogleSignin.configure({ webClientId, offlineAccess: true });
    // If auth already has a token/user, navigate to Home
    if (!auth.initializing && auth.token) {
      navigation.replace('UserDashboard');
    }
  }, [auth.initializing, auth.token, navigation]);

  const handleLogin = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      await GoogleSignin.hasPlayServices();
      // Force account chooser by signing out first (same logic as chooseAccount)
      try { await GoogleSignin.signOut(); } catch (e) { /* ignore */ }
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens?.idToken || (userInfo as any)?.idToken;
      console.log('Google idToken:', idToken ? `${idToken.substring(0, 20)}...` : 'MISSING');

      if (!idToken) {
        showToast('Google Sign-In failed: No ID Token received', 'error');
        setIsAuthenticating(false);
        return;
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await axios.post(`${API_URL}/api/auth/google`, { idToken, timezone });
      await auth.signIn(res.data.token);
        navigation.replace('UserDashboard');
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled
      } else {
        console.error('Login Error:', error);
        const errMsg = error?.response?.data?.message || error?.message || 'Network error';
        showToast(errMsg, 'error');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.circle1} />
      <View style={styles.circle2} />

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="pulse" size={60} color="#1DB954" />
          </View>
          <Text style={styles.title}>Syncognito</Text>
          <Text style={styles.subtitle}>Listen together, anywhere.</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.googleButton, isAuthenticating && styles.buttonDisabled]}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Image source={require('../../assets/images/g-logo.png')} style={styles.gLogo} />
                <Text style={styles.buttonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Removed 'Use a different account' button per request */}

          <Text style={styles.footerText}>By signing in, you agree to our Terms of Service.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  content: { flex: 1, paddingHorizontal: 30, justifyContent: 'center', paddingVertical: 50, zIndex: 2 },
  circle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#1DB954',
    top: -50,
    right: -100,
    opacity: 0.15,
  },
  circle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#125488',
    bottom: 50,
    left: -50,
    opacity: 0.2,
  },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  title: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1 },
  subtitle: { fontSize: 16, color: '#AAAAAA', marginTop: 8 },
  buttonContainer: { width: '100%', alignItems: 'center', marginTop: 8 },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: 56,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  buttonDisabled: { backgroundColor: '#CCCCCC' },
  googleIcon: { marginRight: 12 },
  gLogo: { width: 22, height: 22, marginRight: 12, resizeMode: 'contain' },
  buttonText: { color: '#000', fontSize: 17, fontWeight: 'bold' },
  footerText: { color: '#555', fontSize: 12, marginTop: 20, textAlign: 'center' },
  chooseButton: {
    marginTop: 12,
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chooseText: { color: '#fff', textDecorationLine: 'underline' },
});

export default LoginScreen;
