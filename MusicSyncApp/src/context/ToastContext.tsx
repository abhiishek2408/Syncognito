import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

const { width } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastContextType = {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('info');
  const [visible, setVisible] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string, t: ToastType = 'info', duration: number = 3500) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    setMessage(msg);
    setType(t);
    setVisible(true);
    
    progressAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 1, duration: duration, useNativeDriver: false })
    ]).start();

    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    }
  }, []);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 100, duration: 300, useNativeDriver: true })
    ]).start(() => {
      setVisible(false);
      setMessage('');
    });
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return 'check-circle';
      case 'error': return 'alert-circle';
      case 'warning': return 'alert';
      default: return 'information';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'success': return '#00FF94'; // Vibrant Neon Green
      case 'error': return '#FF3B3B'; // Vibrant Red
      case 'warning': return '#FFB800'; // Amber/Gold
      default: return '#00E0FF'; // Electric Blue
    }
  };

  const getLightColor = () => {
    switch (type) {
      case 'success': return '#00FF9420';
      case 'error': return '#FF3B3B20';
      case 'warning': return '#FFB80020';
      default: return '#00E0FF20';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && (
        <Animated.View style={[
          styles.toastContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <View style={[styles.toastContent, { borderColor: getColor() }]}>
            <View style={[styles.iconContainer, { backgroundColor: getLightColor() }]}>
              <MaterialCommunityIcons name={getIcon()} size={22} color={getColor()} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.toastText} numberOfLines={2}>{message}</Text>
            </View>
            <TouchableOpacity onPress={hideToast} style={styles.dismissButton}>
              <MaterialCommunityIcons name="close" size={20} color="#666" />
            </TouchableOpacity>
            <View style={styles.progressWrapper}>
              <Animated.View 
                style={[
                  styles.progressBarContainer, 
                  { 
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['100%', '0%']
                    })
                  }
                ]}
              >
                <LinearGradient
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  colors={[`${getColor()}90`, getColor()]}
                  style={styles.progressBarGradient}
                />
              </Animated.View>
            </View>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 80 : 60,
    left: 24,
    right: 24,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastContent: {
    backgroundColor: '#0A0A0A', // Deep Obsidian
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 18,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 24,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  progressWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  progressBarContainer: {
    height: '100%',
    overflow: 'hidden',
  },
  progressBarGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
  dismissButton: {
    padding: 8,
    marginLeft: 4,
  },
});
