import React, { useState, useRef, useEffect, useContext } from 'react';
import { useTheme } from '../context/ThemeContext';
import { View, Text, StyleSheet, TouchableOpacity, Share, Animated, Vibration, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import API_URL from '../utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const REACTIONS = [
  { emoji: '🔥', label: 'Fire' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
];

const CARD_THEMES = [
  ['#38ef7d', '#11998e'], // Green
  ['#8A2BE2', '#4B0082'], // Purple
  ['#FF1493', '#C71585'], // Pink
  ['#FF4500', '#FF8C00'], // Orange
  ['#00BFFF', '#1E90FF'], // Blue
  ['#FFD700', '#FFA500'], // Gold
  ['#00CED1', '#20B2AA'], // Teal
  ['#1E1E1E', '#000000'], // Black
];

type Props = {
  route: any;
  navigation: any;
};

export default function NglMessageDetailScreen({ route, navigation }: Props) {
  const { theme, accentColor } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);

  const { message } = route.params;
  const auth = useContext(AuthContext);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(message.reaction || null);
  const [isPinned, setIsPinned] = useState(message.isPinned || false);
  const [cardThemeIndex, setCardThemeIndex] = useState(0);
  
  // Animations
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const reactionScales = useRef(REACTIONS.map(() => new Animated.Value(1))).current;
  const pinRotate = useRef(new Animated.Value(0)).current;
  
  // Particle animation refs for reveal burst
  const particles = useRef(Array.from({ length: 8 }, () => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0),
  }))).current;

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
    
    // Trigger particle burst on first open
    triggerParticleBurst();
  }, []);

  const triggerParticleBurst = () => {
    particles.forEach((p, i) => {
      const angle = (i / particles.length) * Math.PI * 2;
      const distance = 60 + Math.random() * 40;
      
      p.opacity.setValue(1);
      p.scale.setValue(1);
      p.x.setValue(0);
      p.y.setValue(0);
      
      Animated.parallel([
        Animated.timing(p.x, { toValue: Math.cos(angle) * distance, duration: 600, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: Math.sin(angle) * distance, duration: 600, useNativeDriver: true }),
        Animated.timing(p.opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.timing(p.scale, { toValue: 0.2, duration: 600, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleReaction = (emoji: string, index: number) => {
    Vibration.vibrate(15);
    const newReaction = selectedReaction === emoji ? null : emoji;
    setSelectedReaction(newReaction);
    
    // Persist to backend
    if (auth.token) {
      axios.patch(`${API_URL}/api/ngl/${message._id}/react`, 
        { reaction: newReaction },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      ).catch(err => console.warn('Reaction API error:', err));
    }
    
    // Bounce animation
    Animated.sequence([
      Animated.spring(reactionScales[index], { toValue: 1.4, friction: 3, tension: 200, useNativeDriver: true }),
      Animated.spring(reactionScales[index], { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  const togglePin = () => {
    Vibration.vibrate(20);
    setIsPinned(!isPinned);
    
    // Persist to backend
    if (auth.token) {
      axios.patch(`${API_URL}/api/ngl/${message._id}/pin`, {},
        { headers: { Authorization: `Bearer ${auth.token}` } }
      ).catch(err => console.warn('Pin API error:', err));
    }
    
    Animated.sequence([
      Animated.timing(pinRotate, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(pinRotate, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const cycleTheme = () => {
    setCardThemeIndex((prev) => (prev + 1) % CARD_THEMES.length);
    Vibration.vibrate(10);
  };

  const shareAsStoryCard = async () => {
    try {
      await Share.share({
        message: `Anonymous Ask 🕵️\n\n"${message.text}"\n\nSend me anonymous messages:\nhttps://syncognito-nine.vercel.app`,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const pinSpin = pinRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const currentTheme = CARD_THEMES[cardThemeIndex];

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={dynamicStyles.backBtnMini}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>
            <MaterialCommunityIcons name="incognito" size={26} color="#1DB954" /> Anonymous
          </Text>
        </View>
        <TouchableOpacity onPress={togglePin} style={dynamicStyles.pinBtnMini}>
          <Animated.View style={{ transform: [{ rotate: pinSpin }] }}>
            <MaterialCommunityIcons 
              name={isPinned ? "pin" : "pin-outline"} 
              size={22} 
              color={isPinned ? "#FFD700" : "#555"} 
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={dynamicStyles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Message Card */}
        <Animated.View style={[dynamicStyles.cardWrapper, { transform: [{ scale: cardScale }], opacity: cardOpacity }]}>
          {/* Particle burst */}
          <View style={dynamicStyles.particleContainer}>
            {particles.map((p, i) => (
              <Animated.View
                key={i}
                style={[
                  dynamicStyles.particle,
                  {
                    backgroundColor: ['#FFD700', '#FF1493', '#00BFFF', '#1DB954', '#FF4500', '#8A2BE2', '#FF69B4', '#00CED1'][i],
                    transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
                    opacity: p.opacity,
                  },
                ]}
              />
            ))}
          </View>
          
          <View style={dynamicStyles.messageCard}>
              <LinearGradient colors={currentTheme} style={dynamicStyles.cardGradient} start={{x:0, y:0}} end={{x:1, y:1}}>
                  <View style={dynamicStyles.cardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={dynamicStyles.iconCircle}>
                        <MaterialCommunityIcons name="incognito" size={28} color="#FFF" />
                      </View>
                      <Text style={dynamicStyles.cardTitle}>ANONYMOUS ASK</Text>
                    </View>
                    <TouchableOpacity onPress={cycleTheme} style={dynamicStyles.themeBtn}>
                      <MaterialCommunityIcons name="palette" size={18} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={dynamicStyles.messageText}>{message.text}</Text>
                  
                  <View style={dynamicStyles.cardFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={dynamicStyles.timeLabel}>{new Date(message.createdAt).toLocaleDateString()}</Text>
                      {message.deviceHint && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                          <MaterialCommunityIcons 
                            name={message.deviceHint === 'Android' ? 'android' : message.deviceHint === 'iOS' ? 'apple' : 'web'} 
                            size={12} 
                            color="rgba(255,255,255,0.7)" 
                          />
                          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700' }}>
                            {message.deviceHint}
                          </Text>
                        </View>
                      )}
                    </View>
                    {selectedReaction && (
                      <Text style={{ fontSize: 24 }}>{selectedReaction}</Text>
                    )}
                  </View>
              </LinearGradient>
          </View>
        </Animated.View>

        {/* Emoji Reactions */}
        <View style={dynamicStyles.reactionsSection}>
          <Text style={dynamicStyles.sectionLabel}>REACT</Text>
          <View style={dynamicStyles.reactionsRow}>
            {REACTIONS.map((r, i) => (
              <TouchableOpacity 
                key={r.emoji} 
                onPress={() => handleReaction(r.emoji, i)}
                activeOpacity={0.7}
              >
                <Animated.View style={[
                  dynamicStyles.reactionBubble,
                  selectedReaction === r.emoji && dynamicStyles.reactionBubbleActive,
                  { transform: [{ scale: reactionScales[i] }] },
                ]}>
                  <Text style={dynamicStyles.reactionEmoji}>{r.emoji}</Text>
                </Animated.View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
 
       {/* Bottom Actions Row */}
       <View style={dynamicStyles.bottomSection}>
         <TouchableOpacity style={dynamicStyles.replyMainBtn} activeOpacity={0.9} onPress={shareAsStoryCard}>
           <LinearGradient colors={['#1DB954', '#1AA34A']} style={dynamicStyles.replyGradient}>
             <MaterialCommunityIcons name="share-variant" size={20} color="#000" />
             <Text style={dynamicStyles.replyBtnText}>SHARE & REPLY</Text>
           </LinearGradient>
         </TouchableOpacity>
       </View>
     </SafeAreaView>
   );
 }

const getStyles = (theme: any, accentColor: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingTop: 10, 
    paddingBottom: 8,
    backgroundColor: theme.surface,
  },
  backBtnMini: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10 },
  headerTitle: { color: theme.text, fontSize: 26, fontWeight: '800' },
  pinBtnMini: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 20 },
  
  // Card
  cardWrapper: { width: '100%', marginTop: 10, marginBottom: 24 },
  particleContainer: { position: 'absolute', top: '50%', left: '50%', zIndex: 10 },
  particle: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  messageCard: { width: '100%', borderRadius: 28, overflow: 'hidden', minHeight: 220 },
  cardGradient: { flex: 1, padding: 24, justifyContent: 'space-between' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitle: { color: theme.text, fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  themeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  messageText: { color: theme.text, fontSize: 22, fontWeight: '900', textAlign: 'center', lineHeight: 30, marginVertical: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  timeLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' },

  // Reactions
  reactionsSection: { marginBottom: 24 },
  sectionLabel: { color: '#555', fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  reactionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  reactionBubble: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: theme.border },
  reactionBubbleActive: { backgroundColor: 'rgba(29, 185, 84, 0.15)', borderColor: accentColor },
  reactionEmoji: { fontSize: 20 },

  // Actions
  actionsSection: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionCard: { flex: 1, height: 60, borderRadius: 18, overflow: 'hidden' },
  actionGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionFlat: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.border },
  actionText: { color: theme.text, fontSize: 13, fontWeight: '800' },

  // Bottom
  bottomSection: { paddingHorizontal: 24, paddingBottom: 24 },
  bottomActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pinBtnSmall: { width: 58, height: 58, borderRadius: 18, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: theme.border },
  pinBtnActive: { backgroundColor: 'rgba(255, 215, 0, 0.1)', borderColor: '#FFD700' },
  replyMainBtn: { width: '100%', height: 58, borderRadius: 18, overflow: 'hidden' },
  replyGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  replyBtnText: { color: theme.background, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
});
