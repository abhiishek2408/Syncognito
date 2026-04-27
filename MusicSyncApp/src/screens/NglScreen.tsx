import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, RefreshControl, Dimensions, Animated, Share, TextInput, Modal, ScrollView, Vibration, Image, Linking
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import API_URL from '../utils/api';
import { useToast } from '../context/ToastContext';
import Clipboard from '@react-native-clipboard/clipboard';


const { width: SCREEN_WIDTH } = Dimensions.get('window');



const SHARE_THEMES = [
  '#1DB954', // Spotify Green
  '#FF4500', // Orange Red
  '#8A2BE2', // Deep Purple
  '#00BFFF', // Deep Sky Blue
  '#FF1493', // Deep Pink
  '#FFB74D', // Soft Orange
  '#00CED1', // Dark Turquoise
  '#FFD700', // Gold
  '#4B0082', // Indigo
  '#FF69B4', // Hot Pink
  '#1E1E1E', // Dark
];

const GRADIENT_PALETTE = ['#FF0000', '#FF7F00', '#FFD700', '#00FF00', '#1DB954', '#00FFFF', '#0000FF', '#8A2BE2', '#FF1493', '#000000', '#FFFFFF'];



export default function NglScreen({ navigation }: any) {
  const auth = useContext(AuthContext);
  const { showToast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const diceAnim = React.useRef(new Animated.Value(0)).current;
  const [sharingMsg, setSharingMsg] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [anonSlug, setAnonSlug] = useState(auth.user?.anonSlug || '');
  const [showSlugModal, setShowSlugModal] = useState(false);
  const [newSlug, setNewSlug] = useState(auth.user?.anonSlug || '');
  const [updatingSlug, setUpdatingSlug] = useState(false);
  const [shareTheme, setShareTheme] = useState<string | string[]>(SHARE_THEMES[0]);
  
  // Gradient Builder States
  const [showGradientModal, setShowGradientModal] = useState(false);
  const [gradColor1, setGradColor1] = useState('#8A2BE2');
  const [gradColor2, setGradColor2] = useState('#1DB954');
  
  const [activeMainTab, setActiveMainTab] = useState<'inbox' | 'my_link'>('my_link');
  const [sharePrompt, setSharePrompt] = useState('Send me anonymous notes!');
  const [revealedMessages, setRevealedMessages] = useState<string[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<string[]>([]);

  // Question of the Day
  const DAILY_PROMPTS = [
    "What's one thing you've always wanted to tell me?",
    "What vibe do I give off when you first meet me?",
    "If you could text me anything with no consequences, what would it be?",
    "Rate my personality out of 10",
    "What's my best quality?",
    "What song reminds you of me?",
    "Confess something you've been hiding",
  ];
  const todayIndex = new Date().getDate() % DAILY_PROMPTS.length;
  const questionOfTheDay = DAILY_PROMPTS[todayIndex];

  // Stats computations
  const totalMessages = messages.length;
  const today = new Date();
  const todayMessages = messages.filter(m => {
    const d = new Date(m.createdAt);
    return d.toDateString() === today.toDateString();
  }).length;
  const thisWeekMessages = messages.filter(m => {
    const d = new Date(m.createdAt);
    const diff = (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }).length;

  // Sort messages: pinned first
  const sortedMessages = [...messages].sort((a, b) => {
    const aPinned = pinnedMessages.includes(a._id) ? 0 : 1;
    const bPinned = pinnedMessages.includes(b._id) ? 0 : 1;
    return aPinned - bPinned;
  });
  
  const SHARE_PROMPTS = ["Send me anonymous notes!", "Ask me anything", "What vibe do I give off?", "Confess a secret", "What's my red flag?", "Rate me out of 10!"];
  const togglePrompt = () => {
    const currentIndex = SHARE_PROMPTS.indexOf(sharePrompt);
    const nextIndex = (currentIndex + 1) % SHARE_PROMPTS.length;
    setSharePrompt(SHARE_PROMPTS[nextIndex]);
    triggerHaptic('light');
    
    // Dice roll animation
    diceAnim.setValue(0);
    Animated.timing(diceAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };
  
  const diceSpin = diceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });
  


  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (type === 'light') Vibration.vibrate(10);
    else if (type === 'medium') Vibration.vibrate(30);
    else Vibration.vibrate(60);
  };

  useEffect(() => {
    if (auth.user?.anonSlug) {
      setAnonSlug(auth.user.anonSlug);
      setNewSlug(auth.user.anonSlug);
    }
  }, [auth.user?.anonSlug]);

  const fetchMessages = useCallback(async (isRefresh = false) => {
    if (!auth.token) return;
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);

    try {
      const resp = await axios.get(`${API_URL}/api/ngl/me`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      setMessages(resp.data || []);
    } catch (err) {
      console.warn('NGL fetch error:', err);
      showToast('Failed to load notes', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }
  }, [auth.token, fadeAnim, showToast]);



  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const deleteMessage = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/api/ngl/${id}`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      setMessages(prev => prev.filter(m => m._id !== id));
      showToast('Note deleted', 'info');
    } catch (err) {
      showToast('Failed to delete', 'error');
    }
  };

  const copyNglLink = () => {
    const slugOrId = anonSlug || auth.user?._id;
    const shareUrl = `https://syncognito-nine.vercel.app/anon/${slugOrId}`;
    Clipboard.setString(shareUrl);
    triggerHaptic('medium');
    showToast('Link copied to clipboard! 🤫', 'success');
  };

  const shareNglLink = async () => {
    try {
      const slugOrId = anonSlug || auth.user?._id;
      const shareUrl = `https://syncognito-nine.vercel.app/anon/${slugOrId}`;
      Clipboard.setString(shareUrl);
      
      const tryOpen = async (url: string) => {
        const canOpen = await Linking.canOpenURL(url).catch(() => false);
        if (canOpen) {
          await Linking.openURL(url);
          return true;
        }
        return false;
      };

      try {
        let opened = await tryOpen('instagram://story-camera');
        if (!opened) opened = await tryOpen('instagram://camera');
        if (!opened) opened = await tryOpen('instagram://app');
        
        if (opened) {
          showToast('Link copied! Paste it as a sticker in your Story 🤫', 'success');
        } else {
          throw new Error('Instagram not found');
        }
      } catch (err) {
        // Fallback if Instagram is not installed or intents fail
        await Share.share({
          message: `${sharePrompt}\n${shareUrl}`,
        });
      }
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const updateSlug = async () => {
    if (!newSlug.trim()) return;
    setUpdatingSlug(true);
    try {
      const resp = await axios.patch(`${API_URL}/api/ngl/slug`, 
        { slug: newSlug.trim() },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      setAnonSlug(resp.data.slug);
      if (auth.refreshProfile) await auth.refreshProfile();
      setShowSlugModal(false);
      showToast(`Link customized to: ${resp.data.slug}`, 'success');
    } catch (err: any) {
      console.warn('[NGL] Slug Update Error:', err.response?.data || err.message);
      showToast(err.response?.data?.message || 'Failed to update link', 'error');
    } finally {
      setUpdatingSlug(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isRevealed = revealedMessages.includes(item._id);

    const msgPinned = pinnedMessages.includes(item._id);

    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={() => {
          if (!isRevealed) {
            setRevealedMessages(prev => [...prev, item._id]);
            triggerHaptic('medium');
          }
          navigation.navigate('NglMessageDetail', { message: item });
        }}
      >
        <Animated.View style={[styles.messageCard, { opacity: fadeAnim, borderStyle: isRevealed ? 'solid' : 'dashed' }, msgPinned && { borderColor: 'rgba(255,215,0,0.4)' }]}>
          <View style={styles.cardHeader}>
            <View style={styles.anonLabelRow}>
              {msgPinned && <MaterialCommunityIcons name="pin" size={12} color="#FFD700" />}
              <MaterialCommunityIcons 
                name={isRevealed ? "email-open-outline" : "email-outline"} 
                size={16} 
                color="#1DB954" 
              />
              <Text style={styles.anonLabel}>
                {msgPinned ? 'PINNED' : isRevealed ? 'REVEALED NOTE' : 'NEW ANONYMOUS NOTE'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity onPress={() => {
                triggerHaptic('light');
                setPinnedMessages(prev => prev.includes(item._id) ? prev.filter(id => id !== item._id) : [...prev, item._id]);
              }}>
                <MaterialCommunityIcons name={msgPinned ? "pin" : "pin-outline"} size={18} color={msgPinned ? "#FFD700" : "#444"} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteMessage(item._id)}>
                <MaterialCommunityIcons name="delete-outline" size={18} color="#FF5252" />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={{ paddingVertical: 4 }}>
            {isRevealed ? (
              <Text style={styles.messageText} numberOfLines={1} ellipsizeMode="tail">
                {item.text}
              </Text>
            ) : (
              <Text style={[styles.messageText, { color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', fontSize: 13 }]}>
                Tap to reveal message...
              </Text>
            )}
          </View>

          <View style={[styles.cardFooter, { marginTop: 4 }]}>
            <Text style={styles.timeLabel}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: '#050505' }]}>

        {/* Header and Tabs are now inside scrollable areas */}

      {loading && !refreshing ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#1DB954" />
        </View>
      ) : activeMainTab === 'inbox' ? (
        <FlatList
          ListHeaderComponent={
            <>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                  <MaterialCommunityIcons name="chevron-left" size={32} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Anonymous Notes</Text>
                <TouchableOpacity onPress={shareNglLink} style={styles.shareIconBtn}>
                  <MaterialCommunityIcons name="share-variant" size={24} color="#1DB954" />
                </TouchableOpacity>
              </View>
              <View style={styles.tabWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContainer}>
                  {[
                    { id: 'my_link', label: 'My Link' },
                    { id: 'inbox', label: 'Inbox', badge: messages.length }
                  ].map(tab => (
                    <TouchableOpacity 
                      key={tab.id} 
                      style={[styles.tabBtn, activeMainTab === tab.id && styles.activeTabBtn]} 
                      onPress={() => setActiveMainTab(tab.id as any)}
                    >
                      <Text style={[styles.tabText, activeMainTab === tab.id && styles.activeTabText]}>{tab.label}</Text>
                      {tab.badge ? (
                        <View style={styles.badge}><Text style={styles.badgeText}>{tab.badge}</Text></View>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Stats Dashboard */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{totalMessages}</Text>
                  <Text style={styles.statLabel}>TOTAL</Text>
                </View>
                <View style={[styles.statCard, { borderColor: 'rgba(29,185,84,0.3)' }]}>
                  <Text style={[styles.statNumber, { color: '#1DB954' }]}>{todayMessages}</Text>
                  <Text style={styles.statLabel}>TODAY</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{thisWeekMessages}</Text>
                  <Text style={styles.statLabel}>THIS WEEK</Text>
                </View>
              </View>

              {/* Question of the Day */}
              <View style={styles.qotdCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <MaterialCommunityIcons name="lightbulb-on" size={18} color="#FFD700" />
                  <Text style={styles.qotdLabel}>QUESTION OF THE DAY</Text>
                </View>
                <Text style={styles.qotdText}>{questionOfTheDay}</Text>
              </View>
            </>
          }
          data={sortedMessages}
          keyExtractor={(item) => item._id || Math.random().toString()}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchMessages(true)} tintColor="#1DB954" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons name="email-off-outline" size={60} color="#222" />
              </View>
              <Text style={styles.emptyTitle}>Your inbox is empty</Text>
              <Text style={styles.emptySub}>Share your link to get messages!</Text>
              <View style={styles.emptyActionRow}>
                <TouchableOpacity style={styles.mainCopyBtn} onPress={copyNglLink}>
                  <Text style={styles.mainCopyBtnText}>COPY LINK</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mainShareBtn} onPress={shareNglLink}>
                  <Text style={styles.mainShareBtnText}>SHARE LINK</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      ) : (
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <MaterialCommunityIcons name="chevron-left" size={32} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Anonymous Notes</Text>
              <TouchableOpacity onPress={shareNglLink} style={styles.shareIconBtn}>
                <MaterialCommunityIcons name="share-variant" size={24} color="#1DB954" />
              </TouchableOpacity>
            </View>
            <View style={styles.tabWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContainer}>
                {[
                  { id: 'my_link', label: 'My Link' },
                  { id: 'inbox', label: 'Inbox', badge: messages.length }
                ].map(tab => (
                  <TouchableOpacity 
                    key={tab.id} 
                    style={[styles.tabBtn, activeMainTab === tab.id && styles.activeTabBtn]} 
                    onPress={() => setActiveMainTab(tab.id as any)}
                  >
                    <Text style={[styles.tabText, activeMainTab === tab.id && styles.activeTabText]}>{tab.label}</Text>
                    {tab.badge ? (
                      <View style={styles.badge}><Text style={styles.badgeText}>{tab.badge}</Text></View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          <LinearGradient 
            colors={['#38ef7d', '#11998e']} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }}
            style={[styles.linkBanner, { flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 0, paddingBottom: 12, marginBottom: 12, marginHorizontal: 50, height: 220, borderWidth: 0, shadowColor: '#38ef7d', shadowOpacity: 0.3, shadowRadius: 15 }]}
          >
             {auth.user?.avatar ? (
               <Image source={{ uri: auth.user.avatar }} style={[styles.avatarPicLarge, { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: '#FFF', marginTop: 16 }]} />
             ) : (
               <View style={[styles.avatarPlaceholderLarge, { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: '#FFF', backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 16 }]}>
                  <Text style={{color: '#FFF', fontSize: 32, fontWeight: '800'}}>{auth.user?.name?.charAt(0).toUpperCase() || 'A'}</Text>
               </View>
             )}
             <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800', marginTop: 0, marginBottom: 0 }}>@{anonSlug || (auth.user?._id ? auth.user._id.substring(0, 8) : 'user')}</Text>

             <View style={{ width: '100%', paddingHorizontal: 0, marginTop: 1 }}>
                <View style={{ width: '100%', marginBottom: 4, maxHeight: 100 }}>
                  <TextInput 
                    style={[{ width: '100%', textAlign: 'center', textAlignVertical: 'center', backgroundColor: 'transparent', borderWidth: 0, paddingVertical: 8, paddingHorizontal: 16, fontSize: 20, fontWeight: '900', marginBottom: 0, color: '#FFF', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 2 }]} 
                    value={sharePrompt} 
                    onChangeText={setSharePrompt} 
                    placeholder="e.g. Ask me anything!"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    maxLength={45}
                    multiline={true}
                    numberOfLines={3}
                  />
                </View>
             </View>
             <View style={{ position: 'absolute', bottom: 14, left: 16 }}>
               <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>{sharePrompt.length}/45</Text>
             </View>
             <View style={{ position: 'absolute', bottom: 10, right: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {sharePrompt !== SHARE_PROMPTS[0] && (
                  <TouchableOpacity onPress={() => { setSharePrompt(SHARE_PROMPTS[0]); triggerHaptic('light'); }}>
                    <MaterialCommunityIcons name="restore" size={22} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={togglePrompt}>
                  <Animated.View style={{ transform: [{ rotate: diceSpin }] }}>
                    <MaterialCommunityIcons name="dice-5" size={26} color="#FFF" />
                  </Animated.View>
                </TouchableOpacity>
             </View>
          </LinearGradient>


          <View style={{ marginHorizontal: 32, marginBottom: 8, marginTop: 10 }}>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>STEP 1: COPY YOUR LINK</Text>
          </View>
          <View style={[styles.linkBanner, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingVertical: 24, marginTop: 0 }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
               <Text style={[styles.linkTitle, { textAlign: 'center', fontSize: 11 }]}>YOUR SECRET LINK</Text>

            </View>
            <View style={[styles.bannerActions, { width: '100%', justifyContent: 'center', gap: 16 }]}>
              <TouchableOpacity style={[styles.copyLinkBtn, { width: 48, height: 48, borderRadius: 24 }]} onPress={copyNglLink}>
                <MaterialCommunityIcons name="content-copy" size={20} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.editLinkBtn, { width: 48, height: 48, borderRadius: 24 }]} onPress={() => { triggerHaptic('light'); setShowSlugModal(true); }}>
                <MaterialCommunityIcons name="pencil" size={20} color="#000" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginHorizontal: 32, marginBottom: 12, marginTop: 20 }}>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>STEP 2: SHARE ON INSTAGRAM</Text>
          </View>
          <TouchableOpacity style={styles.igShareBanner} activeOpacity={0.9} onPress={shareNglLink}>
            <LinearGradient colors={['#1DB954', '#1AA34A']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.igGradient}>
              <View style={styles.igIconWrapper}>
                <MaterialCommunityIcons name="instagram" size={24} color="#FFF" />
              </View>
              <View style={styles.igTextWrapper}>
                <Text style={styles.igShareTitle}>Share on Instagram Story</Text>
                <Text style={styles.igShareSub}>Get anonymous messages from your friends</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#FFF" style={{ opacity: 0.8 }} />
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
        </View>
      )}


      {/* Share/Reply Modal */}
      <Modal visible={!!sharingMsg} transparent animationType="slide" onRequestClose={() => setSharingMsg(null)}>
        <View style={styles.shareModalOverlay}>
          <View style={styles.sharePreviewRoot}>
            <View style={[styles.shareStoryCard, { backgroundColor: Array.isArray(shareTheme) ? 'transparent' : shareTheme, shadowColor: Array.isArray(shareTheme) ? shareTheme[0] : shareTheme }]}>
              {Array.isArray(shareTheme) && (
                 <LinearGradient colors={shareTheme} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} start={{x:0, y:0}} end={{x:1, y:1}} />
              )}
              <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 20 }]}>
                <MaterialCommunityIcons name="incognito" size={180} color="#FFF" style={{ position: 'absolute', top: '-15%', right: '-20%', opacity: 0.1, transform: [{ rotate: '15deg' }] }} />
                <MaterialCommunityIcons name="music-note-eighth" size={140} color="#FFF" style={{ position: 'absolute', bottom: '-10%', left: '-15%', opacity: 0.1, transform: [{ rotate: '-20deg' }] }} />
                <MaterialCommunityIcons name="headphones" size={100} color="#FFF" style={{ position: 'absolute', top: '40%', left: '-5%', opacity: 0.15, transform: [{ rotate: '30deg' }] }} />
                <View style={{ position: 'absolute', top: -50, left: 40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                <View style={{ position: 'absolute', bottom: -50, right: 60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)' }} />
              </View>

              <View style={styles.shareHeader}>
                <View style={styles.shareIconCircle}>
                  <MaterialCommunityIcons name="incognito" size={24} color="#FFF" />
                </View>
                <Text style={styles.shareHeaderText}>ANONYMOUS ASK</Text>
              </View>
              <Text style={styles.shareQuestionText}>{sharingMsg?.text}</Text>
              
              <View style={styles.shareReplyWrapper}>
                {replyText ? (
                  <View style={styles.shareReplyGlass}>
                    <Text style={styles.shareReplyText}>{replyText}</Text>
                  </View>
                ) : (
                  <View style={styles.shareReplyPlaceholderGlass}>
                    <Text style={styles.sharePlaceholderText}>Your reply will appear here...</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.shareBrandingRow}>
                <View style={styles.SyncognitoBadge}>
                  <MaterialCommunityIcons name="music" size={10} color="#FFF" />
                  <Text style={styles.brandingText}>Syncognito</Text>
                </View>
              </View>
            </View>

            <View style={styles.replyInputArea}>
              <View style={styles.themeRow}>
                <Text style={styles.themeLabel}>Theme:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeScrollRow}>
                  {SHARE_THEMES.map((theme: string) => (
                    <TouchableOpacity 
                      key={theme} 
                      onPress={() => setShareTheme(theme)} 
                      style={[
                        styles.themeColorCircle, 
                        { backgroundColor: theme },
                        shareTheme === theme && styles.themeColorCircleActive
                      ]}
                    />
                  ))}
                  <TouchableOpacity 
                     onPress={() => setShowGradientModal(true)}
                     style={[styles.themeColorCircle, { backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }]}
                  >
                     <MaterialCommunityIcons name="plus" size={12} color="#FFF" />
                  </TouchableOpacity>
                </ScrollView>
              </View>
              <TextInput
                style={styles.replyInput}
                placeholder="Type your reply..."
                placeholderTextColor="#666"
                value={replyText}
                onChangeText={setReplyText}
                multiline
              />
              <View style={styles.shareActionRow}>
                <TouchableOpacity style={styles.shareCancel} onPress={() => { setSharingMsg(null); setReplyText(''); }}>
                  <Text style={styles.shareCancelText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                   style={styles.shareConfirm} 
                   onPress={async () => {
                     await Share.share({
                       message: `Anonymous Note: "${sharingMsg?.text}"\n\nMy Reply: "${replyText}"\n\nSend me ghost notes too: https://syncognito-nine.vercel.app/anon/${anonSlug || auth.user?._id}`
                     });
                   }}
                >
                  <MaterialCommunityIcons name="share-variant" size={20} color="#000" />
                  <Text style={styles.shareConfirmText}>SHARE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Link Customization Modal */}
      <Modal visible={showSlugModal} transparent animationType="fade" onRequestClose={() => setShowSlugModal(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowSlugModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.slugModal}>
            <Text style={styles.slugModalTitle}>Customize Your Link</Text>
            <Text style={styles.slugModalSub}>Choose a unique username for your secret inbox.</Text>
            
            <View style={styles.slugInputRow}>
              <Text style={styles.slugPrefix}>syncognito-nine.vercel.app/anon/</Text>
              <TextInput
                style={styles.slugInput}
                value={newSlug}
                onChangeText={setNewSlug}
                placeholder="username"
                placeholderTextColor="#444"
                autoCapitalize="none"
              />
            </View>
 
            <View style={styles.slugActionRow}>
              <TouchableOpacity style={styles.slugCancel} onPress={() => setShowSlugModal(false)}>
                <Text style={styles.slugCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.slugConfirm} onPress={updateSlug} disabled={updatingSlug}>
                {updatingSlug ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.slugConfirmText}>SAVE</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Gradient Builder Modal */}
      <Modal visible={showGradientModal} transparent animationType="slide" onRequestClose={() => setShowGradientModal(false)}>
        <TouchableOpacity 
          style={styles.shareModalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowGradientModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.gradientModalRoot}>
            <Text style={styles.gradientTitle}>Create Gradient</Text>
            
            <View style={styles.gradientPreviewBox}>
               <LinearGradient colors={[gradColor1, gradColor2]} style={StyleSheet.absoluteFill} start={{x:0, y:0}} end={{x:1, y:1}} />
               <Text style={styles.gradientPreviewText}>Preview</Text>
            </View>

            <Text style={styles.gradientLabel}>Select Color 1</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gradColorRow}>
              {GRADIENT_PALETTE.map(c => (
                <TouchableOpacity key={c} onPress={() => setGradColor1(c)} style={[styles.gradColorCircle, { backgroundColor: c }, gradColor1 === c && styles.themeColorCircleActive]} />
              ))}
            </ScrollView>

            <Text style={styles.gradientLabel}>Select Color 2</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gradColorRow}>
              {GRADIENT_PALETTE.map(c => (
                <TouchableOpacity key={c} onPress={() => setGradColor2(c)} style={[styles.gradColorCircle, { backgroundColor: c }, gradColor2 === c && styles.themeColorCircleActive]} />
              ))}
            </ScrollView>

            <View style={styles.shareActionRow}>
              <TouchableOpacity style={styles.shareCancel} onPress={() => setShowGradientModal(false)}>
                <Text style={styles.shareCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                 style={styles.shareConfirm} 
                 onPress={() => {
                   setShareTheme([gradColor1, gradColor2]);
                   setShowGradientModal(false);
                 }}
              >
                <Text style={styles.shareConfirmText}>APPLY</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingTop: 15, 
    paddingBottom: 15,
    backgroundColor: '#050505',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  shareIconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(29, 185, 84, 0.15)', borderRadius: 22 },
  
  tabWrapper: { marginBottom: 6 },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 8 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: '#333', backgroundColor: 'transparent' },
  activeTabBtn: { backgroundColor: '#1DB954', borderColor: '#1DB954' },
  tabText: { color: '#888', fontWeight: '700', fontSize: 12 },
  activeTabText: { color: '#000' },
  
  badge: { backgroundColor: '#EF5350', marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  
  linkBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A0A0A', marginHorizontal: 32, marginBottom: 16, marginTop: 4, paddingVertical: 24, paddingHorizontal: 18, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(29, 185, 84, 0.3)', shadowColor: '#1DB954', shadowOpacity: 0.15, shadowRadius: 20, elevation: 5 },
  bannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  linkInfo: { flex: 1 },
  linkTitle: { color: '#1DB954', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  linkSub: { color: '#888', fontSize: 12, marginTop: 4, fontWeight: '600' },
  avatarPicLarge: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholderLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(29, 185, 84, 0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1DB954' },
  
  igShareBanner: { marginHorizontal: 16, borderRadius: 20, shadowColor: '#FD1D1D', shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 },
  igGradient: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20 },
  igIconWrapper: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  igTextWrapper: { flex: 1 },
  igShareTitle: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.5, marginBottom: 2 },
  igShareSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  
  promptContainer: { paddingHorizontal: 16, marginTop: 10 },
  promptLabel: { color: '#888', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  promptInput: { backgroundColor: '#111', borderRadius: 16, padding: 16, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: '#222', marginBottom: 12 },
  chipsScroll: { gap: 8, paddingRight: 20 },
  promptChip: { backgroundColor: 'rgba(29, 185, 84, 0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(29, 185, 84, 0.3)' },
  promptChipText: { color: '#1DB954', fontSize: 12, fontWeight: '700' },
  
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 },
  messageCard: { backgroundColor: '#0D0D0D', borderRadius: 20, padding: 12, marginBottom: 10, borderWidth: 1.5, borderColor: 'rgba(29, 185, 84, 0.15)', shadowColor: '#1DB954', shadowOpacity: 0.08, shadowRadius: 15, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  anonLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(29, 185, 84, 0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  anonLabel: { color: '#1DB954', fontSize: 8, fontWeight: '800', letterSpacing: 1.5 },
  messageText: { color: '#FFF', fontSize: 15, lineHeight: 22, fontWeight: '600', letterSpacing: 0.2 },
  timeLabel: { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 40 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(29,185,84,0.3)', shadowColor: '#1DB954', shadowOpacity: 0.2, shadowRadius: 20, elevation: 8 },
  emptyTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 },
  emptySub: { color: '#777', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24, fontWeight: '500' },
  mainShareBtn: { backgroundColor: '#1DB954', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, shadowColor: '#1DB954', shadowOpacity: 0.4, shadowRadius: 20, elevation: 10, flex: 1, alignItems: 'center' },
  mainShareBtnText: { color: '#000', fontWeight: '800', fontSize: 10, marginTop: 4, letterSpacing: 1.5 },
  emptyActionRow: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 10 },
  mainCopyBtn: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', flex: 1, alignItems: 'center' },
  mainCopyBtnText: { color: '#FFF', fontWeight: '800', fontSize: 10, marginTop: 4, letterSpacing: 1.5 },

  avatarPic: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#1DB954' },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(29, 185, 84, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  replyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1DB954', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#1ED760', shadowColor: '#1DB954', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  replyBtnText: { color: '#000', fontSize: 8, fontWeight: '800', marginTop: 4, letterSpacing: 0.5 },

  shareModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'flex-end' },
  sharePreviewRoot: { backgroundColor: '#050505', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: '#1A1A1A' },
  shareStoryCard: { borderRadius: 20, padding: 16, minHeight: 120, overflow: 'hidden' },
  shareHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  shareIconCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 5 },
  shareHeaderText: { color: '#FFF', fontWeight: '900', fontSize: 9, marginTop: 2, letterSpacing: 1.5 },
  shareQuestionText: { color: '#FFF', fontSize: 18, fontWeight: '900', lineHeight: 24, marginBottom: 10, fontStyle: 'italic', letterSpacing: 0.5, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  shareReplyWrapper: { marginTop: 4 },
  shareReplyGlass: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10 },
  shareReplyText: { color: '#FFF', fontSize: 14, fontWeight: '800', lineHeight: 20 },
  shareReplyPlaceholderGlass: { borderStyle: 'dashed', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 12, padding: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  sharePlaceholderText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  shareBrandingRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  SyncognitoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  brandingText: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  brandingHandle: { color: 'rgba(0,0,0,0.5)', fontSize: 10, fontWeight: '800' },
  
  replyInputArea: { marginTop: 30 },
  replyInput: { backgroundColor: '#0B0B0B', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, color: '#FFF', fontSize: 15, textAlignVertical: 'top', minHeight: 56, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(29, 185, 84, 0.4)' },
  shareActionRow: { flexDirection: 'row', gap: 16 },
  shareCancel: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  shareCancelText: { color: '#888', fontWeight: '800', letterSpacing: 1 },
  shareConfirm: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 14, backgroundColor: '#1DB954', shadowColor: '#1DB954', shadowOpacity: 0.3, shadowRadius: 15, elevation: 5 },
  shareConfirmText: { color: '#000', fontWeight: '800', fontSize: 10, marginTop: 4, letterSpacing: 1.5 },

  bannerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  copyLinkBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#1DB954', justifyContent: 'center', alignItems: 'center', shadowColor: '#1DB954', shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  editLinkBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#1DB954', justifyContent: 'center', alignItems: 'center', shadowColor: '#1DB954', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  slugModal: { backgroundColor: '#0D0D0D', borderRadius: 32, padding: 30, width: '100%', borderWidth: 1, borderColor: '#1F1F1F', shadowColor: '#1DB954', shadowOpacity: 0.1, shadowRadius: 30, elevation: 10 },
  slugModalTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: 10, letterSpacing: 0.5 },
  slugModalSub: { color: '#888', fontSize: 14, marginBottom: 24, lineHeight: 20, fontWeight: '500' },
  slugInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#050505', borderRadius: 16, paddingHorizontal: 20, height: 56, borderWidth: 1, borderColor: '#222', marginBottom: 30 },
  slugPrefix: { color: '#666', fontSize: 14, fontWeight: '700' },
  slugInput: { flex: 1, color: '#1DB954', fontSize: 15, fontWeight: '900', paddingLeft: 4 },
  slugActionRow: { flexDirection: 'row', gap: 16 },
  slugCancel: { flex: 1, height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 16, backgroundColor: '#151515', borderWidth: 1, borderColor: '#222' },
  slugCancelText: { color: '#888', fontWeight: '800', letterSpacing: 0.5 },
  slugConfirm: { flex: 2, height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 16, backgroundColor: '#1DB954', shadowColor: '#1DB954', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  slugConfirmText: { color: '#000', fontWeight: '800', fontSize: 10, marginTop: 4, letterSpacing: 1 },

  suggestionsRow: { maxHeight: 40, marginBottom: 12 },
  suggestionsContent: { paddingHorizontal: 20, gap: 10 },
  suggestionChip: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center' },
  suggestionText: { color: '#AAA', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  suggestionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, marginTop: 10, marginBottom: 8 },
  suggestionsTitle: { color: '#666', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  catScroll: { maxHeight: 36, marginBottom: 16 },
  catContent: { paddingHorizontal: 20, gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  activeCatChip: { backgroundColor: '#1DB954', borderColor: '#1DB954' },
  catChipText: { color: '#666', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  activeCatChipText: { color: '#000' },
  
  themeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20, gap: 16 },
  themeLabel: { color: '#888', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  themeScrollRow: { gap: 12, paddingRight: 30 },
  themeColorCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#333' },
  themeColorCircleActive: { borderColor: '#FFF', borderWidth: 3 },

  gradientModalRoot: { backgroundColor: '#0A0A0A', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: '#1F1F1F' },
  gradientTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  gradientPreviewBox: { height: 100, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#333' },
  gradientPreviewText: { color: '#FFF', fontSize: 24, fontWeight: '900', fontStyle: 'italic', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 4 },
  gradientLabel: { color: '#AAA', fontSize: 13, fontWeight: '800', marginBottom: 10 },
  gradColorRow: { gap: 12, paddingRight: 20, marginBottom: 24 },
  gradColorCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#333' },

  // Stats Dashboard
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#0D0D0D', borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statNumber: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#555', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginTop: 4 },

  // Question of the Day
  qotdCard: { marginHorizontal: 16, backgroundColor: '#0D0D0D', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.15)' },
  qotdLabel: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  qotdText: { color: '#CCC', fontSize: 14, fontWeight: '600', lineHeight: 20 },
});

