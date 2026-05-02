import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, TextInput, ActivityIndicator, ScrollView, Modal } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import axios from 'axios';
import API_URL from '../utils/api';

const UserItem = ({ item, type, onAction }: { item: any, type: string, onAction: (id: string, action: string, extra?: string) => void }) => {
  const { theme, accentColor } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);
  const id = item._id || item.id;
  const name = item.name || 'User';
  const initial = name.charAt(0).toUpperCase();
  
  return (
    <View style={dynamicStyles.row}>
      <TouchableOpacity 
        style={dynamicStyles.userInfo} 
        onPress={() => onAction(id, 'profile', name)}
        activeOpacity={0.7}
      >
        <View style={dynamicStyles.avatarMini}>
          <View style={dynamicStyles.avatarGradient}>
            <Text style={dynamicStyles.avatarInitial}>{initial}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={dynamicStyles.nameText}>{name}</Text>
          <Text style={dynamicStyles.emailText} numberOfLines={1}>{item.email}</Text>
        </View>
      </TouchableOpacity>
      <View style={dynamicStyles.actions}>
        {type === 'search' && (
          <TouchableOpacity style={[dynamicStyles.actionButton, dynamicStyles.addBtn]} onPress={() => onAction(id, 'send')}>
            <MaterialCommunityIcons name="account-plus" size={18} color="#000" />
          </TouchableOpacity>
        )}
        {type === 'received' && (
          <>
            <TouchableOpacity style={[dynamicStyles.actionButton, dynamicStyles.acceptBtn]} onPress={() => onAction(id, 'accept')}>
              <MaterialCommunityIcons name="check" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[dynamicStyles.actionButton, dynamicStyles.declineBtn]} onPress={() => onAction(id, 'decline')}>
              <MaterialCommunityIcons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        )}
        {type === 'sent' && (
          <TouchableOpacity style={[dynamicStyles.actionButton, dynamicStyles.declineBtn]} onPress={() => onAction(id, 'cancel')}>
            <MaterialCommunityIcons name="account-cancel" size={18} color="#fff" />
          </TouchableOpacity>
        )}
        {type === 'friend' && (
          <>
            <TouchableOpacity style={[dynamicStyles.actionButton, dynamicStyles.nglBtn]} onPress={() => onAction(id, 'ngl', name)}>
              <MaterialCommunityIcons name="incognito" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[dynamicStyles.actionButton, dynamicStyles.declineBtn]} onPress={() => onAction(id, 'unfriend', name)}>
              <MaterialCommunityIcons name="account-remove" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

export default function FriendsScreen({ navigation }: any) {
  const { theme, accentColor } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);

  const auth = useContext(AuthContext);
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'friends' | 'received' | 'sent' | 'search'>('friends');
  const [friends, setFriends] = useState<any[]>([]);
  const [received, setReceived] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [nglTarget, setNglTarget] = useState<{ id: string, name: string } | null>(null);
  const [nglText, setNglText] = useState('');
  const [sendingNgl, setSendingNgl] = useState(false);

  const load = useCallback(async () => {
    if (!auth.token) return;
    setLoading(true);
    try {
      const [f, r] = await Promise.all([
        axios.get(`${API_URL}/api/users/me/friends`, { headers: { Authorization: `Bearer ${auth.token}` } }),
        axios.get(`${API_URL}/api/users/me/requests`, { headers: { Authorization: `Bearer ${auth.token}` } }),
      ]);
      setFriends(f.data || []);
      setReceived(r.data.received || []);
      setSent(r.data.sent || []);
    } catch (err) {
      console.warn('Failed fetching friends/requests', err);
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: string, extra?: string) => {
    const headers = { Authorization: `Bearer ${auth.token}` };
    try {
      if (action === 'send') {
        await axios.post(`${API_URL}/api/users/me/friend-request/${id}`, {}, { headers });
        showToast('Friend request sent!', 'success');
        setSearchResults(prev => prev.filter(u => (u._id || u.id) !== id));
      } else if (action === 'accept') {
        await axios.post(`${API_URL}/api/users/me/friend-request/${id}/accept`, {}, { headers });
        showToast('Friend request accepted!', 'success');
      } else if (action === 'decline') {
        await axios.post(`${API_URL}/api/users/me/friend-request/${id}/decline`, {}, { headers });
        showToast('Request declined', 'info');
      } else if (action === 'cancel') {
        await axios.post(`${API_URL}/api/users/me/friend-request/${id}/cancel`, {}, { headers });
        showToast('Request cancelled', 'info');
      } else if (action === 'unfriend') {
        Alert.alert('Unfriend', `Remove ${extra}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unfriend', style: 'destructive', onPress: async () => {
              await axios.delete(`${API_URL}/api/users/me/friend-request/${id}/cancel`, { headers });
              showToast(`Unfriended ${extra}`, 'info');
              load();
          }}
        ]);
        return; 
      } else if (action === 'profile') {
        navigation.navigate('ProfileDetail', { userId: id, userName: extra });
        return;
      } else if (action === 'ngl') {
        setNglTarget({ id, name: extra || 'Friend' });
        return;
      }
      load();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Action failed', 'error');
    }
  };

  const searchUsers = async () => {
    if (!auth.token || !query) return;
    setSearching(true);
    try {
      const resp = await axios.get(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${auth.token}` } });
      setSearchResults(resp.data || []);
    } finally {
      setSearching(false);
    }
  };

  const submitNgl = async () => {
    if (!nglText.trim() || !nglTarget) return;
    setSendingNgl(true);
    try {
      await axios.post(`${API_URL}/api/ngl/send`, { 
        recipientId: nglTarget.id, 
        text: nglText.trim() 
      });
      showToast('Anonymous note sent! 🤫', 'success');
      setNglTarget(null);
      setNglText('');
    } catch (err) {
      showToast('Failed to send', 'error');
    } finally {
      setSendingNgl(false);
    }
  };

  return (
    <View style={dynamicStyles.container}>
      {/* NGL Send Modal */}
      <Modal visible={!!nglTarget} transparent animationType="fade">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.nglModal}>
            <View style={dynamicStyles.nglHeader}>
              <MaterialCommunityIcons name="incognito" size={24} color="#BB86FC" />
              <Text style={dynamicStyles.nglTitle}>Send to {nglTarget?.name.split(' ')[0]}</Text>
            </View>
            <Text style={dynamicStyles.nglSub}>Your identity is strictly hidden</Text>
            <TextInput
              style={dynamicStyles.nglInput}
              placeholder="What's on your mind?..."
              placeholderTextColor="#444"
              multiline
              numberOfLines={4}
              value={nglText}
              onChangeText={setNglText}
            />
            <View style={dynamicStyles.nglActions}>
              <TouchableOpacity style={dynamicStyles.nglCancel} onPress={() => setNglTarget(null)}>
                <Text style={dynamicStyles.nglCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[dynamicStyles.nglSend, !nglText.trim() && { opacity: 0.5 }]} 
                onPress={submitNgl}
                disabled={sendingNgl || !nglText.trim()}
              >
                {sendingNgl ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={dynamicStyles.nglSendText}>SEND ANONYMOUSLY</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>Social Hub</Text>
        <Text style={dynamicStyles.subtitle}>Connect and listen together</Text>
      </View>

      <View style={dynamicStyles.tabWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dynamicStyles.tabContainer}>
          {[
            { id: 'friends', label: 'Friends' },
            { id: 'received', label: 'Received', badge: received.length },
            { id: 'sent', label: 'Sent', badge: sent.length },
            { id: 'search', label: 'Find' }
          ].map(tab => (
            <TouchableOpacity 
              key={tab.id} 
              style={[dynamicStyles.tabBtn, activeTab === tab.id && dynamicStyles.activeTabBtn]} 
              onPress={() => setActiveTab(tab.id as any)}
            >
              <Text style={[dynamicStyles.tabText, activeTab === tab.id && dynamicStyles.activeTabText]}>{tab.label}</Text>
              {tab.badge ? (
                <View style={dynamicStyles.badge}><Text style={dynamicStyles.badgeText}>{tab.badge}</Text></View>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {activeTab === 'search' && (
          <>
            <View style={dynamicStyles.searchContainer}>
              <View style={dynamicStyles.searchBar}>
                <MaterialCommunityIcons name="magnify" size={22} color="#444" />
                <TextInput 
                  value={query} 
                  onChangeText={setQuery} 
                  placeholder="Find music buddies..." 
                  placeholderTextColor="#444" 
                  style={dynamicStyles.searchInput} 
                  onSubmitEditing={searchUsers} 
                />
                {searching && <ActivityIndicator size="small" color="#1DB954" />}
              </View>
            </View>
            
            {searchResults.length > 0 ? (
              <View style={dynamicStyles.listSection}>
                <Text style={dynamicStyles.sectionHeader}>People Found</Text>
                {searchResults.map(u => <UserItem key={u._id||u.id} item={u} type="search" onAction={handleAction} />)}
              </View>
            ) : query && !searching ? (
              <View style={dynamicStyles.emptyResults}>
                <MaterialCommunityIcons name="account-search-outline" size={48} color="#222" />
                <Text style={dynamicStyles.emptyResultsText}>No one found with that name</Text>
              </View>
            ) : (
                <View style={dynamicStyles.findPrompt}>
                  <MaterialCommunityIcons name="earth" size={80} color="#111" />
                  <Text style={dynamicStyles.findPromptText}>Type a name to discover listeners</Text>
                </View>
            )}
          </>
        )}

        {activeTab === 'friends' && (
          <View style={dynamicStyles.listSection}>
            <Text style={dynamicStyles.sectionHeader}>Online Friends ({friends.length})</Text>
            {friends.length === 0 ? (
              <View style={dynamicStyles.emptyResults}>
                <MaterialCommunityIcons name="account-multiple-outline" size={64} color="#1A1A1A" />
                <Text style={dynamicStyles.emptyResultsText}>Your friends list is empty</Text>
              </View>
            ) : (friends.map(f => <UserItem key={f._id||f.id} item={f} type="friend" onAction={handleAction} />))}
          </View>
        )}

        {activeTab === 'received' && (
          <View style={dynamicStyles.listSection}>
            <Text style={dynamicStyles.sectionHeader}>New Friend Requests</Text>
            {received.length === 0 ? (
              <View style={dynamicStyles.emptyResults}>
                <MaterialCommunityIcons name="email-check-outline" size={64} color="#1A1A1A" />
                <Text style={dynamicStyles.emptyResultsText}>All caught up! No requests.</Text>
              </View>
            ) : (received.map(u => <UserItem key={u._id||u.id} item={u} type="received" onAction={handleAction} />))}
          </View>
        )}

        {activeTab === 'sent' && (
          <View style={dynamicStyles.listSection}>
            <Text style={dynamicStyles.sectionHeader}>Pending Sent Requests</Text>
            {sent.length === 0 ? (
              <View style={dynamicStyles.emptyResults}>
                <MaterialCommunityIcons name="send-outline" size={64} color="#1A1A1A" />
                <Text style={dynamicStyles.emptyResultsText}>No pending sent requests</Text>
              </View>
            ) : (sent.map(u => <UserItem key={u._id||u.id} item={u} type="sent" onAction={handleAction} />))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: any, accentColor: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },
  title: { color: theme.text, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: theme.textSecondary, fontSize: 14, marginTop: 4 },
  
  tabWrapper: { marginBottom: 14 },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: 'transparent' },
  activeTabBtn: { backgroundColor: accentColor, borderColor: accentColor },
  tabText: { color: theme.textSecondary, fontWeight: '700', fontSize: 12 },
  activeTabText: { color: theme.background },
  
  badge: { backgroundColor: '#EF5350', marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: theme.text, fontSize: 10, fontWeight: '900' },
  
  searchContainer: { paddingHorizontal: 16, marginBottom: 20 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 14, height: 42, borderWidth: 1, borderColor: theme.surfaceDarker },
  searchInput: { flex: 1, color: theme.text, fontSize: 14, marginLeft: 8, fontWeight: '500' },
  
  listSection: { paddingHorizontal: 16, marginTop: 10 },
  sectionHeader: { color: theme.border, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 1 },
  
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.card, padding: 14, borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarMini: { width: 44, height: 44, borderRadius: 22, backgroundColor: accentColor, padding: 2 },
  avatarGradient: { flex: 1, borderRadius: 20, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: accentColor, fontSize: 18, fontWeight: '900' },
  nameText: { color: theme.text, fontSize: 16, fontWeight: '700' },
  emailText: { color: theme.textSecondary, fontSize: 12, marginTop: 1 },
  
  actions: { flexDirection: 'row', gap: 10 },
  actionButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  nglBtn: { backgroundColor: '#BB86FC', borderColor: '#BB86FC' },
  addBtn: { backgroundColor: accentColor, borderColor: accentColor },
  acceptBtn: { backgroundColor: '#1DB954', borderColor: '#1DB954' },
  declineBtn: { backgroundColor: '#EF5350', borderColor: '#EF5350' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  nglModal: { width: '85%', backgroundColor: theme.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: theme.surfaceDarker },
  nglHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  nglTitle: { color: theme.text, fontSize: 18, fontWeight: '800' },
  nglSub: { color: theme.textSecondary, fontSize: 12, marginBottom: 16 },
  nglInput: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, color: theme.text, fontSize: 15, textAlignVertical: 'top', height: 120, borderWidth: 1, borderColor: theme.border, marginBottom: 20 },
  nglActions: { flexDirection: 'row', gap: 10 },
  nglCancel: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: theme.surfaceDarker },
  nglCancelText: { color: theme.textSecondary, fontWeight: '800', fontSize: 12 },
  nglSend: { flex: 2, paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: '#BB86FC' },
  nglSendText: { color: theme.background, fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },

  emptyResults: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyResultsText: { color: theme.border, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 16 },
  findPrompt: { alignItems: 'center', marginTop: 60 },
  findPromptText: { color: theme.border, fontSize: 14, fontWeight: '700', marginTop: 20 },
});
