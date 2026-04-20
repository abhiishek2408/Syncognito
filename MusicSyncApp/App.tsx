/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import UserDashboard from './src/screens/UserDashboard';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import { PlayerProvider } from './src/context/PlayerContext';
import { AlarmProvider } from './src/context/AlarmContext';
import AuthContext from './src/context/AuthContext';
import { notificationService } from './src/utils/notifications';

import { ActivityIndicator, View, Image, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  UserDashboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const NotificationHandler = () => {
  const { user, token, updatePushToken } = React.useContext(AuthContext);

  React.useEffect(() => {
    if (token && user) {
      (async () => {
        const hasPermission = await notificationService.requestUserPermission();
        if (hasPermission) {
          const fcmToken = await notificationService.getFcmToken();
          if (fcmToken) {
            updatePushToken(fcmToken);
          }
        }
      })();
    }
  }, [token, user]);

  return null;
};

const RootNavigator = () => {
  const { initializing, token } = React.useContext(AuthContext);

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: width * 0.4, height: width * 0.4, backgroundColor: '#000000', borderRadius: width * 0.2, justifyContent: 'center', alignItems: 'center' }}>
          <Image 
            source={require('./src/assets/logo.png')} 
            style={{ width: '60%', height: '60%' }} 
            resizeMode="contain"
          />
        </View>
        <View style={{ position: 'absolute', bottom: 100 }}>
          <ActivityIndicator size="large" color="#1DB954" />
        </View>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {token ? (
        <Stack.Screen name="UserDashboard" component={UserDashboard} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
};

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <AuthProvider>
        <NotificationHandler />
        <ToastProvider>
          <PlayerProvider>
            <AlarmProvider>
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
            </AlarmProvider>
          </PlayerProvider>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default App;
