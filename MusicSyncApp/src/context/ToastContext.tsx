import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

const { width } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastContextType = {
  showToast: (message: string, type?: ToastType, duration?: number, action?: { label: string, onPress: () => void }, themeColor?: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Zig-zag edge component using pure RN Views
const ZigZagEdge = ({ color, height }: { color: string; height: number }) => {
  const zigSize = 6;
  const count = Math.ceil(height / zigSize);
  return (
    <View style={{ position: 'absolute', right: -zigSize, top: 0, bottom: 0, width: zigSize, overflow: 'hidden' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 0,
            height: 0,
            borderTopWidth: zigSize / 2,
            borderBottomWidth: zigSize / 2,
            borderLeftWidth: zigSize,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: i % 2 === 0 ? '#FFFFFF' : 'transparent',
          }}
        />
      ))}
    </View>
  );
};

// Left accent zig-zag strip
const ZigZagLeft = ({ color, height }: { color: string; height: number }) => {
  const zigSize = 6;
  const count = Math.ceil(height / zigSize);
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: zigSize + 4, overflow: 'hidden', zIndex: 1 }}>
      <View style={{ backgroundColor: color, width: 4, position: 'absolute', left: 0, top: 0, bottom: 0 }} />
    </View>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('info');
  const [visible, setVisible] = useState(false);
  const [action, setAction] = useState<{ label: string, onPress: () => void } | null>(null);
  const [customColor, setCustomColor] = useState<string | null>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const toastHeightRef = useRef(70);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string, t: ToastType = 'info', duration: number = 3500, act?: { label: string, onPress: () => void }, themeColor?: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    setMessage(msg);
    setType(t);
    setAction(act || null);
    setCustomColor(themeColor || null);
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
      setAction(null);
      setCustomColor(null);
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

  const getDefaultColor = () => {
    switch (type) {
      case 'success': return '#00FF94';
      case 'error': return '#FF3B3B';
      case 'warning': return '#FFB800';
      default: return '#00E0FF';
    }
  };

  // Use custom theme color if provided, otherwise fall back to type-based color
  const accentColor = customColor || getDefaultColor();
  const lightAccent = accentColor + '20';

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && (
        <Animated.View style={[
          styles.toastContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <View 
            style={styles.toastContent}
            onLayout={(e) => { toastHeightRef.current = e.nativeEvent.layout.height; }}
          >
            {/* Left accent bar */}
            <View style={[styles.leftAccent, { backgroundColor: accentColor }]} />

            <View style={[styles.iconContainer, { backgroundColor: lightAccent }]}>
              <MaterialCommunityIcons name={getIcon()} size={22} color={accentColor} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.toastText} numberOfLines={2}>{message}</Text>
            </View>
            
            {action && (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: accentColor }]} 
                onPress={() => {
                  action.onPress();
                  hideToast();
                }}
              >
                <Text style={styles.actionButtonText}>{action.label}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={hideToast} style={styles.dismissButton}>
              <MaterialCommunityIcons name="close" size={20} color="#999" />
            </TouchableOpacity>

            {/* Progress bar */}
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
                  colors={[`${accentColor}60`, accentColor]}
                  style={styles.progressBarGradient}
                />
              </Animated.View>
            </View>

            {/* Zig-zag right edge */}
            <View style={styles.zigzagContainer}>
              <ZigZagRight color={accentColor} />
            </View>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

// Zig-zag right edge that creates a torn/ticket effect
const ZigZagRight = ({ color }: { color: string }) => {
  const zigSize = 8;
  const count = 12; // enough triangles to cover toast height
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 0,
            height: 0,
            borderTopWidth: zigSize / 2,
            borderBottomWidth: zigSize / 2,
            borderLeftWidth: zigSize / 2,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: color,
          }}
        />
      ))}
    </>
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
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 16,
    paddingVertical: 16,
    borderRadius: 16,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'visible',
  },
  leftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  zigzagContainer: {
    position: 'absolute',
    right: -4,
    top: 0,
    bottom: 0,
    width: 4,
    flexDirection: 'column',
    justifyContent: 'center',
    overflow: 'visible',
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  toastText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  progressWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderBottomLeftRadius: 16,
  },
  progressBarContainer: {
    height: '100%',
    overflow: 'hidden',
    borderBottomLeftRadius: 16,
  },
  progressBarGradient: {
    width: '100%',
    height: '100%',
  },
  dismissButton: {
    padding: 8,
    marginLeft: 4,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  actionButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
