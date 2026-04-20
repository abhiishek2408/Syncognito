import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void;
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

  const showToast = useCallback((msg: string, t: ToastType = 'info') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    setMessage(msg);
    setType(t);
    setVisible(true);
    
    progressAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 1, duration: 3500, useNativeDriver: false })
    ]).start();

    timerRef.current = setTimeout(() => {
      hideToast();
    }, 3500);
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
      case 'success': return '#1DB954';
      case 'error': return '#EF5350';
      case 'warning': return '#FFB74D';
      default: return '#64B5F6';
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
          <View style={styles.toastContent}>
            <View style={[styles.iconContainer, { backgroundColor: `${getColor()}15` }]}>
              <MaterialCommunityIcons name={getIcon()} size={20} color={getColor()} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.toastText} numberOfLines={2}>{message}</Text>
            </View>
            <View style={styles.progressContainer}>
              <Animated.View 
                style={[
                  styles.progressBar, 
                  { 
                    backgroundColor: getColor(),
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['100%', '0%']
                    })
                  }
                ]} 
              />
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
    bottom: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastContent: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    width: '100%',
    maxWidth: 450,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 20,
    borderWidth: 1.5,
    borderColor: '#EEEEEE',
    overflow: 'hidden',
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  toastText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#F0F0F0',
  },
  progressBar: {
    height: '100%',
    borderRadius: 1,
  },
});
