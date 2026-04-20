import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, TextInput, ActivityIndicator, ScrollView, Modal } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import axios from 'axios';
import API_URL from '../utils/api';

const UserItem = ({ item, type, onAction }: { item: any, type: string, onAction: (id: string, action: string, extra?: string) => void }) => {
  const id = item._id || item.id;
  const name = item.name || 'User';
  const initial = name.charAt(0).toUpperCase();
  
  return (
    <View style={styles.row}>
      <View style={styles.userInfo}>
        <View style={styles.avatarMini}>
          <View style={styles.avatarGradient}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        </View>
        <View style={{ marginLeft: 4 }}>
          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.emailText} numberOfLines={1}>{item.email}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {type === 'search' && (
          <TouchableOpacity style={[styles.actionButton, styles.addBtn]} onPress={() => onAction(id, 'send')}>
            <MaterialCommunityIcons name="account-plus" size={18} color="#000" />
          </TouchableOpacity>
        )}
        {type === 'received' && (
          <>
            <TouchableOpacity style={[styles.actionButton, styles.acceptBtn]} onPress={() => onAction(id, 'accept')}>
              <MaterialCommunityIcons name="check" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.declineBtn]} onPress={() => onAction(id, 'decline')}>
              <MaterialCommunityIcons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        )}
        {type === 'sent' && (
          <TouchableOpacity style={[styles.actionButton, styles.declineBtn]} onPress={() => onAction(id, 'cancel')}>
            <MaterialCommunityIcons name="account-cancel" size={18} color="#fff" />
          </TouchableOpacity>
        )}
        {type === 'friend' && (
          <>
            <TouchableOpacity style={[styles.actionButton, styles.nglBtn]} onPress={() => onAction(id, 'ngl', name)}>
              <MaterialCommunityIcons name="incognito" size={18} color="#BB86FC" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.declineBtn]} onPress={() => onAction(id, 'unfriend', name)}>
              <MaterialCommunityIcons name="account-remove" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

export default function FriendsScreen() {
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
    <View style={styles.container}>
      {/* NGL Send Modal */}
      <Modal visible={!!nglTarget} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.nglModal}>
            <View style={styles.nglHeader}>
              <MaterialCommunityIcons name="incognito" size={24} color="#BB86FC" />
              <Text style={styles.nglTitle}>Send to {nglTarget?.name.split(' ')[0]}</Text>
            </View>
            <Text style={styles.nglSub}>Your identity is strictly hidden</Text>
            <TextInput
              style={styles.nglInput}
              placeholder="What's on your mind?..."
              placeholderTextColor="#444"
              multiline
              numberOfLines={4}
              value={nglText}
              onChangeText={setNglText}
            />
            <View style={styles.nglActions}>
              <TouchableOpacity style={styles.nglCancel} onPress={() => setNglTarget(null)}>
                <Text style={styles.nglCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.nglSend, !nglText.trim() && { opacity: 0.5 }]} 
                onPress={submitNgl}
                disabled={sendingNgl || !nglText.trim()}
              >
                {sendingNgl ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.nglSendText}>SEND ANONYMOUSLY</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.title}>Social Hub</Text>
        <Text style={styles.subtitle}>Connect and listen together</Text>
      </View>

      <View style={styles.tabWrapper}>
        <View style={styles.tabContainer}>
          {[
            { id: 'friends', label: 'Friends', icon: 'account-multiple' },
            { id: 'received', label: 'Received', icon: 'account-arrow-left', badge: received.length },
            { id: 'sent', label: 'Sent', icon: 'account-arrow-right', badge: sent.length },
            { id: 'search', label: 'Find', icon: 'account-search' }
          ].map(tab => (
            <TouchableOpacity 
              key={tab.id} 
              style={[styles.tabBtn, activeTab === tab.id && styles.activeTabBtn]} 
              onPress={() => setActiveTab(tab.id as any)}
            >
              <View style={styles.tabIconGroup}>
                <MaterialCommunityIcons name={tab.icon} size={20} color={activeTab === tab.id ? '#1DB954' : '#666'} />
                {tab.badge ? (
                  <View style={styles.badge}><Text style={styles.badgeText}>{tab.badge}</Text></View>
                ) : null}
              </View>
              <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {activeTab === 'search' && (
          <>
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <MaterialCommunityIcons name="magnify" size={22} color="#444" />
                <TextInput 
                  value={query} 
                  onChangeText={setQuery} 
                  placeholder="Find music buddies..." 
                  placeholderTextColor="#444" 
                  style={styles.searchInput} 
                  onSubmitEditing={searchUsers} 
                />
                {searching && <ActivityIndicator size="small" color="#1DB954" />}
              </View>
            </View>
            
            {searchResults.length > 0 ? (
              <View style={styles.listSection}>
                <Text style={styles.sectionHeader}>People Found</Text>
                {searchResults.map(u => <UserItem key={u._id||u.id} item={u} type="search" onAction={handleAction} />)}
              </View>
            ) : query && !searching ? (
              <View style={styles.emptyResults}>
                <MaterialCommunityIcons name="account-search-outline" size={48} color="#222" />
                <Text style={styles.emptyResultsText}>No one found with that name</Text>
              </View>
            ) : (
                <View style={styles.findPrompt}>
                  <MaterialCommunityIcons name="earth" size={80} color="#111" />
                  <Text style={styles.findPromptText}>Type a name to discover listeners</Text>
                </View>
            )}
          </>
        )}

        {activeTab === 'friends' && (
          <View style={styles.listSection}>
            <Text style={styles.sectionHeader}>Online Friends ({friends.length})</Text>
            {friends.length === 0 ? (
              <View style={styles.emptyResults}>
                <MaterialCommunityIcons name="account-multiple-outline" size={64} color="#1A1A1A" />
                <Text style={styles.emptyResultsText}>Your friends list is empty</Text>
              </View>
            ) : (friends.map(f => <UserItem key={f._id||f.id} item={f} type="friend" onAction={handleAction} />))}
          </View>
        )}

        {activeTab === 'received' && (
          <View style={styles.listSection}>
            <Text style={styles.sectionHeader}>New Friend Requests</Text>
            {received.length === 0 ? (
              <View style={styles.emptyResults}>
                <MaterialCommunityIcons name="email-check-outline" size={64} color="#1A1A1A" />
                <Text style={styles.emptyResultsText}>All caught up! No requests.</Text>
              </View>
            ) : (received.map(u => <UserItem key={u._id||u.id} item={u} type="received" onAction={handleAction} />))}
          </View>
        )}

        {activeTab === 'sent' && (
          <View style={styles.listSection}>
            <Text style={styles.sectionHeader}>Pending Sent Requests</Text>
            {sent.length === 0 ? (
              <View style={styles.emptyResults}>
                <MaterialCommunityIcons name="send-outline" size={64} color="#1A1A1A" />
                <Text style={styles.emptyResultsText}>No pending sent requests</Text>
              </View>
            ) : (sent.map(u => <UserItem key={u._id||u.id} item={u} type="sent" onAction={handleAction} />))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20 },
  title: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: '#666', fontSize: 14, marginTop: 4 },
  
  tabWrapper: { paddingHorizontal: 24, marginBottom: 10 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#0A0A0A', borderRadius: 20, padding: 6, borderWidth: 1, borderColor: '#1A1A1A' },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 15, gap: 4 },
  activeTabBtn: { backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  tabIconGroup: { position: 'relative' },
  tabText: { fontSize: 10, color: '#444', fontWeight: '800', textTransform: 'uppercase' },
  activeTabText: { color: '#1DB954' },
  
  badge: { position: 'absolute', top: -4, right: -12, backgroundColor: '#EF5350', minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0A0A0A' },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  
  searchContainer: { paddingHorizontal: 24, marginBottom: 20 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A0A0A', borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: '#1A1A1A' },
  searchInput: { flex: 1, color: '#fff', fontSize: 16, marginLeft: 10, fontWeight: '500' },
  
  listSection: { paddingHorizontal: 24, marginTop: 10 },
  sectionHeader: { color: '#333', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 1 },
  
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#080808', padding: 14, borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: '#111' },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarMini: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1DB954', padding: 2 },
  avatarGradient: { flex: 1, borderRadius: 20, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#1DB954', fontSize: 18, fontWeight: '900' },
  nameText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emailText: { color: '#444', fontSize: 12, marginTop: 1 },
  
  actions: { flexDirection: 'row', gap: 10 },
  actionButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  nglBtn: { backgroundColor: '#BB86FC15', borderColor: '#BB86FC40' },
  addBtn: { backgroundColor: '#1DB954' },
  acceptBtn: { backgroundColor: '#1DB95420', borderColor: '#1DB95440' },
  declineBtn: { backgroundColor: '#EF535020', borderColor: '#EF535040' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  nglModal: { width: '85%', backgroundColor: '#0A0A0A', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1A1A1A' },
  nglHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  nglTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  nglSub: { color: '#666', fontSize: 12, marginBottom: 16 },
  nglInput: { backgroundColor: '#111', borderRadius: 16, padding: 16, color: '#FFF', fontSize: 15, textAlignVertical: 'top', height: 120, borderWidth: 1, borderColor: '#222', marginBottom: 20 },
  nglActions: { flexDirection: 'row', gap: 10 },
  nglCancel: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: '#1A1A1A' },
  nglCancelText: { color: '#666', fontWeight: '800', fontSize: 12 },
  nglSend: { flex: 2, paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: '#BB86FC' },
  nglSendText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },

  emptyResults: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyResultsText: { color: '#333', fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 16 },
  findPrompt: { alignItems: 'center', marginTop: 60 },
  findPromptText: { color: '#222', fontSize: 14, fontWeight: '700', marginTop: 20 },
});
