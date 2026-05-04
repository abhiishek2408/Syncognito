import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, RefreshControl, Dimensions, Animated, Share, TextInput, Modal, ScrollView, Vibration, Image, ImageBackground
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import Video from 'react-native-video';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import API_URL from '../utils/api';
import { useToast } from '../context/ToastContext';
import Clipboard from '@react-native-clipboard/clipboard';
import { Swipeable } from 'react-native-gesture-handler';
import ViewShot from 'react-native-view-shot';
import RNShare from 'react-native-share';


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

const GRADIENT_PALETTE = ['#FF0000', '#FF7F00', '#FFD700', '#00FF00', '#1DB954', '#00FFFF', '#0000FF', '#8A2BE2', '#FF1493', '#000000', '#FFFFFF'];
const FONT_OPTIONS = ['Inter', 'Roboto', 'Outfit', 'System'];



export default function NglScreen({ navigation }: any) {
  const { theme, accentColor, isDarkMode } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);

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
  
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const isPremium = auth.user?.isPremium || false;
  
  // Gradient Builder States
  const [showGradientModal, setShowGradientModal] = useState(false);
  const [gradColor1, setGradColor1] = useState('#8A2BE2');
  const [gradColor2, setGradColor2] = useState('#1DB954');
  
  const [activeMainTab, setActiveMainTab] = useState<'inbox' | 'my_link'>('my_link');
  const [sharePrompt, setSharePrompt] = useState('Send me anonymous notes!');
  const [cardThemeIndex, setCardThemeIndex] = useState(0);

  const viewShotRef = useRef<any>(null);
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [bgMediaUri, setBgMediaUri] = useState<string | null>(null);
  const [bgMediaType, setBgMediaType] = useState<'image' | 'video' | null>(null);
  const [fontFamily, setFontFamily] = useState('System');

  const cycleTheme = () => {
    triggerHaptic('light');
    setCardThemeIndex((prev) => (prev + 1) % CARD_THEMES.length);
  };
  const [revealedMessages, setRevealedMessages] = useState<string[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<string[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [creatingPoll, setCreatingPoll] = useState(false);

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

  const LINK_TEMPLATES = [
    { id: 'general', label: 'General', prompt: 'Send me anonymous notes!', icon: 'incognito', colors: ['#38ef7d', '#11998e'] },
    { id: 'confession', label: 'Confession', prompt: 'Confess something secret to me...', icon: 'heart-broken', colors: ['#FF1493', '#C71585'] },
    { id: 'rate', label: 'Rate Me', prompt: 'Rate my profile 1-10 🕵️‍♂️', icon: 'star-circle', colors: ['#8A2BE2', '#4B0082'] },
    { id: 'poll', label: 'Poll', prompt: 'Create an anonymous poll!', icon: 'chart-bar', colors: ['#FFD700', '#FFA500'] },
  ];
  const todayIndex = new Date().getDate() % DAILY_PROMPTS.length;
  const questionOfTheDay = DAILY_PROMPTS[todayIndex];

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

  const createPoll = async () => {
    if (!pollQuestion.trim() || pollOptions.some(o => !o.trim())) return;
    setCreatingPoll(true);
    try {
      const resp = await axios.post(`${API_URL}/api/ngl/poll/create`, 
        { question: pollQuestion, options: pollOptions },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      setPolls(prev => [resp.data, ...prev]);
      setShowPollModal(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      showToast('Poll created!', 'success');
    } catch (err) {
      showToast('Failed to create poll', 'error');
    } finally {
      setCreatingPoll(false);
    }
  };

  const sortedInbox = [...messages, ...polls.map(p => ({ ...p, isPoll: true }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const SHARE_PROMPTS = ["Send me anonymous notes!", "Ask me anything", "What vibe do I give off?", "Confess a secret", "What's my red flag?", "Rate me out of 10!"];
  const togglePrompt = () => {
    const currentIndex = SHARE_PROMPTS.indexOf(sharePrompt);
    const nextIndex = (currentIndex + 1) % SHARE_PROMPTS.length;
    setSharePrompt(SHARE_PROMPTS[nextIndex]);
    triggerHaptic('light');
    diceAnim.setValue(0);
    Animated.timing(diceAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };
  
  const diceSpin = diceAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (type === 'light') Vibration.vibrate(10);
    else if (type === 'medium') Vibration.vibrate(30);
    else Vibration.vibrate(60);
  };

  const updateSlug = async () => {
    if (!newSlug.trim()) return;
    setUpdatingSlug(true);
    try {
      const resp = await axios.patch(`${API_URL}/api/ngl/slug`, 
        { slug: newSlug },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      setAnonSlug(resp.data.slug);
      if (auth.setUser) auth.setUser({ ...auth.user, anonSlug: resp.data.slug });
      setShowSlugModal(false);
      showToast('Link updated!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Update failed', 'error');
    } finally {
      setUpdatingSlug(false);
    }
  };

  const copyNglLink = () => {
    const link = `https://syncognito-nine.vercel.app/anon/${anonSlug || auth.user?._id}`;
    Clipboard.setString(link);
    triggerHaptic('medium');
    showToast('Link copied to clipboard!', 'success');
  };

  const shareNglLink = async () => {
     try {
       if (!viewShotRef.current) return;
       const uri = await viewShotRef.current.capture();
       await RNShare.open({
         url: uri,
         title: 'Share my NGL Link',
         message: `Send me anonymous notes! 🕵️‍♂️\nhttps://syncognito-nine.vercel.app/anon/${anonSlug || auth.user?._id}`
       });
     } catch (err) {
       console.warn('Share error:', err);
     }
  };

  const openThemeEditor = () => setShowThemeEditor(true);
  const closeThemeEditor = () => setShowThemeEditor(false);

  const pickImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
      });
      if (result.assets && result.assets.length > 0 && result.assets[0].uri) {
        setBgMediaUri(result.assets[0].uri);
        setBgMediaType('image');
      }
    } catch (err) {
      console.warn('Pick image error:', err);
    }
  };

  const pickVideo = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'video',
        quality: 1,
        selectionLimit: 1,
      });
      if (result.assets && result.assets.length > 0 && result.assets[0].uri) {
        setBgMediaUri(result.assets[0].uri);
        setBgMediaType('video');
      }
    } catch (err) {
      console.warn('Pick video error:', err);
    }
  };

  useEffect(() => {
    if (auth.user?.anonSlug) {
      setAnonSlug(auth.user.anonSlug);
      setNewSlug(auth.user.anonSlug);
    }
  }, [auth.user?.anonSlug]);

  // State for Verified Ghost Badge
  const VERIFIED_VIEW_THRESHOLD = 1000;
  const [isVerifiedGhost, setIsVerifiedGhost] = useState(false);

  // Fetch total view count for the current user
  const fetchViewCount = async () => {
    if (!auth.user?._id) return;
    try {
      const resp = await axios.get(`${API_URL}/api/ngl/views/${auth.user._id}`);
      const total = resp.data.totalViews || 0;
      setIsVerifiedGhost(total >= VERIFIED_VIEW_THRESHOLD);
    } catch (err) {
      console.warn('View count fetch error:', err);
    }
  };

  useEffect(() => {
    fetchViewCount();
  }, [auth.user?._id]);

  const fetchMessages = useCallback(async (isRefresh = false) => {
    if (!auth.token) return;
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    try {
      const [msgResp, pollResp] = await Promise.all([
        axios.get(`${API_URL}/api/ngl/me`, { headers: { Authorization: `Bearer ${auth.token}` } }),
        axios.get(`${API_URL}/api/ngl/poll/me`, { headers: { Authorization: `Bearer ${auth.token}` } })
      ]);
      const messagesData = Array.isArray(msgResp.data) ? msgResp.data : [];
      const pollsData = Array.isArray(pollResp.data) ? pollResp.data : [];
      
      setMessages(messagesData);
      setPolls(pollsData);
      setPinnedMessages(messagesData.filter((m: any) => m.isPinned).map((m: any) => m._id));
      setRevealedMessages(messagesData.filter((m: any) => m.isRead).map((m: any) => m._id));
    } catch (err: any) {
      console.warn('NGL fetch error details:', err?.response?.data || err.message);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auth.token, showToast]);

  const fetchAnalytics = async () => {
    if (!auth.token) return;
    setLoadingAnalytics(true);
    try {
      const resp = await axios.get(`${API_URL}/api/ngl/analytics`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      setAnalyticsData(resp.data);
      setShowAnalyticsModal(true);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to load analytics', 'error');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const renderPollItem = (item: any) => {
    const totalVotes = item.options.reduce((acc: number, opt: any) => acc + opt.votes, 0);
    return (
      <View style={[dynamicStyles.messageCard, { borderColor: '#FFD700', padding: 16 }]}>
        <View style={dynamicStyles.cardHeader}>
          <View style={dynamicStyles.anonLabelRow}>
            <MaterialCommunityIcons name="chart-bar" size={16} color="#FFD700" />
            <Text style={[dynamicStyles.anonLabel, { color: '#FFD700' }]}>ANONYMOUS POLL</Text>
          </View>
          <Text style={dynamicStyles.timeLabel}>{totalVotes} VOTES</Text>
        </View>
        
        <Text style={[dynamicStyles.messageText, { marginBottom: 16, fontSize: 18 }]}>{item.question}</Text>
        
        <View style={{ gap: 10 }}>
          {item.options.map((opt: any) => {
            const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
            return (
              <View key={opt._id} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{opt.text}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '800' }}>{percentage}% ({opt.votes})</Text>
                </View>
                <View style={{ height: 8, backgroundColor: theme.surface, borderRadius: 4, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${percentage}%`, backgroundColor: '#FFD700' }} />
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
           <TouchableOpacity onPress={() => {
              const shareUrl = `https://syncognito-nine.vercel.app/poll/${item._id}`;
              Clipboard.setString(shareUrl);
              showToast('Poll link copied!', 'success');
           }}>
              <MaterialCommunityIcons name="share-variant" size={20} color={theme.textSecondary} />
           </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderMessageItem = ({ item }: { item: any }) => {
    const isRevealed = revealedMessages.includes(item._id) || item.isRead;
    return (
       <View style={dynamicStyles.messageCard}>
         <Text style={dynamicStyles.messageText}>{isRevealed ? item.text : 'Hidden note'}</Text>
       </View>
    );
  };

  return (
    <View style={[dynamicStyles.container, { backgroundColor: theme.background }]}>
      <Modal visible={showPollModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: theme.surface, padding: 20, borderRadius: 20 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>Create Poll</Text>
            <TextInput style={{ borderBottomWidth: 1, borderBottomColor: theme.border, color: theme.text, padding: 10, marginVertical: 10 }} placeholder="Question?" value={pollQuestion} onChangeText={setPollQuestion} />
            {pollOptions.map((opt, i) => (
              <TextInput key={i} style={{ borderBottomWidth: 1, borderBottomColor: theme.border, color: theme.text, padding: 10 }} placeholder={`Option ${i+1}`} value={opt} onChangeText={(val) => setPollOptions(p => p.map((v, idx) => idx === i ? val : v))} />
            ))}
            <TouchableOpacity style={{ backgroundColor: accentColor, padding: 15, borderRadius: 10, marginTop: 15 }} onPress={createPoll}>
              <Text style={{ textAlign: 'center', color: '#FFF' }}>{creatingPoll ? 'Creating...' : 'Post Poll'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {loading && !refreshing ? (
        <View style={dynamicStyles.loader}><ActivityIndicator size="large" color={accentColor} /></View>
      ) : activeMainTab === 'inbox' ? (
        <FlatList
          ListHeaderComponent={
            <>
              <View style={dynamicStyles.header}>
                <Text style={dynamicStyles.headerTitle}>Anonymous</Text>
                {isPremium && (
                  <TouchableOpacity onPress={fetchAnalytics} style={dynamicStyles.shareIconBtn}>
                    {loadingAnalytics ? <ActivityIndicator size="small" color="#8A2BE2" /> : <MaterialCommunityIcons name="chart-box" size={22} color="#8A2BE2" />}
                  </TouchableOpacity>
                )}
              </View>
              <View style={dynamicStyles.tabWrapper}>
                <View style={dynamicStyles.tabContainer}>
                  {[
                    { id: 'my_link', label: 'My Link' },
                    { id: 'inbox', label: 'Inbox', badge: messages.length + polls.length }
                  ].map(tab => (
                    <TouchableOpacity 
                      key={tab.id} 
                      style={[dynamicStyles.tabBtn, activeMainTab === tab.id && dynamicStyles.activeTabBtn]} 
                      onPress={() => setActiveMainTab(tab.id as any)}
                    >
                      <Text style={[dynamicStyles.tabText, activeMainTab === tab.id && dynamicStyles.activeTabText]}>{tab.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          }
          data={sortedInbox}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => item.isPoll ? renderPollItem(item) : renderMessageItem({ item })}
          onRefresh={() => fetchMessages(true)}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={{ marginTop: 50, alignItems: 'center' }}>
              <MaterialCommunityIcons name="inbox-outline" size={60} color={theme.textSecondary} />
              <Text style={dynamicStyles.emptyTitle}>No messages yet</Text>
              <Text style={dynamicStyles.emptySub}>Share your link to get messages!</Text>
            </View>
          }
        />
      ) : (
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <View style={dynamicStyles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity onPress={() => navigation.navigate('Home')} style={dynamicStyles.backBtnMini}>
                  <MaterialCommunityIcons name="chevron-left" size={28} color="#000" />
                </TouchableOpacity>
                <Text style={dynamicStyles.headerTitle}>
                  Anonymous
                </Text>
              </View>
            </View>
            <View style={dynamicStyles.tabWrapper}>
              <View style={dynamicStyles.tabContainer}>
                {[
                  { id: 'my_link', label: 'My Link' },
                  { id: 'inbox', label: 'Inbox', badge: messages.length }
                ].map(tab => (
                  <TouchableOpacity 
                    key={tab.id} 
                    style={[dynamicStyles.tabBtn, activeMainTab === tab.id && dynamicStyles.activeTabBtn]} 
                    onPress={() => setActiveMainTab(tab.id as any)}
                  >
                    <Text style={[dynamicStyles.tabText, activeMainTab === tab.id && dynamicStyles.activeTabText]}>{tab.label}</Text>
                    {tab.badge ? (
                      <View style={dynamicStyles.badge}><Text style={dynamicStyles.badgeText}>{tab.badge}</Text></View>
                    ) : null}
                  </TouchableOpacity>
                ))}
            </View>
          </View>

          {/* Template Selector */}
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={[dynamicStyles.promptLabel, { marginBottom: 12 }]}>CHOOSE TEMPLATE</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {LINK_TEMPLATES.map(tpl => {
                const isActive = sharePrompt === tpl.prompt;
                return (
                  <TouchableOpacity 
                    key={tpl.id}
                    onPress={() => {
                      if (tpl.id === 'poll') {
                         setShowPollModal(true);
                         return;
                      }
                      setSharePrompt(tpl.prompt);
                      const tIdx = CARD_THEMES.findIndex(c => c[0] === tpl.colors[0]);
                      if (tIdx !== -1) setCardThemeIndex(tIdx);
                      triggerHaptic('medium');
                    }}
                    style={{ 
                      flex: 1, 
                      backgroundColor: isActive ? accentColor : theme.surface, 
                      paddingVertical: 12, 
                      borderRadius: 16, 
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: isActive ? accentColor : theme.border,
                      shadowColor: isActive ? accentColor : '#000',
                      shadowOpacity: isActive ? 0.2 : 0,
                      shadowRadius: 5,
                      elevation: isActive ? 4 : 0
                    }}
                  >
                    <MaterialCommunityIcons name={tpl.icon as any} size={22} color={isActive ? theme.background : theme.textSecondary} />
                    <Text style={{ 
                      color: isActive ? theme.background : theme.textSecondary, 
                      fontSize: 10, 
                      fontWeight: '800', 
                      marginTop: 6,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5
                    }}>{tpl.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <LinearGradient 
            colors={cardThemeIndex === 0 ? ['#434343', '#000000'] : CARD_THEMES[cardThemeIndex]} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }}
            style={[dynamicStyles.linkBanner, { 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'flex-start', 
              paddingTop: 0, 
              paddingBottom: 12, 
              marginBottom: 30, 
              marginHorizontal: SCREEN_WIDTH * 0.12, 
              height: SCREEN_WIDTH * 0.62, 
              borderWidth: 0, 
              shadowColor: cardThemeIndex === 0 ? '#434343' : CARD_THEMES[cardThemeIndex][0], 
              shadowOpacity: 0.3, 
              shadowRadius: 15 
            }]}
          >
            <TouchableOpacity 
              style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }} 
              onPress={cycleTheme}
            >
              <MaterialCommunityIcons name="palette" size={16} color="#FFF" />
            </TouchableOpacity>
             {auth.user?.avatar ? (
               <Image source={{ uri: auth.user.avatar }} style={[dynamicStyles.avatarPicLarge, { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: '#FFF', marginTop: 16 }]} />
             ) : (
               <View style={[dynamicStyles.avatarPlaceholderLarge, { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: '#FFF', backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 16 }]}>
                  <Text style={{color: '#FFF', fontSize: 32, fontWeight: '800'}}>{auth.user?.name?.charAt(0).toUpperCase() || 'A'}</Text>
               </View>
             )}
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 0, marginBottom: 0 }}>
               <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>@{anonSlug || (auth.user?._id ? auth.user._id.substring(0, 8) : 'user')}</Text>
               {isVerifiedGhost && (
                 <MaterialCommunityIcons name="check-decagram" size={14} color="#00BFFF" />
               )}
             </View>

             <View style={{ width: '100%', paddingHorizontal: 0, marginTop: 1 }}>
                <View style={{ width: '100%', marginBottom: 4, maxHeight: 100 }}>
                    <TextInput 
                      style={[{ width: '100%', textAlign: 'center', textAlignVertical: 'center', backgroundColor: 'transparent', borderWidth: 0, paddingVertical: 8, paddingHorizontal: 16, fontSize: 18, fontWeight: '900', marginBottom: 0, color: '#FFF', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 2 }]} 
                      value={sharePrompt} 
                      onChangeText={setSharePrompt} 
                      placeholder="e.g. Ask me anything!"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      multiline={true}
                      numberOfLines={3}
                    />
                </View>
             </View>
             <View style={{ position: 'absolute', bottom: 10, right: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {sharePrompt !== SHARE_PROMPTS[0] && (
                  <TouchableOpacity onPress={() => { setSharePrompt(SHARE_PROMPTS[0]); triggerHaptic('light'); }}>
                    <MaterialCommunityIcons name="restore" size={22} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  onPress={togglePrompt}
                  style={{ 
                    backgroundColor: 'rgba(255,255,255,0.2)', 
                    padding: 8, 
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.3)'
                  }}
                >
                  <Animated.View style={{ transform: [{ rotate: diceSpin }] }}>
                    <MaterialCommunityIcons name="auto-fix" size={24} color="#FFF" />
                  </Animated.View>
                </TouchableOpacity>
             </View>
          </LinearGradient>

          <View style={{ marginHorizontal: SCREEN_WIDTH * 0.05, marginBottom: 12, marginTop: 4, alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontSize: Math.min(16, SCREEN_WIDTH * 0.045), fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' }}>STEP 1: COPY YOUR LINK</Text>
          </View>
          
          <View style={[dynamicStyles.linkBanner, { flexDirection: 'column', padding: 12, marginTop: 0, marginHorizontal: 16 }]}>
            <Text style={[dynamicStyles.linkTitle, { marginBottom: 12, marginLeft: 4 }]}>YOUR SECRET LINK</Text>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', 
              borderRadius: 16, 
              padding: 6,
              borderWidth: 1,
              borderColor: theme.border
            }}>
              <View style={{ flex: 1, paddingHorizontal: 12 }}>
                <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                  syncognito.app/anon/{anonSlug || 'yourname'}
                </Text>
              </View>
              <TouchableOpacity 
                style={{ 
                  backgroundColor: accentColor, 
                  padding: 12, 
                  borderRadius: 12,
                  shadowColor: accentColor,
                  shadowOpacity: 0.3,
                  shadowRadius: 5,
                  elevation: 3
                }} 
                onPress={copyNglLink}
              >
                <MaterialCommunityIcons name="content-copy" size={20} color={theme.background} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginHorizontal: SCREEN_WIDTH * 0.05, marginBottom: 12, marginTop: 16, alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontSize: Math.min(16, SCREEN_WIDTH * 0.045), fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' }}>STEP 2: SHARE ON INSTAGRAM</Text>
          </View>
          <TouchableOpacity style={dynamicStyles.igShareBanner} activeOpacity={0.9} onPress={shareNglLink}>
            <LinearGradient colors={[accentColor, accentColor + 'DD']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={dynamicStyles.igGradient}>
              <View style={dynamicStyles.igIconWrapper}>
                <MaterialCommunityIcons name="instagram" size={24} color="#FFF" />
              </View>
              <View style={dynamicStyles.igTextWrapper}>
                <Text style={dynamicStyles.igShareTitle}>Share on Instagram Story</Text>
                <Text style={dynamicStyles.igShareSub}>Get anonymous messages from your friends</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#FFF" style={{ opacity: 0.8 }} />
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
        </View>
      )}


      {/* Share/Reply Modal */}
      <Modal visible={!!sharingMsg} transparent animationType="slide" onRequestClose={() => setSharingMsg(null)}>
        <View style={dynamicStyles.shareModalOverlay}>
          <View style={dynamicStyles.sharePreviewRoot}>
            <View style={[dynamicStyles.shareStoryCard, { backgroundColor: Array.isArray(shareTheme) ? 'transparent' : shareTheme, shadowColor: Array.isArray(shareTheme) ? shareTheme[0] : shareTheme }]}>
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

              <View style={dynamicStyles.shareHeader}>
                <View style={dynamicStyles.shareIconCircle}>
                  <MaterialCommunityIcons name="incognito" size={24} color="#FFF" />
                </View>
                <Text style={dynamicStyles.shareHeaderText}>ANONYMOUS ASK</Text>
                {isVerifiedGhost && (
                  <View style={dynamicStyles.verifiedBadge}>
                    <MaterialCommunityIcons name="ghost" size={14} color="#00BFFF" />
                  </View>
                )}
              </View>
              <Text style={dynamicStyles.shareQuestionText}>{sharingMsg?.text}</Text>
              
              <View style={dynamicStyles.shareReplyWrapper}>
                {replyText ? (
                  <View style={dynamicStyles.shareReplyGlass}>
                    <Text style={dynamicStyles.shareReplyText}>{replyText}</Text>
                  </View>
                ) : (
                  <View style={dynamicStyles.shareReplyPlaceholderGlass}>
                    <Text style={dynamicStyles.sharePlaceholderText}>Your reply will appear here...</Text>
                  </View>
                )}
              </View>
              
              <View style={dynamicStyles.shareBrandingRow}>
                <View style={dynamicStyles.SyncognitoBadge}>
                  <MaterialCommunityIcons name="music" size={10} color="#FFF" />
                  <Text style={dynamicStyles.brandingText}>Syncognito</Text>
                </View>
              </View>
            </View>

            <View style={dynamicStyles.replyInputArea}>
              <View style={dynamicStyles.themeRow}>
                <Text style={dynamicStyles.themeLabel}>Theme:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dynamicStyles.themeScrollRow}>
                  {SHARE_THEMES.map((theme: string) => (
                    <TouchableOpacity 
                      key={theme} 
                      onPress={() => setShareTheme(theme)} 
                      style={[
                        dynamicStyles.themeColorCircle, 
                        { backgroundColor: theme },
                        shareTheme === theme && dynamicStyles.themeColorCircleActive
                      ]}
                    />
                  ))}
                  <TouchableOpacity 
                     onPress={() => setShowGradientModal(true)}
                     style={[dynamicStyles.themeColorCircle, { backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }]}
                  >
                     <MaterialCommunityIcons name="plus" size={12} color="#FFF" />
                  </TouchableOpacity>
                </ScrollView>
              </View>
              <TextInput
                style={dynamicStyles.replyInput}
                placeholder="Type your reply..."
                placeholderTextColor="#666"
                value={replyText}
                onChangeText={setReplyText}
                multiline
              />
              <View style={dynamicStyles.shareActionRow}>
                <TouchableOpacity style={dynamicStyles.shareCancel} onPress={() => { setSharingMsg(null); setReplyText(''); }}>
                  <Text style={dynamicStyles.shareCancelText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                   style={dynamicStyles.shareConfirm} 
                   onPress={async () => {
                     await Share.share({
                       message: `Anonymous Note: "${sharingMsg?.text}"\n\nMy Reply: "${replyText}"\n\nSend me ghost notes too: https://syncognito-nine.vercel.app/anon/${anonSlug || auth.user?._id}`
                     });
                   }}
                >
                  <MaterialCommunityIcons name="share-variant" size={20} color="#000" />
                  <Text style={dynamicStyles.shareConfirmText}>SHARE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Link Customization Modal */}
      <Modal visible={showSlugModal} transparent animationType="fade" onRequestClose={() => setShowSlugModal(false)}>
        <TouchableOpacity 
          style={dynamicStyles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowSlugModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={dynamicStyles.slugModal}>
            <Text style={dynamicStyles.slugModalTitle}>Customize Your Link</Text>
            <Text style={dynamicStyles.slugModalSub}>Choose a unique username for your secret inbox.</Text>
            
            <View style={dynamicStyles.slugInputRow}>
              <Text style={dynamicStyles.slugPrefix}>syncognito-nine.vercel.app/anon/</Text>
              <TextInput
                style={dynamicStyles.slugInput}
                value={newSlug}
                onChangeText={setNewSlug}
                placeholder="username"
                placeholderTextColor="#444"
                autoCapitalize="none"
              />
            </View>
 
            <View style={dynamicStyles.slugActionRow}>
              <TouchableOpacity style={dynamicStyles.slugCancel} onPress={() => setShowSlugModal(false)}>
                <Text style={dynamicStyles.slugCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.slugConfirm} onPress={updateSlug} disabled={updatingSlug}>
                {updatingSlug ? <ActivityIndicator size="small" color="#000" /> : <Text style={dynamicStyles.slugConfirmText}>SAVE</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Analytics Modal */}
      <Modal visible={showAnalyticsModal} transparent animationType="slide" onRequestClose={() => setShowAnalyticsModal(false)}>
        <View style={dynamicStyles.modalOverlay}>
          <View style={[dynamicStyles.slugModal, { maxHeight: '80%', paddingBottom: 20 }]}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={dynamicStyles.slugModalTitle}>Link Insights</Text>
                <TouchableOpacity onPress={() => setShowAnalyticsModal(false)}>
                   <MaterialCommunityIcons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
             </View>
             
             <View style={dynamicStyles.statsRow}>
                <View style={[dynamicStyles.statCard, { backgroundColor: 'rgba(138,43,226,0.1)', borderColor: 'rgba(138,43,226,0.3)' }]}>
                   <Text style={[dynamicStyles.statNumber, { color: '#8A2BE2' }]}>{analyticsData?.totalViews || 0}</Text>
                   <Text style={dynamicStyles.statLabel}>TOTAL VIEWS</Text>
                </View>
                <View style={dynamicStyles.statCard}>
                   <Text style={dynamicStyles.statNumber}>{messages.length}</Text>
                   <Text style={dynamicStyles.statLabel}>MESSAGES</Text>
                </View>
             </View>

             <Text style={[dynamicStyles.promptLabel, { marginTop: 20, marginBottom: 10 }]}>Recent Visitors</Text>
             <ScrollView style={{ flexGrow: 0 }}>
                {analyticsData?.views?.length > 0 ? (
                  analyticsData.views.map((v: any, idx: number) => (
                    <View key={idx} style={dynamicStyles.viewItem}>
                       <View style={dynamicStyles.viewIcon}>
                          <MaterialCommunityIcons 
                            name={v.userAgent?.includes('Android') ? 'android' : v.userAgent?.includes('iPhone') ? 'apple' : 'web'} 
                            size={16} color={theme.textSecondary} 
                          />
                       </View>
                       <View style={{ flex: 1 }}>
                          <Text style={dynamicStyles.viewTitle}>{v.viewerIp === '::1' ? 'Local System' : 'Secret Visitor'}</Text>
                          <Text style={dynamicStyles.viewSub}>{new Date(v.createdAt).toLocaleString()}</Text>
                       </View>
                       {v.referrer && (
                         <View style={dynamicStyles.refBadge}>
                            <Text style={dynamicStyles.refText}>{v.referrer.includes('instagram') ? 'INSTAGRAM' : 'DIRECT'}</Text>
                         </View>
                        )}
                    </View>
                  ))
                ) : (
                  <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>No views recorded yet.</Text>
                )}
             </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Theme Editor Modal */}
      <Modal visible={showThemeEditor} transparent animationType="slide" onRequestClose={closeThemeEditor}>
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.themeEditorModal}>
            <Text style={dynamicStyles.modalTitle}>Custom Card Builder</Text>
            <ScrollView>
              <Text style={dynamicStyles.modalSection}>Background Media</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                <TouchableOpacity style={dynamicStyles.mediaBtn} onPress={pickImage}>
                  <MaterialCommunityIcons name="image" size={20} color={theme.text} />
                  <Text style={dynamicStyles.mediaBtnText}>Pick Image</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dynamicStyles.mediaBtn} onPress={pickVideo}>
                  <MaterialCommunityIcons name="video" size={20} color={theme.text} />
                  <Text style={dynamicStyles.mediaBtnText}>Pick Video</Text>
                </TouchableOpacity>
              </View>
              {bgMediaUri && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: theme.textSecondary }}>Preview:</Text>
                  {bgMediaType === 'image' ? (
                    <Image source={{ uri: bgMediaUri }} style={{ width: '100%', height: 150, borderRadius: 12 }} />
                  ) : (
                    <Video source={{ uri: bgMediaUri }} style={{ width: '100%', height: 150 }} resizeMode="cover" repeat muted />
                  )}
                </View>
              )}
              <Text style={dynamicStyles.modalSection}>Text Font</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {FONT_OPTIONS.map(f => (
                  <TouchableOpacity key={f} style={[dynamicStyles.fontOption, fontFamily === f && dynamicStyles.fontOptionActive]} onPress={() => setFontFamily(f)}>
                    <Text style={{ color: theme.text }}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }}>
                <TouchableOpacity style={dynamicStyles.modalCloseBtn} onPress={closeThemeEditor}>
                  <Text style={dynamicStyles.modalCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Gradient Builder Modal */}
      <Modal visible={showGradientModal} transparent animationType="slide" onRequestClose={() => setShowGradientModal(false)}>
        <TouchableOpacity 
          style={dynamicStyles.shareModalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowGradientModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={dynamicStyles.gradientModalRoot}>
            <Text style={dynamicStyles.gradientTitle}>Create Gradient</Text>
            
            <View style={dynamicStyles.gradientPreviewBox}>
               <LinearGradient colors={[gradColor1, gradColor2]} style={StyleSheet.absoluteFill} start={{x:0, y:0}} end={{x:1, y:1}} />
               <Text style={dynamicStyles.gradientPreviewText}>Preview</Text>
            </View>

            <Text style={dynamicStyles.gradientLabel}>Select Color 1</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dynamicStyles.gradColorRow}>
              {GRADIENT_PALETTE.map(c => (
                <TouchableOpacity key={c} onPress={() => setGradColor1(c)} style={[dynamicStyles.gradColorCircle, { backgroundColor: c }, gradColor1 === c && dynamicStyles.themeColorCircleActive]} />
              ))}
            </ScrollView>

            <Text style={dynamicStyles.gradientLabel}>Select Color 2</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dynamicStyles.gradColorRow}>
              {GRADIENT_PALETTE.map(c => (
                <TouchableOpacity key={c} onPress={() => setGradColor2(c)} style={[dynamicStyles.gradColorCircle, { backgroundColor: c }, gradColor2 === c && dynamicStyles.themeColorCircleActive]} />
              ))}
            </ScrollView>

            <View style={dynamicStyles.shareActionRow}>
              <TouchableOpacity style={dynamicStyles.shareCancel} onPress={() => setShowGradientModal(false)}>
                <Text style={dynamicStyles.shareCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                 style={dynamicStyles.shareConfirm} 
                 onPress={() => {
                   setShareTheme([gradColor1, gradColor2]);
                   setShowGradientModal(false);
                 }}
              >
                <Text style={dynamicStyles.shareConfirmText}>APPLY</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Hidden Share Template for ViewShot */}
      <ViewShot 
        ref={viewShotRef} 
        options={{ format: 'png', quality: 1.0 }} 
        style={dynamicStyles.hiddenViewShot}
      >
        {/* Theme Editor Button */}
        <TouchableOpacity onPress={openThemeEditor} style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 8 }}>
          <MaterialCommunityIcons name="palette" size={20} color="#FFF" />
        </TouchableOpacity>
        {/* Share Template with optional background media */}
        {bgMediaType === 'image' && bgMediaUri ? (
          <ImageBackground source={{ uri: bgMediaUri }} style={dynamicStyles.shareTemplateContainer} imageStyle={{ borderRadius: 20 }}>
            <LinearGradient colors={cardThemeIndex === 0 ? ['#434343', '#000000'] : CARD_THEMES[cardThemeIndex]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            {/* Existing share template content */}
            <View style={[dynamicStyles.shareCircle, { top: -50, left: -50, backgroundColor: 'rgba(255,255,255,0.1)' }]} />
            <View style={[dynamicStyles.shareCircle, { bottom: -80, right: -80, backgroundColor: 'rgba(29,185,84,0.15)' }]} />
            <View style={dynamicStyles.shareTemplateCard}>
              <View style={dynamicStyles.shareAvatarWrapper}>
                {auth.user?.avatar ? (
                  <Image source={{ uri: auth.user.avatar }} style={dynamicStyles.shareAvatar} />
                ) : (
                  <View style={[dynamicStyles.shareAvatar, dynamicStyles.shareAvatarPlaceholder]}>
                    <Text style={dynamicStyles.shareAvatarInitial}>{auth.user?.name?.charAt(0).toUpperCase() || 'A'}</Text>
                  </View>
                )}
              </View>
              <View style={dynamicStyles.shareQuestionBox}>
                <Text style={dynamicStyles.shareQuestionTitle}>ANONYMOUS QUESTION</Text>
                <Text style={dynamicStyles.templateQuestionText}>{sharePrompt}</Text>
              </View>
              <View style={dynamicStyles.shareLinkSticker}>
                <MaterialCommunityIcons name="link-variant" size={20} color={accentColor} />
                <Text style={dynamicStyles.shareLinkStickerText} numberOfLines={1}>Paste link</Text>
              </View>
              <View style={dynamicStyles.shareFooter}>
                <MaterialCommunityIcons name="incognito" size={24} color={accentColor} />
                <View>
                  <Text style={dynamicStyles.shareBrandName}>Syncognito</Text>
                  <Text style={dynamicStyles.shareTagline}>Stay Anonymous • Stay Connected</Text>
                </View>
              </View>
            </View>
            <Text style={dynamicStyles.shareLinkHint}>Link in bio / syncognito-nine.vercel.app</Text>
          </ImageBackground>
        ) : bgMediaType === 'video' && bgMediaUri ? (
          <View style={dynamicStyles.shareTemplateContainer}>
            <Video source={{ uri: bgMediaUri }} style={StyleSheet.absoluteFill} resizeMode="cover" repeat muted />
            <LinearGradient colors={cardThemeIndex === 0 ? ['#434343', '#000000'] : CARD_THEMES[cardThemeIndex]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            {/* Existing share template content */}
            <View style={[dynamicStyles.shareCircle, { top: -50, left: -50, backgroundColor: 'rgba(255,255,255,0.1)' }]} />
            <View style={[dynamicStyles.shareCircle, { bottom: -80, right: -80, backgroundColor: 'rgba(29,185,84,0.15)' }]} />
            <View style={dynamicStyles.shareTemplateCard}>
              <View style={dynamicStyles.shareAvatarWrapper}>
                {auth.user?.avatar ? (
                  <Image source={{ uri: auth.user.avatar }} style={dynamicStyles.shareAvatar} />
                ) : (
                  <View style={[dynamicStyles.shareAvatar, dynamicStyles.shareAvatarPlaceholder]}>
                    <Text style={dynamicStyles.shareAvatarInitial}>{auth.user?.name?.charAt(0).toUpperCase() || 'A'}</Text>
                  </View>
                )}
              </View>
              <View style={dynamicStyles.shareQuestionBox}>
                <Text style={dynamicStyles.shareQuestionTitle}>ANONYMOUS QUESTION</Text>
                <Text style={dynamicStyles.templateQuestionText}>{sharePrompt}</Text>
              </View>
              <View style={dynamicStyles.shareLinkSticker}>
                <MaterialCommunityIcons name="link-variant" size={20} color={accentColor} />
                <Text style={dynamicStyles.shareLinkStickerText} numberOfLines={1}>Paste link</Text>
              </View>
              <View style={dynamicStyles.shareFooter}>
                <MaterialCommunityIcons name="incognito" size={24} color={accentColor} />
                <View>
                  <Text style={dynamicStyles.shareBrandName}>Syncognito</Text>
                  <Text style={dynamicStyles.shareTagline}>Stay Anonymous • Stay Connected</Text>
                </View>
              </View>
            </View>
            <Text style={dynamicStyles.shareLinkHint}>Link in bio / syncognito-nine.vercel.app</Text>
          </View>
        ) : (
          <LinearGradient
            colors={cardThemeIndex === 0 ? ['#434343', '#000000'] : CARD_THEMES[cardThemeIndex]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={dynamicStyles.shareTemplateContainer}
          >
            {/* Decorative Circles */}
            <View style={[dynamicStyles.shareCircle, { top: -50, left: -50, backgroundColor: 'rgba(255,255,255,0.1)' }]} />
            <View style={[dynamicStyles.shareCircle, { bottom: -80, right: -80, backgroundColor: 'rgba(29,185,84,0.15)' }]} />

            <View style={dynamicStyles.shareTemplateCard}>
              <View style={dynamicStyles.shareAvatarWrapper}>
                {auth.user?.avatar ? (
                  <Image source={{ uri: auth.user.avatar }} style={dynamicStyles.shareAvatar} />
                ) : (
                  <View style={[dynamicStyles.shareAvatar, dynamicStyles.shareAvatarPlaceholder]}>
                    <Text style={dynamicStyles.shareAvatarInitial}>{auth.user?.name?.charAt(0).toUpperCase() || 'A'}</Text>
                  </View>
                )}
              </View>

              <View style={dynamicStyles.shareQuestionBox}>
                <Text style={dynamicStyles.shareQuestionTitle}>ANONYMOUS QUESTION</Text>
                <Text style={dynamicStyles.templateQuestionText}>{sharePrompt}</Text>
              </View>

              {/* Link Sticker Placement Area (Visual Only) */}
              <View style={dynamicStyles.shareLinkSticker}>
                <MaterialCommunityIcons name="link-variant" size={20} color={accentColor} />
                <Text style={dynamicStyles.shareLinkStickerText} numberOfLines={1}>
                  Paste link
                </Text>
              </View>

              <View style={dynamicStyles.shareFooter}>
                <MaterialCommunityIcons name="incognito" size={24} color={accentColor} />
                <View>
                  <Text style={dynamicStyles.shareBrandName}>Syncognito</Text>
                  <Text style={dynamicStyles.shareTagline}>Stay Anonymous • Stay Connected</Text>
                </View>
              </View>
            </View>
            
            <Text style={dynamicStyles.shareLinkHint}>Link in bio / syncognito-nine.vercel.app</Text>
          </LinearGradient>
        )}
      </ViewShot>
    </View>
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
    paddingBottom: 15,
    backgroundColor: '#FFF',
  },
  backBtnMini: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  headerTitle: { color: '#000', fontSize: 26, fontWeight: '800' },
  shareIconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(29, 185, 84, 0.1)', borderRadius: 10 },
  
  tabWrapper: { 
    paddingBottom: 15, 
    paddingTop: 4, 
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    marginBottom: 16,
  },
  tabContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'transparent' },
  activeTabBtn: { backgroundColor: accentColor, borderColor: accentColor },
  tabText: { color: theme.textSecondary, fontWeight: '700', fontSize: 12 },
  activeTabText: { color: theme.background },
  
  badge: { backgroundColor: '#EF5350', marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: theme.text, fontSize: 10, fontWeight: '900' },
  
  linkBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.surface, 
    marginHorizontal: SCREEN_WIDTH * 0.05, 
    marginBottom: 16, 
    marginTop: 4, 
    paddingVertical: 24, 
    paddingHorizontal: 18, 
    borderRadius: 28, 
    borderWidth: 1, 
    borderColor: 'rgba(29, 185, 84, 0.3)', 
    shadowColor: accentColor, 
    shadowOpacity: 0.15, 
    shadowRadius: 20, 
    elevation: 5 
  },
  bannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  linkInfo: { flex: 1 },
  linkTitle: { color: accentColor, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  linkSub: { color: theme.textSecondary, fontSize: 12, marginTop: 4, fontWeight: '600' },
  avatarPicLarge: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholderLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(29, 185, 84, 0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: accentColor },
  
  igShareBanner: { marginHorizontal: 16, borderRadius: 20 },
  igGradient: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20 },
  igIconWrapper: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  igTextWrapper: { flex: 1 },
  igShareTitle: { color: theme.text, fontSize: 14, fontWeight: '900', letterSpacing: 0.5, marginBottom: 2 },
  igShareSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  
  promptContainer: { paddingHorizontal: 16, marginTop: 10 },
  promptLabel: { color: theme.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  promptInput: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, color: theme.text, fontSize: 15, borderWidth: 1, borderColor: theme.border, marginBottom: 12 },
  chipsScroll: { gap: 8, paddingRight: 20 },
  promptChip: { backgroundColor: 'rgba(29, 185, 84, 0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(29, 185, 84, 0.3)' },
  promptChipText: { color: accentColor, fontSize: 12, fontWeight: '700' },
  
  listContent: { paddingTop: 0, paddingBottom: 100 },
  messageCard: { marginHorizontal: 16, backgroundColor: theme.card, borderRadius: 20, padding: 12, marginBottom: 10, borderWidth: 1.5, borderColor: 'rgba(29, 185, 84, 0.15)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  anonLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(29, 185, 84, 0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  anonLabel: { color: accentColor, fontSize: 8, fontWeight: '800', letterSpacing: 1.5 },
  messageText: { color: theme.text, fontSize: 15, lineHeight: 22, fontWeight: '600', letterSpacing: 0.2 },
  timeLabel: { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 40 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(29,185,84,0.3)', shadowColor: accentColor, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8 },
  emptyTitle: { color: theme.text, fontSize: 16, fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 },
  emptySub: { color: '#777', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24, fontWeight: '500' },
  mainShareBtn: { backgroundColor: accentColor, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, flex: 1, alignItems: 'center' },
  mainShareBtnText: { color: theme.background, fontWeight: '800', fontSize: 10, marginTop: 4, letterSpacing: 1.5 },
  emptyActionRow: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 10 },
  mainCopyBtn: { backgroundColor: theme.surface, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, borderWidth: 1, borderColor: theme.border, flex: 1, alignItems: 'center' },
  mainCopyBtnText: { color: theme.text, fontWeight: '800', fontSize: 10, marginTop: 4, letterSpacing: 1.5 },

  avatarPic: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: accentColor },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(29, 185, 84, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  replyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: accentColor, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#1ED760', shadowColor: accentColor, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  replyBtnText: { color: theme.background, fontSize: 8, fontWeight: '800', marginTop: 4, letterSpacing: 0.5 },

  shareModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'flex-end' },
  sharePreviewRoot: { backgroundColor: theme.surface, borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: theme.surfaceDarker },
  shareStoryCard: { borderRadius: 20, padding: 16, minHeight: 120, overflow: 'hidden' },
  shareHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  shareIconCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', shadowColor: theme.background, shadowOpacity: 0.15, shadowRadius: 5 },
  shareHeaderText: { color: theme.text, fontWeight: '900', fontSize: 9, marginTop: 2, letterSpacing: 1.5 },
  shareQuestionText: { color: theme.text, fontSize: 18, fontWeight: '900', lineHeight: 24, marginBottom: 10, fontStyle: 'italic', letterSpacing: 0.5, shadowColor: theme.background, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  shareReplyWrapper: { marginTop: 4 },
  shareReplyGlass: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', shadowColor: theme.background, shadowOpacity: 0.15, shadowRadius: 10 },
  shareReplyText: { color: theme.text, fontSize: 14, fontWeight: '800', lineHeight: 20 },
  shareReplyPlaceholderGlass: { borderStyle: 'dashed', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 12, padding: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  sharePlaceholderText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  shareBrandingRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  SyncognitoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  brandingText: { color: theme.text, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  brandingHandle: { color: 'rgba(0,0,0,0.5)', fontSize: 10, fontWeight: '800' },
  
  replyInputArea: { marginTop: 30 },
  replyInput: { backgroundColor: theme.background, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, color: theme.text, fontSize: 15, textAlignVertical: 'top', minHeight: 56, marginBottom: 20, borderWidth: 1, borderColor: theme.border },
  shareActionRow: { flexDirection: 'row', gap: 16 },
  shareCancel: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  shareCancelText: { color: theme.textSecondary, fontWeight: '800', letterSpacing: 1 },
  shareConfirm: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 14, backgroundColor: accentColor },
  shareConfirmText: { color: theme.background, fontWeight: '800', fontSize: 10, marginTop: 4, letterSpacing: 1.5 },

  bannerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  copyLinkBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: accentColor, justifyContent: 'center', alignItems: 'center', shadowColor: accentColor, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  editLinkBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: accentColor, justifyContent: 'center', alignItems: 'center', shadowColor: accentColor, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  slugModal: { backgroundColor: theme.card, borderRadius: 32, padding: 30, width: '100%', borderWidth: 1, borderColor: '#1F1F1F', shadowColor: accentColor, shadowOpacity: 0.1, shadowRadius: 30, elevation: 10 },
  slugModalTitle: { color: theme.text, fontSize: 16, fontWeight: '800', marginBottom: 10, letterSpacing: 0.5 },
  slugModalSub: { color: theme.textSecondary, fontSize: 14, marginBottom: 24, lineHeight: 20, fontWeight: '500' },
  slugInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 20, height: 56, borderWidth: 1, borderColor: theme.border, marginBottom: 30 },
  slugPrefix: { color: theme.textSecondary, fontSize: 14, fontWeight: '700' },
  slugInput: { flex: 1, color: accentColor, fontSize: 15, fontWeight: '900', paddingLeft: 4 },
  slugActionRow: { flexDirection: 'row', gap: 16 },
  slugCancel: { flex: 1, height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 16, backgroundColor: theme.border, borderWidth: 1, borderColor: theme.border },
  slugCancelText: { color: theme.textSecondary, fontWeight: '800', letterSpacing: 0.5 },
  slugConfirm: { flex: 2, height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 16, backgroundColor: accentColor, shadowColor: accentColor, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  slugConfirmText: { color: theme.background, fontWeight: '800', fontSize: 10, marginTop: 4, letterSpacing: 1 },

  suggestionsRow: { maxHeight: 40, marginBottom: 12 },
  suggestionsContent: { paddingHorizontal: 20, gap: 10 },
  suggestionChip: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center' },
  suggestionText: { color: '#AAA', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  suggestionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, marginTop: 10, marginBottom: 8 },
  suggestionsTitle: { color: theme.textSecondary, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  catScroll: { maxHeight: 36, marginBottom: 16 },
  catContent: { paddingHorizontal: 20, gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  activeCatChip: { backgroundColor: accentColor, borderColor: accentColor },
  catChipText: { color: theme.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  activeCatChipText: { color: theme.background },
  
  themeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20, gap: 16 },
  themeLabel: { color: theme.textSecondary, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  themeScrollRow: { gap: 12, paddingRight: 30 },
  themeColorCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: theme.border },
  themeColorCircleActive: { borderColor: theme.text, borderWidth: 3 },

  gradientModalRoot: { backgroundColor: theme.surface, borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: '#1F1F1F' },
  gradientTitle: { color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  gradientPreviewBox: { height: 100, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: theme.border },
  gradientPreviewText: { color: theme.text, fontSize: 24, fontWeight: '900', fontStyle: 'italic', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 4 },
  gradientLabel: { color: '#AAA', fontSize: 13, fontWeight: '800', marginBottom: 10 },
  gradColorRow: { gap: 12, paddingRight: 20, marginBottom: 24 },
  gradColorCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: theme.border },

  // Stats Dashboard
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: theme.card, borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statNumber: { color: theme.text, fontSize: 22, fontWeight: '900' },
  statLabel: { color: theme.textSecondary, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginTop: 4 },

  // Question of the Day
  qotdCard: { marginHorizontal: 16, backgroundColor: theme.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.15)' },
  qotdLabel: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  qotdText: { color: theme.text, fontSize: 14, fontWeight: '600', lineHeight: 20 },

  // Swipe Actions
  swipeActionLeft: { backgroundColor: '#FFD700', borderRadius: 20, justifyContent: 'center', alignItems: 'center', width: 80, marginBottom: 10, marginRight: 4 },
  swipeActionRight: { backgroundColor: '#FF5252', borderRadius: 20, justifyContent: 'center', alignItems: 'center', width: 80, marginBottom: 10, marginLeft: 4 },
  swipeActionText: { color: theme.background, fontSize: 10, fontWeight: '900', marginTop: 4, letterSpacing: 1 },

  // Mark All Read
  markAllReadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(29,185,84,0.08)', borderWidth: 1, borderColor: 'rgba(29,185,84,0.2)' },
  markAllReadText: { color: accentColor, fontSize: 12, fontWeight: '800' },

  // Sharing Template Styles
  hiddenViewShot: { position: 'absolute', left: -2000, width: 1080, height: 1920 }, // Off-screen 1080x1920 (Instagram Story size)
  shareTemplateContainer: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', padding: 60 },
  shareCircle: { position: 'absolute', width: 400, height: 400, borderRadius: 200 },
  shareTemplateCard: { width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 60, padding: 60, alignItems: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)' },
  shareAvatarWrapper: { width: 220, height: 220, borderRadius: 110, padding: 10, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 50, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 30 },
  shareAvatar: { width: 200, height: 200, borderRadius: 100, borderWidth: 6, borderColor: '#FFF' },
  shareAvatarPlaceholder: { backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  shareAvatarInitial: { color: '#FFF', fontSize: 90, fontWeight: '900' },
  shareQuestionBox: { width: '100%', backgroundColor: '#FFF', borderRadius: 40, padding: 50, marginBottom: 50, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20 },
  shareQuestionTitle: { color: '#666', fontSize: 24, fontWeight: '900', letterSpacing: 3, marginBottom: 20, textAlign: 'center' },
  templateQuestionText: { color: '#000', fontSize: 42, fontWeight: '800', textAlign: 'center', lineHeight: 56 },
  shareFooter: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  shareBrandName: { color: '#FFF', fontSize: 32, fontWeight: '900', letterSpacing: 1 },
  shareTagline: { color: 'rgba(255,255,255,0.6)', fontSize: 18, fontWeight: '700' },
  shareLinkHint: { color: 'rgba(255,255,255,0.5)', fontSize: 24, fontWeight: '800', marginTop: 80, letterSpacing: 1 },
  shareLinkSticker: { 
    backgroundColor: '#FFF', 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 15, 
    paddingHorizontal: 40, 
    paddingVertical: 25, 
    borderRadius: 50, 
    marginBottom: 50,
    shadowColor: accentColor,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10
  },
  shareLinkStickerText: { color: accentColor, fontSize: 22, fontWeight: '900', letterSpacing: 2 },

  // Analytics Styles
  viewItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  viewIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center' },
  viewTitle: { color: theme.text, fontSize: 13, fontWeight: '800' },
  viewSub: { color: theme.textSecondary, fontSize: 10, marginTop: 2 },
  refBadge: { backgroundColor: 'rgba(29,185,84,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  refText: { color: accentColor, fontSize: 8, fontWeight: '900' },
});

