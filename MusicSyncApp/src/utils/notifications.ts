import messaging from '@react-native-firebase/messaging';
import notifee, { TriggerType, TimestampTrigger } from '@notifee/react-native';
import { Platform } from 'react-native';

class NotificationService {
  async requestUserPermission() {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Authorization status:', authStatus);
      return true;
    }
    return false;
  }

  async getFcmToken() {
    try {
      const token = await messaging().getToken();
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  // Schedule a local notification for alarms
  async scheduleAlarmNotification(alarmId: string, title: string, message: string, triggerAt: Date) {
    // Create a channel (required for Android)
    const channelId = await notifee.createChannel({
      id: 'alarms',
      name: 'Alarms',
      importance: 4, // high
      sound: 'default'
    });

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: triggerAt.getTime(),
    };

    await notifee.createTriggerNotification(
      {
        id: alarmId,
        title: title,
        body: message,
        android: {
          channelId,
          smallIcon: 'ic_launcher', // Ensure this exists or use default
          pressAction: {
            id: 'default',
          },
        },
      },
      trigger,
    );
  }

  async cancelAlarmNotification(alarmId: string) {
    await notifee.cancelNotification(alarmId);
  }
}

export const notificationService = new NotificationService();
