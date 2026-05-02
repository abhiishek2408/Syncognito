import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Image, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import HomeScreen from '../screens/HomeScreen';
import FriendsScreen from '../screens/FriendsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HelpScreen from '../screens/HelpScreen';
import RoomsScreen from '../screens/RoomsScreen';
import RoomScreen from '../screens/RoomScreen';
import AlarmScreen from '../screens/AlarmScreen';
import NglScreen from '../screens/NglScreen';
import NglMessageDetailScreen from '../screens/NglMessageDetailScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ProfileDetailScreen from '../screens/ProfileDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Rooms stack (list + individual room)
function RoomsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RoomsList" component={RoomsScreen} />
      <Stack.Screen name="Room" component={RoomScreen} />
    </Stack.Navigator>
  );
}

// Home stack (home dashboard can navigate to Room)
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Room" component={RoomScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="Ngl" component={NglScreen} />
      <Stack.Screen name="NglMessageDetail" component={NglMessageDetailScreen} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
    </Stack.Navigator>
  );
}

function FriendsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FriendsMain" component={FriendsScreen} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { theme, accentColor } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: accentColor,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: ((route) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? "";
          if (routeName === 'Ngl' || routeName === 'NglMessageDetail') {
            return { display: 'none' };
          }
          return {
            backgroundColor: theme.background,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            height: 85,
            paddingBottom: 22,
            paddingTop: 10,
          };
        })(route),
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') {
            return <MaterialCommunityIcons name="home" size={size} color={color} />;
          }
          if (route.name === 'Rooms') {
            return <MaterialCommunityIcons name="music-circle" size={size} color={color} />;
          }
          if (route.name === 'Friends') {
            return <MaterialCommunityIcons name="account-group" size={size} color={color} />;
          }
          if (route.name === 'Alarms') {
            return <MaterialCommunityIcons name="alarm" size={size} color={color} />;
          }
          if (route.name === 'Profile') {
            return <MaterialCommunityIcons name="account-circle" size={size} color={color} />;
          }
          return <MaterialCommunityIcons name="circle" size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen 
        name="Rooms" 
        component={RoomsStack} 
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen name="Friends" component={FriendsStack} />
      <Tab.Screen name="Alarms" component={AlarmScreen} />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStack} 
        options={{ unmountOnBlur: true }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Profile', { screen: 'ProfileMain' });
          },
        })}
      />
    </Tab.Navigator>
  );
}
