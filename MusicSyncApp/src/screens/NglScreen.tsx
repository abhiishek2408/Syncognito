import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, RefreshControl, Dimensions, Animated, Share, TextInput, Modal, ScrollView, Vibration, Image
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import API_URL from '../utils/api';
import { useToast } from '../context/ToastContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');



const SHARE_THEMES = [
  '#1DB954', // Spotify Green
  '#FF4500', // Orange Red
  '#8A2BE2', // Deep Purple
  '#00BFFF', // Deep Sky Blue
  '#FF1493', // Deep Pink
  '#FFB74D', // Soft Orange
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

  const shareNglLink = async () => {
    try {
      const slugOrId = anonSlug || auth.user?._id;
      const shareUrl = `https://syncognito-nine.vercel.app/anon/${slugOrId}`;
      await Share.share({
        message: `Send me anonymous notes! 🤫\n${shareUrl}`,
      });
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

  const renderItem = ({ item }: { item: any }) => (
    <Animated.View style={[styles.messageCard, { opacity: fadeAnim }]}>
      <View style={styles.cardHeader}>
        <View style={styles.anonLabelRow}>
          <MaterialCommunityIcons name="incognito" size={16} color="#1DB954" />
          <Text style={styles.anonLabel}>ANONYMOUS NOTE</Text>
        </View>
        <TouchableOpacity onPress={() => deleteMessage(item._id)}>
          <MaterialCommunityIcons name="delete-outline" size={20} color="#FF5252" />
        </TouchableOpacity>
      </View>
      <Text style={styles.messageText}>{item.text}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.timeLabel}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        <TouchableOpacity style={styles.replyBtn} onPress={() => setSharingMsg(item)}>
          <MaterialCommunityIcons name="reply" size={16} color="#000" />
          <Text style={styles.replyBtnText}>REPLY</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: '#050505' }]}>

      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={32} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Anonymous Notes</Text>
        <TouchableOpacity onPress={shareNglLink} style={styles.shareIconBtn}>
          <MaterialCommunityIcons name="share-variant" size={24} color="#1DB954" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#1DB954" />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item._id || Math.random().toString()}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchMessages(true)} tintColor="#1DB954" />
          }
          ListHeaderComponent={
            <>
              <View style={styles.linkBanner}>
                <View style={styles.bannerLeft}>
                   {auth.user?.avatar ? (
                     <Image source={{ uri: auth.user.avatar }} style={styles.avatarPic} />
                   ) : (
                     <View style={styles.avatarPlaceholder}>
                        <MaterialCommunityIcons name="account" size={24} color="#1DB954" />
                     </View>
                   )}
                   <View style={styles.linkInfo}>
                     <Text style={styles.linkTitle}>Your Secret Link</Text>
                     <Text style={styles.linkSub} numberOfLines={1}>syncognito-nine.vercel.app/anon/{anonSlug || (auth.user?._id ? auth.user._id.substring(0, 8) : '...')}</Text>
                   </View>
                </View>
                <TouchableOpacity style={styles.editLinkBtn} onPress={() => setShowSlugModal(true)}>
                   <MaterialCommunityIcons name="pencil" size={14} color="#000" />
                </TouchableOpacity>
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons name="email-off-outline" size={60} color="#222" />
              </View>
              <Text style={styles.emptyTitle}>Your inbox is empty</Text>
              <Text style={styles.emptySub}>Share your link to get messages!</Text>
              <TouchableOpacity style={styles.mainShareBtn} onPress={shareNglLink}>
                <Text style={styles.mainShareBtnText}>SHARE LINK</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Share/Reply Modal */}
      <Modal visible={!!sharingMsg} transparent animationType="slide" onRequestClose={() => setSharingMsg(null)}>
        <View style={styles.shareModalOverlay}>
          <View style={styles.sharePreviewRoot}>
            <View style={[styles.shareStoryCard, { backgroundColor: Array.isArray(shareTheme) ? 'transparent' : shareTheme, shadowColor: Array.isArray(shareTheme) ? shareTheme[0] : shareTheme }]}>
              {Array.isArray(shareTheme) && (
                 <LinearGradient colors={shareTheme} style={[StyleSheet.absoluteFill, { borderRadius: 28 }]} start={{x:0, y:0}} end={{x:1, y:1}} />
              )}
              <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 36 }]}>
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
                     <MaterialCommunityIcons name="plus" size={18} color="#FFF" />
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
        <View style={styles.modalOverlay}>
          <View style={styles.slugModal}>
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
          </View>
        </View>
      </Modal>

      {/* Gradient Builder Modal */}
      <Modal visible={showGradientModal} transparent animationType="slide" onRequestClose={() => setShowGradientModal(false)}>
        <View style={styles.shareModalOverlay}>
          <View style={styles.gradientModalRoot}>
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
          </View>
        </View>
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
  
  linkBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A0A0A', margin: 16, padding: 18, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(29, 185, 84, 0.3)', shadowColor: '#1DB954', shadowOpacity: 0.15, shadowRadius: 20, elevation: 5 },
  bannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  linkInfo: { flex: 1 },
  linkTitle: { color: '#1DB954', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  linkSub: { color: '#888', fontSize: 12, marginTop: 4, fontWeight: '600' },
  
  listContent: { padding: 16, paddingBottom: 100 },
  messageCard: { backgroundColor: '#0D0D0D', borderRadius: 24, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: 'rgba(29, 185, 84, 0.15)', shadowColor: '#1DB954', shadowOpacity: 0.08, shadowRadius: 15, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  anonLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(29, 185, 84, 0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  anonLabel: { color: '#1DB954', fontSize: 8, fontWeight: '800', letterSpacing: 1.5 },
  messageText: { color: '#FFF', fontSize: 16, lineHeight: 24, fontWeight: '600', letterSpacing: 0.2 },
  timeLabel: { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 40 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(29,185,84,0.3)', shadowColor: '#1DB954', shadowOpacity: 0.2, shadowRadius: 20, elevation: 8 },
  emptyTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 },
  emptySub: { color: '#777', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24, fontWeight: '500' },
  mainShareBtn: { backgroundColor: '#1DB954', paddingHorizontal: 36, paddingVertical: 14, borderRadius: 30, shadowColor: '#1DB954', shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 },
  mainShareBtnText: { color: '#000', fontWeight: '800', fontSize: 10, marginTop: 4, letterSpacing: 1.5 },

  avatarPic: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#1DB954' },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(29, 185, 84, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  replyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1DB954', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#1ED760', shadowColor: '#1DB954', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  replyBtnText: { color: '#000', fontSize: 8, fontWeight: '800', marginTop: 4, letterSpacing: 0.5 },

  shareModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'flex-end' },
  sharePreviewRoot: { backgroundColor: '#050505', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: '#1A1A1A' },
  shareStoryCard: { borderRadius: 28, padding: 24, minHeight: 180, shadowOpacity: 0.6, shadowRadius: 35, elevation: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  shareHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  shareIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 5 },
  shareHeaderText: { color: '#FFF', fontWeight: '900', fontSize: 11, marginTop: 2, letterSpacing: 2 },
  shareQuestionText: { color: '#FFF', fontSize: 24, fontWeight: '900', lineHeight: 32, marginBottom: 20, fontStyle: 'italic', letterSpacing: 0.5, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  shareReplyWrapper: { marginTop: 10 },
  shareReplyGlass: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 18, padding: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10 },
  shareReplyText: { color: '#FFF', fontSize: 17, fontWeight: '800', lineHeight: 24 },
  shareReplyPlaceholderGlass: { borderStyle: 'dashed', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 18, padding: 18, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  sharePlaceholderText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  shareBrandingRow: { marginTop: 26, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  SyncognitoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  brandingText: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  brandingHandle: { color: 'rgba(0,0,0,0.5)', fontSize: 10, fontWeight: '800' },
  
  replyInputArea: { marginTop: 30 },
  replyInput: { backgroundColor: '#0B0B0B', borderRadius: 24, padding: 20, color: '#FFF', fontSize: 16, textAlignVertical: 'top', minHeight: 80, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(29, 185, 84, 0.4)' },
  shareActionRow: { flexDirection: 'row', gap: 16 },
  shareCancel: { flex: 1, paddingVertical: 18, alignItems: 'center', borderRadius: 20, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  shareCancelText: { color: '#888', fontWeight: '800', letterSpacing: 1 },
  shareConfirm: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 20, backgroundColor: '#1DB954', shadowColor: '#1DB954', shadowOpacity: 0.3, shadowRadius: 15, elevation: 5 },
  shareConfirmText: { color: '#000', fontWeight: '800', fontSize: 10, marginTop: 4, letterSpacing: 1.5 },

  editLinkBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#1DB954', justifyContent: 'center', alignItems: 'center', marginRight: 12, shadowColor: '#1DB954', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
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
  
  themeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginBottom: 14, gap: 12 },
  themeLabel: { color: '#888', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  themeScrollRow: { gap: 12, paddingRight: 20 },
  themeColorCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#333' },
  themeColorCircleActive: { borderColor: '#FFF', transform: [{ scale: 1.1 }] },

  gradientModalRoot: { backgroundColor: '#0A0A0A', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: '#1F1F1F' },
  gradientTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  gradientPreviewBox: { height: 100, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#333' },
  gradientPreviewText: { color: '#FFF', fontSize: 24, fontWeight: '900', fontStyle: 'italic', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 4 },
  gradientLabel: { color: '#AAA', fontSize: 13, fontWeight: '800', marginBottom: 10 },
  gradColorRow: { gap: 12, paddingRight: 20, marginBottom: 24 },
  gradColorCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#333' },
});

