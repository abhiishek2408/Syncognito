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

import { ActivityIndicator, View, Image, Dimensions, Text } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

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
  const { initializing, token, user } = React.useContext(AuthContext);

  if (initializing) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {token && user ? (
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
