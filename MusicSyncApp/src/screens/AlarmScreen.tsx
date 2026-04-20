import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  Modal, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import API_URL from '../utils/api';
import { useToast } from '../context/ToastContext';
import * as DocumentPicker from '@react-native-documents/picker';
import Video from 'react-native-video';
import { notificationService } from '../utils/notifications';
import { AlarmCountdown } from '../components/AlarmCountdown';
import { useAlarms } from '../context/AlarmContext';

export default function AlarmScreen() {
  const auth = useContext(AuthContext);
  const { showToast } = useToast();
  const { alarms, loadAlarms, dismissAlarm } = useAlarms();
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  // No more screen-wide 'now' state to prevent flickering

  // Form fields
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [triggerDate, setTriggerDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const hourRef = useRef<FlatList>(null);
  const minRef = useRef<FlatList>(null);
  const [tempTime, setTempTime] = useState({ hours: new Date().getHours(), minutes: new Date().getMinutes() });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tone, setTone] = useState<{ url: string, name: string } | null>(null);
  // activeToneUrl moved to global AlarmContext

  const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : {};

  useEffect(() => { loadAlarms(); }, []);

  // Alarm triggering and dismissal now handled globally via useAlarms() hook

  const prefillCurrent = () => {
    setTriggerDate(new Date());
  };

  useEffect(() => {
    if (showCreate) {
      prefillCurrent();
    }
  }, [showCreate]);

  const createAlarm = async () => {
    if (triggerDate <= new Date()) {
      showToast('Alarm must be set for a future time', 'warning');
      return;
    }

    setCreating(true);
    try {
      const body = {
        triggerAt: triggerDate.toISOString(),
        message: message.trim(),
        title: title.trim() || 'Alarm',
        toneUrl: tone?.url || null
      };

      if (editingId) {
        const resp = await axios.put(`${API_URL}/api/alarms/${editingId}`, body, { headers });
        showToast('Alarm updated!', 'success');
        // Re-schedule notification
        await notificationService.scheduleAlarmNotification(
          editingId, 
          body.title, 
          body.message, 
          triggerDate
        );
      } else {
        const resp = await axios.post(`${API_URL}/api/alarms`, body, { headers });
        showToast('Alarm set!', 'success');
        // Schedule notification
        if (resp.data?._id) {
          await notificationService.scheduleAlarmNotification(
            resp.data._id, 
            body.title, 
            body.message, 
            triggerDate
          );
        }
      }
      
      setShowCreate(false);
      resetForm();
      loadAlarms();
    } catch (err: any) {
      Alert.alert('Error', 'Failed to save alarm');
    } finally {
      setCreating(false);
    }
  };

  const pickTone = async () => {
    try {
      const [res] = await DocumentPicker.pick({
        type: [DocumentPicker.types.audio],
      });
      setTone({ url: res.uri, name: res.name || 'Custom Tone' });
    } catch (err: any) {
      if (DocumentPicker.isErrorWithCode(err) && err.code === DocumentPicker.errorCodes.OPERATION_CANCELED) {
        // user cancelled
      } else {
        console.warn(err);
      }
    }
  };

  const openEdit = (alarm: Alarm) => {
    setEditingId(alarm._id);
    setTitle(alarm.title);
    setMessage(alarm.message);
    setTriggerDate(new Date(alarm.triggerAt));
    setTone(alarm.toneUrl ? { url: alarm.toneUrl, name: 'Saved Tone' } : null);
    setShowCreate(true);
  };

  const deleteAlarm = async (id: string) => {
    Alert.alert('Delete Alarm', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${API_URL}/api/alarms/${id}`, { headers });
            await notificationService.cancelAlarmNotification(id);
            loadAlarms();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete');
          }
        }
      }
    ]);
  };

  const resetForm = () => {
    setTitle(''); 
    setMessage('');
    setTriggerDate(new Date());
    setTone(null);
    setEditingId(null);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const dateFormatted = d.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });
    const timeFormatted = d.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });

    let relative = '';
    if (diffDays === 0) relative = 'Today';
    else if (diffDays === 1) relative = 'Tomorrow';
    else if (diffDays < 30) relative = `In ${diffDays} days`;
    else if (diffDays < 365) relative = `In ${Math.floor(diffDays / 30)} months`;
    else relative = `In ${Math.floor(diffDays / 365)} years`;

    return { dateFormatted, timeFormatted, relative, isPast: diffMs < 0 };
  };

  const getAlarmTheme = (alarm: Alarm, index: number) => {
    const d = new Date(alarm.triggerAt);
    const currentTime = new Date();
    const diffMs = d.getTime() - currentTime.getTime();
    
    // Status over index for Expired
    if (diffMs < 0) return { color: '#EF5350', bg: '#080303' }; // Ultra Deep Red

    // Palette for active alarms: Green, Purple, Orange, Blue
    const palette = [
      { color: '#1DB954', bg: '#040B07' }, // Ultra Deep Green
      { color: '#BB86FC', bg: '#05040A' }, // Ultra Deep Purple
      { color: '#FFB74D', bg: '#080503' }, // Ultra Deep Orange
      { color: '#64B5F6', bg: '#030508' }, // Ultra Deep Blue
    ];
    return palette[index % palette.length];
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}><MaterialCommunityIcons name="alarm" size={26} color="#1DB954" /> Alarms</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <MaterialCommunityIcons name="plus-circle" size={28} color="#1DB954" />
        </TouchableOpacity>
      </View>

      {/* Alarm list */}
      {loading ? (
        <ActivityIndicator size="large" color="#1DB954" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={alarms}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const { dateFormatted, timeFormatted, relative, isPast } = formatDate(item.triggerAt);
            const { color, bg } = getAlarmTheme(item, index);
            const isFirst = index === 0;
            return (
              <View style={[
                styles.alarmCard, 
                { backgroundColor: isFirst ? '#050D08' : bg }, // Dimmer Green Atmosphere
                isFirst && { 
                  borderColor: '#1DB95460', // Dimmer theme green border
                  shadowColor: '#1DB954',   
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.25,      // Dimmer Glow
                  shadowRadius: 15,
                  elevation: 10
                }
              ]}>
                {/* Decorative High-Fidelity Accents - Subtler */}
                <View style={[styles.gridBlob, { 
                  backgroundColor: color + '15',
                  width: isFirst ? 130 : 100,
                  height: isFirst ? 130 : 100,
                }]} />
                <View style={[styles.gridDot, { backgroundColor: color + '25' }]} />
                
                <View style={styles.alarmHeader}>
                  <View style={[styles.alarmIndicator, { backgroundColor: color, height: isFirst ? 32 : 28 }]} />
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => openEdit(item)}>
                    <Text style={[styles.alarmTitle, isFirst && { fontSize: 22 }]}>{item.title}</Text>
                    <View style={styles.statusBadgeRow}>
                      <AlarmCountdown triggerAt={item.triggerAt} isPast={isPast} color={color} />
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Bubble Action Buttons */}
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => deleteAlarm(item._id)} style={styles.deleteBubble}>
                    <MaterialCommunityIcons name="close" size={18} color="#EF5350" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEdit(item)} style={[styles.editBubble, { borderColor: color + '40' }]}>
                    <MaterialCommunityIcons name="pencil" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>

                <View style={styles.alarmTime}>
                  <MaterialCommunityIcons name="calendar-clock" size={16} color="#888" />
                  <Text style={styles.alarmDateText}>{dateFormatted} at {timeFormatted}</Text>
                </View>

                {item.message ? (
                  <View style={styles.alarmMessage}>
                    <MaterialCommunityIcons name="message-text" size={14} color="#666" />
                    <Text style={styles.alarmMsgText}>{item.message}</Text>
                  </View>
                ) : null}

                {item.toneUrl && (
                  <View style={styles.tonePreview}>
                    <MaterialCommunityIcons name="music-circle" size={14} color="#1DB95490" />
                    <Text style={styles.tonePreviewText}>Custom Tone Link Active</Text>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="alarm-off" size={48} color="#333" />
              <Text style={styles.emptyText}>No alarms set</Text>
              <Text style={styles.emptySubtext}>Set alarms for days, months, or years ahead!</Text>
            </View>
          }
          onRefresh={loadAlarms}
          refreshing={loading}
        />
      )}

      {/* Create Alarm Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Alarm' : 'Set Alarm'}</Text>

            {/* Title */}
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.modalInput}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Birthday Reminder"
              placeholderTextColor="#555"
              maxLength={50}
            />

            <Text style={styles.modalSubTitle}>Enter date and time details below</Text>

            {/* Date and Time Pickers */}
            <View style={styles.pickerContainer}>
              <View style={styles.pickerSection}>
                <Text style={styles.fieldLabel}>Date</Text>
                <TouchableOpacity 
                  style={styles.pickerBtn} 
                  onPress={() => setShowDatePicker(true)}
                >
                  <MaterialCommunityIcons name="calendar" size={20} color="#1DB954" />
                  <Text style={styles.pickerBtnText}>
                    {triggerDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.pickerSection}>
                <Text style={styles.fieldLabel}>Time</Text>
                <TouchableOpacity 
                  style={styles.pickerBtn} 
                  onPress={() => setShowTimePicker(true)}
                >
                  <MaterialCommunityIcons name="clock-outline" size={20} color="#1DB954" />
                  <Text style={styles.pickerBtnText}>
                    {triggerDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={triggerDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    const newDate = new Date(triggerDate);
                    newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                    setTriggerDate(newDate);
                  }
                }}
              />
            )}

            {/* Custom Dark Time Picker Modal */}
            <Modal visible={showTimePicker} transparent animationType="fade">
              <View style={styles.pickerModalOverlay}>
                <View style={styles.customPickerContent}>
                  <Text style={styles.customPickerTitle}>Select Time</Text>
                  
                  <View style={styles.wheelContainer}>
                    {/* Hours Wheel */}
                    <View style={styles.wheelWrapper}>
                      <FlatList
                        ref={hourRef}
                        data={Array.from({ length: 24 }, (_, i) => i)}
                        keyExtractor={item => `h-${item}`}
                        snapToInterval={40}
                        decelerationRate="fast"
                        initialScrollIndex={triggerDate.getHours()}
                        getItemLayout={(_, index) => ({ length: 40, offset: 40 * index, index })}
                        showsVerticalScrollIndicator={false}
                        onMomentumScrollEnd={(e) => {
                          const h = Math.round(e.nativeEvent.contentOffset.y / 40);
                          setTempTime(prev => ({ ...prev, hours: h }));
                        }}
                        contentContainerStyle={{ paddingVertical: 80 }}
                        renderItem={({ item }) => (
                          <View style={styles.wheelItem}>
                            <Text style={[styles.wheelItemText, tempTime.hours === item && styles.wheelItemActive]}>
                              {String(item).padStart(2, '0')}
                            </Text>
                          </View>
                        )}
                      />
                    </View>

                    <Text style={styles.wheelDivider}>:</Text>

                    {/* Minutes Wheel */}
                    <View style={styles.wheelWrapper}>
                      <FlatList
                        ref={minRef}
                        data={Array.from({ length: 60 }, (_, i) => i)}
                        keyExtractor={item => `m-${item}`}
                        snapToInterval={40}
                        decelerationRate="fast"
                        initialScrollIndex={triggerDate.getMinutes()}
                        getItemLayout={(_, index) => ({ length: 40, offset: 40 * index, index })}
                        showsVerticalScrollIndicator={false}
                        onMomentumScrollEnd={(e) => {
                          const m = Math.round(e.nativeEvent.contentOffset.y / 40);
                          setTempTime(prev => ({ ...prev, minutes: m }));
                        }}
                        contentContainerStyle={{ paddingVertical: 80 }}
                        renderItem={({ item }) => (
                          <View style={styles.wheelItem}>
                            <Text style={[styles.wheelItemText, tempTime.minutes === item && styles.wheelItemActive]}>
                              {String(item).padStart(2, '0')}
                            </Text>
                          </View>
                        )}
                      />
                    </View>
                  </View>

                  <View style={styles.pickerActions}>
                    <TouchableOpacity 
                      style={styles.pickerCancel} 
                      onPress={() => setShowTimePicker(false)}
                    >
                      <Text style={styles.pickerCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.pickerConfirm} 
                      onPress={() => {
                        const newDate = new Date(triggerDate);
                        newDate.setHours(tempTime.hours, tempTime.minutes);
                        setTriggerDate(newDate);
                        setShowTimePicker(false);
                      }}
                    >
                      <Text style={styles.pickerConfirmText}>Set Time</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Message */}
            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput
              style={[styles.modalInput, styles.msgInput]}
              value={message}
              onChangeText={setMessage}
              placeholder="Add a note or reminder text..."
              placeholderTextColor="#555"
              multiline
              numberOfLines={3}
              maxLength={200}
            />

            {/* Tone Selection */}
            <Text style={styles.fieldLabel}>Alarm Tone</Text>
            <TouchableOpacity style={styles.toneBtn} onPress={pickTone}>
               <MaterialCommunityIcons name="music-note-outline" size={20} color={tone ? '#1DB954' : '#666'} />
               <Text style={[styles.toneText, tone && {color: '#fff'}]}>
                 {tone ? tone.name : 'Select from device (optional)'}
               </Text>
               {tone && (
                 <TouchableOpacity onPress={() => setTone(null)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                   <MaterialCommunityIcons name="close-circle" size={18} color="#FF5252" />
                 </TouchableOpacity>
               )}
            </TouchableOpacity>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowCreate(false); resetForm(); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={createAlarm} disabled={creating}>
                {creating ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmText}>{editingId ? 'Save Changes' : 'Set Alarm'}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 25 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  addBtn: { padding: 4 },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 100 },
  // Alarm card
  alarmCard: { 
    backgroundColor: '#111', 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 16, 
    borderWidth: 1.5, 
    borderColor: '#333',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5
  },
  gridBlob: {
    position: 'absolute',
    top: -25,
    right: -25,
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  gridDot: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  alarmHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  alarmIndicator: { width: 4, height: 28, borderRadius: 2, marginRight: 15 },
  alarmTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statusBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  statusBadge: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  cardActions: { position: 'absolute', right: 16, top: 16, gap: 12, alignItems: 'center' },
  deleteBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EF535015',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#333',
  },
  editBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#333',
  },
  alarmTime: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 12 },
  alarmDateText: { color: '#AAA', fontSize: 13, fontWeight: '600' },
  alarmMessage: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginTop: 12, 
    backgroundColor: '#000', 
    padding: 12, 
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#333'
  },
  alarmMsgText: { color: '#888', fontSize: 13, fontStyle: 'italic', flex: 1 },
  tonePreview: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, opacity: 0.6 },
  tonePreviewText: { color: '#1DB954', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  // Empty
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#555', fontSize: 16, marginTop: 12 },
  emptySubtext: { color: '#444', fontSize: 13, marginTop: 4 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalScroll: { maxHeight: '85%' },
  modalContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  modalSubTitle: { color: '#666', fontSize: 13, textAlign: 'center', marginBottom: 20 },
  fieldLabel: { color: '#AAA', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  modalInput: { backgroundColor: '#0F0F0F', color: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, fontSize: 15, borderWidth: 1.5, borderColor: '#333', marginBottom: 12 },
  msgInput: { height: 80, textAlignVertical: 'top' },
  // Pickers
  pickerContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  pickerSection: { flex: 1 },
  pickerBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#0F0F0F', 
    padding: 14, 
    borderRadius: 12, 
    borderWidth: 1.5, 
    borderColor: '#333',
    gap: 8,
    marginTop: 4
  },
  pickerBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  // Actions
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, backgroundColor: '#333', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelText: { color: '#fff', fontWeight: '600' },
  confirmBtn: { flex: 1, backgroundColor: '#1DB954', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmText: { color: '#000', fontWeight: '700', fontSize: 16 },
  toneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5, 
    borderColor: '#333',
    gap: 12,
    marginBottom: 20
  },
  toneText: { color: '#666', fontSize: 13, flex: 1 },
  // Custom Picker
  pickerModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  customPickerContent: { backgroundColor: '#141414', borderRadius: 24, padding: 24, width: '80%', borderWidth: 1.5, borderColor: '#333' },
  customPickerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  wheelContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 200, marginBottom: 20 },
  wheelWrapper: { width: 60, height: 200 },
  wheelItem: { height: 40, justifyContent: 'center', alignItems: 'center' },
  wheelItemText: { color: '#444', fontSize: 20, fontWeight: '600' },
  wheelItemActive: { color: '#1DB954', fontSize: 24, fontWeight: '800' },
  wheelDivider: { color: '#555', fontSize: 24, fontWeight: '700', marginHorizontal: 10 },
  pickerActions: { flexDirection: 'row', gap: 12 },
  pickerCancel: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  pickerCancelText: { color: '#888', fontWeight: '600' },
  pickerConfirm: { flex: 2, backgroundColor: '#1DB954', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  pickerConfirmText: { color: '#000', fontWeight: '700' },
});

// Helper Types outside to prevent unnecessary re-creations
type Alarm = {
  _id: string;
  triggerAt: string;
  message: string;
  title: string;
  isTriggered: boolean;
  toneUrl?: string | null;
};
