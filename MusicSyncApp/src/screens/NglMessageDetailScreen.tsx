import React, { useState, useRef, useEffect, useContext } from 'react';
import { useTheme } from '../context/ThemeContext';
import { View, Text, StyleSheet, TouchableOpacity, Share, Animated, Vibration, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import ViewShot from 'react-native-view-shot';
import RNShare from 'react-native-share';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import API_URL from '../utils/api';
import { useToast } from '../context/ToastContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const REACTIONS = [
  { emoji: 'Ã°Å¸â€Â¥', label: 'Fire' },
  { emoji: 'Ã¢ÂÂ¤Ã¯Â¸Â', label: 'Love' },
  { emoji: 'Ã°Å¸Ëœâ€š', label: 'Haha' },
  { emoji: 'Ã°Å¸ËœÂ®', label: 'Wow' },
  { emoji: 'Ã°Å¸ËœÂ¢', label: 'Sad' },
];

const CARD_THEMES = [
  ['#434343', '#000000'], // Greyish Dark
  ['#8A2BE2', '#4B0082'], // Purple
  ['#FF1493', '#C71585'], // Pink
  ['#FF4500', '#FF8C00'], // Orange
  ['#00BFFF', '#1E90FF'], // Blue
  ['#FFD700', '#FFA500'], // Gold
  ['#00CED1', '#20B2AA'], // Teal
  ['#38ef7d', '#11998e'], // Green (moved from first)
];

type Props = {
  route: any;
  navigation: any;
};

export default function NglMessageDetailScreen({ route, navigation }: Props) {
  const { theme, accentColor } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);

  const { message } = route.params;
  const { showToast } = useToast();
  const auth = useContext(AuthContext);
  const [isPinned, setIsPinned] = useState(message.isPinned || false);
  const [cardThemeIndex, setCardThemeIndex] = useState(0);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const isPremium = auth.user?.isPremium || false;
  const viewShotRef = useRef<any>(null);
  
  // Animations
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
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
      if (!viewShotRef.current) return;
      showToast('Preparing your secret note... 🕵️‍♂️', 'info');
      
      // Give a tiny moment for any animations to settle
      setTimeout(async () => {
        try {
          const uri = await viewShotRef.current.capture();
          
          const shareOptions: any = {
            backgroundImage: uri,
            social: RNShare.Social.INSTAGRAM_STORIES,
            appId: '862585517468', 
          };

          await RNShare.shareSingle(shareOptions);
        } catch (err) {
          console.warn('Direct IG Share failed, trying open():', err);
          const uri = await viewShotRef.current.capture();
          await RNShare.open({
            url: uri,
            type: 'image/png',
          });
        }
      }, 300);
    } catch (err) {
      console.warn('Share error:', err);
      await Share.share({
        message: `Anonymous Ask Ã°Å¸â€¢ÂµÃ¯Â¸Â\n\n"${message.text}"\n\nSend me anonymous messages:\nhttps://syncognito-nine.vercel.app`,
      });
    }
  };

  const pinSpin = pinRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const generateAiReply = async () => {
    if (!isPremium) {
      showToast('Ghost AI is a Premium feature! ✨', 'info');
      return;
    }
    setLoadingAi(true);
    try {
      const resp = await axios.post(`${API_URL}/api/ngl/ghost-ai`, 
        { messageText: message.text },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      setAiSuggestion(resp.data.suggestion);
      Vibration.vibrate(50);
      showToast('Ghost AI drafted a reply! 👻', 'success');
    } catch (err) {
      showToast('Failed to reach the Ghost AI', 'error');
    } finally {
      setLoadingAi(false);
    }
  };

  const togglePremium = async () => {
    try {
      const resp = await axios.post(`${API_URL}/api/ngl/premium-toggle`, {}, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      if (auth.refreshProfile) await auth.refreshProfile();
      showToast(`Premium ${resp.data.isPremium ? 'Activated' : 'Deactivated'}!`, 'info');
    } catch (err) {
      showToast('Failed to toggle premium', 'error');
    }
  };

  const currentTheme = CARD_THEMES[cardThemeIndex];

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={dynamicStyles.backBtnMini}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>Anonymous</Text>
        </View>
        <TouchableOpacity onPress={togglePremium} style={dynamicStyles.premiumToggle}>
          <MaterialCommunityIcons name={isPremium ? "star" : "star-outline"} size={22} color={isPremium ? "#FFD700" : theme.textSecondary} />
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
                      <View style={dynamicStyles.shareIconCircle}>
                        <MaterialCommunityIcons name="incognito" size={24} color="#FFF" />
                      </View>
                      <Text style={dynamicStyles.shareHeaderText}>ANONYMOUS ASK</Text>
                    </View>
                    <TouchableOpacity onPress={cycleTheme} style={dynamicStyles.themeBtn}>
                      <MaterialCommunityIcons name="palette" size={18} color="#FFF" />
                    </TouchableOpacity>
                  </View>

                  <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 28 }]}>
                    <MaterialCommunityIcons name="incognito" size={180} color="#FFF" style={{ position: 'absolute', top: '-15%', right: '-20%', opacity: 0.08, transform: [{ rotate: '15deg' }] }} />
                    <MaterialCommunityIcons name="music-note-eighth" size={140} color="#FFF" style={{ position: 'absolute', bottom: '-10%', left: '-15%', opacity: 0.08, transform: [{ rotate: '-20deg' }] }} />
                    <MaterialCommunityIcons name="headphones" size={100} color="#FFF" style={{ position: 'absolute', top: '40%', left: '-5%', opacity: 0.12, transform: [{ rotate: '30deg' }] }} />
                    <View style={{ position: 'absolute', top: -50, left: 40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                    <View style={{ position: 'absolute', bottom: -50, right: 60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />
                  </View>
                  
                  <Text style={dynamicStyles.shareQuestionText}>{message.text}</Text>
                  
                  <View style={dynamicStyles.shareBrandingRow}>
                    <View style={dynamicStyles.SyncognitoBadge}>
                      <MaterialCommunityIcons name="music" size={10} color="#FFF" />
                      <Text style={dynamicStyles.brandingText}>Syncognito</Text>
                    </View>
                    <Text style={dynamicStyles.timeLabel}>{new Date(message.createdAt).toLocaleDateString()}</Text>
                  </View>
              </LinearGradient>
          </View>
        </Animated.View>

        {/* Premium Hints Section */}
        <View style={dynamicStyles.hintsSection}>
          <View style={dynamicStyles.hintsHeader}>
             <MaterialCommunityIcons name="shield-search" size={20} color={isPremium ? accentColor : '#666'} />
             <Text style={[dynamicStyles.hintsTitle, !isPremium && { color: '#666' }]}>SENDER INSIGHTS</Text>
             {!isPremium && (
               <View style={dynamicStyles.proBadgeMini}><Text style={dynamicStyles.proBadgeText}>PRO</Text></View>
             )}
          </View>
          
          <View style={dynamicStyles.hintsGrid}>
             <View style={dynamicStyles.hintCard}>
                <MaterialCommunityIcons name="map-marker-radius" size={18} color={isPremium ? '#FF5252' : '#444'} />
                <View>
                   <Text style={dynamicStyles.hintLabel}>LOCATION</Text>
                   <Text style={[dynamicStyles.hintValue, !isPremium && dynamicStyles.blurredText]}>
                      {isPremium ? (message.locationHint || 'Unknown City') : 'XXXXXXXX, XX'}
                   </Text>
                </View>
             </View>
             
             <View style={dynamicStyles.hintCard}>
                <MaterialCommunityIcons name="cellphone-text" size={18} color={isPremium ? '#00BFFF' : '#444'} />
                <View>
                   <Text style={dynamicStyles.hintLabel}>DEVICE</Text>
                   <Text style={[dynamicStyles.hintValue, !isPremium && dynamicStyles.blurredText]}>
                      {isPremium ? (message.deviceFull || message.deviceHint || 'Unknown') : 'iPhone XX Pro'}
                   </Text>
                </View>
             </View>

             <View style={dynamicStyles.hintCard}>
                <MaterialCommunityIcons name="account-question" size={18} color={isPremium ? '#8A2BE2' : '#444'} />
                <View>
                   <Text style={dynamicStyles.hintLabel}>NAME HINT</Text>
                   <Text style={[dynamicStyles.hintValue, !isPremium && dynamicStyles.blurredText]}>
                      {isPremium ? (message.senderUserHint || 'Not Registered') : 'A***'}
                   </Text>
                </View>
             </View>
          </View>
          
          {!isPremium && (
            <TouchableOpacity style={dynamicStyles.unlockBtn} onPress={togglePremium}>
               <Text style={dynamicStyles.unlockBtnText}>UNLOCK ALL HINTS</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Ghost AI Section */}
        <View style={dynamicStyles.aiSection}>
           <View style={dynamicStyles.hintsHeader}>
              <MaterialCommunityIcons name="ghost" size={20} color={isPremium ? '#8A2BE2' : '#666'} />
              <Text style={[dynamicStyles.hintsTitle, !isPremium && { color: '#666' }]}>GHOST AI REPLY</Text>
           </View>
           
           {aiSuggestion ? (
             <View style={dynamicStyles.aiBubble}>
                <Text style={dynamicStyles.aiText}>{aiSuggestion}</Text>
                <TouchableOpacity onPress={() => setAiSuggestion('')} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                   <Text style={{ color: accentColor, fontSize: 12, fontWeight: '700' }}>RE-GENERATE</Text>
                </TouchableOpacity>
             </View>
           ) : (
             <TouchableOpacity 
               style={[dynamicStyles.aiDraftBtn, !isPremium && { opacity: 0.6 }]} 
               onPress={generateAiReply}
               disabled={loadingAi}
             >
                {loadingAi ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="auto-fix" size={18} color="#FFF" />
                    <Text style={dynamicStyles.aiDraftText}>DRAFT WITTY REPLY</Text>
                  </>
                )}
             </TouchableOpacity>
           )}
        </View>

      </ScrollView>
 
       {/* Bottom Actions Row */}
       <View style={dynamicStyles.bottomSection}>
         <TouchableOpacity style={dynamicStyles.replyMainBtn} activeOpacity={0.9} onPress={shareAsStoryCard}>
           <LinearGradient colors={[accentColor, accentColor + 'DD']} style={dynamicStyles.replyGradient}>
             <MaterialCommunityIcons name="share-variant" size={20} color={theme.background} />
             <Text style={dynamicStyles.replyBtnText}>SHARE & REPLY</Text>
           </LinearGradient>
         </TouchableOpacity>
       </View>

        {/* Hidden Sharing Template (Captured for IG Stories) */}
        <ViewShot 
          ref={viewShotRef} 
          options={{ format: 'png', quality: 0.9 }} 
          style={dynamicStyles.hiddenViewShot}
        >
          <LinearGradient colors={currentTheme} style={dynamicStyles.shareTemplateContainer} start={{x:0, y:0}} end={{x:1, y:1}}>
            {/* Background Watermarks in Template */}
            <View style={StyleSheet.absoluteFill}>
              <MaterialCommunityIcons name="incognito" size={400} color="#FFF" style={{ position: 'absolute', top: '5%', right: '-10%', opacity: 0.1, transform: [{ rotate: '15deg' }] }} />
              <MaterialCommunityIcons name="music-note-eighth" size={300} color="#FFF" style={{ position: 'absolute', bottom: '10%', left: '-5%', opacity: 0.1, transform: [{ rotate: '-20deg' }] }} />
              <View style={{ position: 'absolute', top: '30%', left: '-20%', width: 500, height: 500, borderRadius: 250, backgroundColor: 'rgba(255,255,255,0.05)' }} />
            </View>

            {/* The White Card */}
            <View style={dynamicStyles.shareTemplateCard}>
              <View style={dynamicStyles.cardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[dynamicStyles.shareIconCircle, { backgroundColor: 'rgba(0,0,0,0.08)', width: 48, height: 48, borderRadius: 24 }]}>
                    <MaterialCommunityIcons name="incognito" size={32} color="#000" />
                  </View>
                  <Text style={[dynamicStyles.shareHeaderText, { color: '#000', fontSize: 16 }]}>ANONYMOUS ASK</Text>
                </View>
              </View>

              <Text style={[dynamicStyles.shareQuestionText, { color: '#000', textShadowRadius: 0, marginVertical: 20 }]}>{message.text}</Text>

              <View style={{ alignItems: 'center', marginBottom: 30 }}>
                <Text style={{ color: '#888', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>Send me anonymous notes! ðŸ‘‡</Text>
                <View style={{ backgroundColor: '#F5F5F5', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 100, marginTop: 12, borderWidth: 1, borderColor: '#EEE' }}>
                  <Text style={{ color: '#000', fontSize: 18, fontWeight: '900', letterSpacing: 1 }}>
                    Paste Link
                  </Text>
                </View>
              </View>

              <View style={dynamicStyles.shareBrandingRow}>
                <View style={[dynamicStyles.SyncognitoBadge, { backgroundColor: 'rgba(0,0,0,0.08)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 }]}>
                  <MaterialCommunityIcons name="music" size={14} color="#000" />
                  <Text style={[dynamicStyles.brandingText, { color: '#000', fontSize: 12 }]}>Syncognito</Text>
                </View>
                <Text style={[dynamicStyles.timeLabel, { color: '#666', fontSize: 14 }]}>{new Date(message.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>
          </LinearGradient>
        </ViewShot>
     </SafeAreaView>
   );
 }

const getStyles = (theme: any, accentColor: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingTop: 10, 
    paddingBottom: 8,
    backgroundColor: theme.background,
  },
  backBtnMini: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.border },
  headerTitle: { color: theme.text, fontSize: 26, fontWeight: '800' },
  pinBtnMini: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.border },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 20 },
  
  // Card
  cardWrapper: { width: '100%', marginTop: 10, marginBottom: 24 },
  particleContainer: { position: 'absolute', top: '50%', left: '50%', zIndex: 10 },
  particle: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  messageCard: { width: '100%', borderRadius: 28, overflow: 'hidden', minHeight: 220, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 12 },
  cardGradient: { flex: 1, padding: 24, justifyContent: 'space-between' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, zIndex: 10 },
  shareIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  shareHeaderText: { color: '#FFFFFF', fontWeight: '900', fontSize: 10, letterSpacing: 1.5 },
  themeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  shareQuestionText: { color: '#FFFFFF', fontSize: 40, fontWeight: '900', textAlign: 'center', lineHeight: 50, marginVertical: 32, zIndex: 10, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 6 },
  shareBrandingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, zIndex: 10 },
  SyncognitoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  brandingText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  timeLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' },

  // Actions
  actionsSection: { flexDirection: 'row', gap: 12, marginBottom: 24, marginTop: 12 },
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

  // Hidden Sharing Template Styles
  hiddenViewShot: { position: 'absolute', left: -3000, width: SCREEN_WIDTH * 2.5, height: SCREEN_WIDTH * 4.4 }, 
  shareTemplateContainer: { flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingHorizontal: 40, paddingTop: 120 },
  shareTemplateCard: { 
    width: '100%', 
    minHeight: 420,
    backgroundColor: '#FFFFFF', 
    borderRadius: 40, 
    padding: 32, 
    justifyContent: 'space-between',
    shadowColor: '#000', 
    shadowOpacity: 0.2, 
    shadowRadius: 30, 
    elevation: 20 
  },
  shareLinkHint: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 40, letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 5 },
  shareLinkSticker: { 
    backgroundColor: '#FFFFFF', 
    marginTop: 16, 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 100,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5
  },
  shareLinkStickerText: { color: '#000', fontSize: 16, fontWeight: '800' },

  // Premium Additions
  premiumToggle: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  hintsSection: { marginHorizontal: 24, marginBottom: 24, padding: 20, backgroundColor: theme.surface, borderRadius: 24, borderWidth: 1, borderColor: theme.border },
  hintsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  hintsTitle: { color: theme.text, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  proBadgeMini: { backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 'auto' },
  proBadgeText: { color: '#000', fontSize: 10, fontWeight: '900' },
  hintsGrid: { gap: 16 },
  hintCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hintLabel: { color: theme.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  hintValue: { color: theme.text, fontSize: 15, fontWeight: '800' },
  blurredText: { backgroundColor: theme.border, borderRadius: 4, color: 'transparent', width: 100 },
  unlockBtn: { marginTop: 20, height: 44, backgroundColor: accentColor + '20', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: accentColor },
  unlockBtnText: { color: accentColor, fontWeight: '900', fontSize: 12 },

  aiSection: { marginHorizontal: 24, marginBottom: 40, padding: 20, backgroundColor: theme.surface, borderRadius: 24, borderStyle: 'dashed', borderWidth: 1, borderColor: theme.border },
  aiDraftBtn: { height: 50, backgroundColor: '#8A2BE2', borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  aiDraftText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  aiBubble: { backgroundColor: 'rgba(138, 43, 226, 0.1)', padding: 16, borderRadius: 20, borderLeftWidth: 4, borderLeftColor: '#8A2BE2' },
  aiText: { color: theme.text, fontSize: 15, fontStyle: 'italic', lineHeight: 22 },
});

