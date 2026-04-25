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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tone, setTone] = useState<{ url: string, name: string } | null>(null);
  const [duration, setDuration] = useState(30);
  const [repetitionOn, setRepetitionOn] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
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
        toneUrl: tone?.url || null,
        duration,
        repetitionOn,
        repeatCount: repetitionOn ? repeatCount : 0
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
      showToast('Failed to save alarm', 'error');
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
    setDuration(alarm.duration || 30);
    setRepetitionOn(alarm.repetitionOn || false);
    setRepeatCount(alarm.repeatCount || 0);
    setShowCreate(true);
  };

  const deleteAlarm = async (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await axios.delete(`${API_URL}/api/alarms/${deleteId}`, { headers });
      await notificationService.cancelAlarmNotification(deleteId);
      loadAlarms();
      showToast('Alarm deleted', 'success');
    } catch (err) {
      showToast('Failed to delete alarm', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const resetForm = () => {
    setTitle(''); 
    setMessage('');
    setTriggerDate(new Date());
    setTone(null);
    setEditingId(null);
    setDuration(30);
    setRepetitionOn(false);
    setRepeatCount(0);
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

      {/* Small Attractive Toastbar for Next Alarm */}
      {(() => {
        const nextAlarm = alarms
          .filter(a => !a.isTriggered && new Date(a.triggerAt) > new Date())
          .sort((a, b) => new Date(a.triggerAt).getTime() - new Date(b.triggerAt).getTime())[0];
        
        if (!nextAlarm) return null;

        return (
          <View style={styles.nextAlarmToast}>
            <View style={styles.toastGlow} />
            <MaterialCommunityIcons name="clock-fast" size={18} color="#1DB954" style={styles.toastIcon} />
            <Text style={styles.toastTitle} numberOfLines={1}>{nextAlarm.title}</Text>
            <View style={styles.toastDivider} />
            <AlarmCountdown 
              triggerAt={nextAlarm.triggerAt} 
              isPast={false} 
              color="#1DB954" 
              style={styles.toastCountdown} 
            />
          </View>
        );
      })()}

      {/* Create Alarm Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Alarm' : 'Set Alarm'}</Text>
            <Text style={styles.modalSubTitle}>Enter date and time details below</Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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

              <Text style={styles.fieldLabel}>Alarm Tone</Text>
              <TouchableOpacity style={styles.toneBtn} onPress={pickTone}>
                 <View style={styles.toneIconContainer}>
                   <MaterialCommunityIcons name="cloud-upload-outline" size={24} color={tone ? '#1DB954' : '#888'} />
                 </View>
                 <View style={styles.toneTextContainer}>
                   <Text style={[styles.toneMainText, tone && {color: '#fff'}]}>
                     {tone ? tone.name : 'Choose Alarm Tone'}
                   </Text>
                   <Text style={styles.toneSubText}>
                     {tone ? 'File selected' : 'Tap to browse audio files'}
                   </Text>
                 </View>
                 {tone ? (
                   <TouchableOpacity onPress={() => setTone(null)} style={styles.clearToneBtn}>
                     <MaterialCommunityIcons name="close-circle" size={20} color="#FF5252" />
                   </TouchableOpacity>
                 ) : (
                   <MaterialCommunityIcons name="chevron-right" size={20} color="#333" />
                 )}
              </TouchableOpacity>

              {/* Duration and Repetition */}
              <View style={styles.optionsRow}>
                <View style={styles.optionItem}>
                  <Text style={styles.fieldLabel}>Duration</Text>
                  <View style={styles.durationButtons}>
                    {[15, 30, 60, 300].map(val => (
                      <TouchableOpacity 
                        key={val} 
                        style={[styles.smallBtn, duration === val && styles.activeSmallBtn]}
                        onPress={() => setDuration(val)}
                      >
                        <Text style={[styles.smallBtnText, duration === val && styles.activeSmallBtnText]}>
                          {val < 60 ? `${val}s` : `${val/60}m`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.repetitionContainer}>
                <View style={styles.repetitionHeader}>
                  <Text style={styles.fieldLabel}>Repeat Alarm</Text>
                  <TouchableOpacity 
                    onPress={() => setRepetitionOn(!repetitionOn)}
                    style={[styles.toggleBtn, repetitionOn && styles.toggleOn]}
                  >
                    <View style={[styles.toggleCircle, repetitionOn && styles.toggleCircleOn]} />
                  </TouchableOpacity>
                </View>
                
                {repetitionOn && (
                  <View style={styles.repeatCountRow}>
                    <Text style={styles.repeatLabel}>Repeat Count:</Text>
                    <View style={styles.countActions}>
                      <TouchableOpacity onPress={() => setRepeatCount(Math.max(0, repeatCount - 1))} style={styles.countBtn}>
                        <MaterialCommunityIcons name="minus" size={20} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.countValue}>{repeatCount}</Text>
                      <TouchableOpacity onPress={() => setRepeatCount(Math.min(10, repeatCount + 1))} style={styles.countBtn}>
                        <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Fixed Actions at Bottom */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowCreate(false); resetForm(); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={createAlarm} disabled={creating}>
                {creating ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmText}>{editingId ? 'Save Changes' : 'Set Alarm'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={!!deleteId} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmContent}>
            <View style={styles.confirmGlow} />
            <View style={styles.dangerIconContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={32} color="#EF5350" />
            </View>
            <Text style={styles.confirmTitle}>Delete Alarm?</Text>
            <Text style={styles.confirmSubTitle}>This action cannot be undone. Are you sure you want to remove this alarm?</Text>
            
            <View style={styles.confirmActions}>
              <TouchableOpacity 
                style={styles.cancelConfirmBtn} 
                onPress={() => setDeleteId(null)}
              >
                <Text style={styles.cancelConfirmText}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteConfirmBtn} 
                onPress={confirmDelete}
              >
                <Text style={styles.deleteConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EF535040',
    shadowColor: '#EF5350',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  editBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1DB95440',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'flex-end' },
  modalScroll: { maxHeight: 400 },
  scrollContent: { paddingBottom: 10 },
  modalContent: { 
    backgroundColor: '#0A0A0A', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 16, 
    paddingTop: 10,
    paddingBottom: 20,
    borderWidth: 1.5,
    borderColor: '#1DB95420',
    maxHeight: '90%'
  },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 2, textAlign: 'center', letterSpacing: -0.5 },
  modalSubTitle: { color: '#555', fontSize: 12, textAlign: 'center', marginBottom: 8, fontWeight: '500' },
  fieldLabel: { color: '#888', fontSize: 11, fontWeight: '800', marginBottom: 2, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInput: { 
    backgroundColor: '#000', 
    color: '#fff', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 12, 
    fontSize: 15, 
    borderWidth: 1.5, 
    borderColor: '#222', 
    marginBottom: 4,
    fontWeight: '600'
  },
  msgInput: { height: 70, textAlignVertical: 'top' },
  // Pickers
  pickerContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  pickerSection: { flex: 1 },
  pickerBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#0F0F0F', 
    padding: 10, 
    borderRadius: 10, 
    borderWidth: 1.5, 
    borderColor: '#333',
    gap: 8,
    marginTop: 2
  },
  pickerBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  // Actions
  modalActions: { flexDirection: 'row', gap: 15, marginTop: 15 },
  cancelBtn: { 
    flex: 1, 
    backgroundColor: '#111', 
    paddingVertical: 10, 
    borderRadius: 18, 
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#222'
  },
  cancelText: { color: '#777', fontWeight: '700', fontSize: 15 },
  confirmBtn: { 
    flex: 2, 
    backgroundColor: '#1DB954', 
    paddingVertical: 10, 
    borderRadius: 18, 
    alignItems: 'center',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8
  },
  confirmText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
  toneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5, 
    borderColor: '#333',
    borderStyle: 'dashed',
    gap: 12,
  },
  toneIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222'
  },
  toneTextContainer: { flex: 1 },
  toneMainText: { color: '#AAA', fontSize: 14, fontWeight: '700' },
  toneSubText: { color: '#555', fontSize: 11, marginTop: 2 },
  clearToneBtn: { padding: 4 },
  toneText: { color: '#666', fontSize: 14, flex: 1 },
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
  // Next Alarm Toastbar
  nextAlarmToast: {
    position: 'absolute',
    bottom: 30,
    left: '10%',
    right: '10%',
    backgroundColor: '#121212',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#1DB95440',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 100,
  },
  toastGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1DB95405',
    borderRadius: 24,
  },
  toastIcon: {
    marginRight: 10,
  },
  toastTitle: {
    color: '#EEE',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.2,
  },
  toastDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#333',
    marginHorizontal: 12,
  },
  toastCountdown: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1DB954',
  },
  // Confirm Modal
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  confirmContent: {
    backgroundColor: '#0A0A0A',
    borderRadius: 32,
    padding: 30,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EF535030',
    overflow: 'hidden'
  },
  confirmGlow: {
    position: 'absolute',
    top: -50,
    width: 200,
    height: 100,
    backgroundColor: '#EF535010',
    borderRadius: 100,
    transform: [{ scaleX: 2 }],
    opacity: 0.5
  },
  dangerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF535010',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EF535030'
  },
  confirmTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
    letterSpacing: -0.5
  },
  confirmSubTitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
    paddingHorizontal: 10
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%'
  },
  cancelConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333'
  },
  cancelConfirmText: {
    color: '#AAA',
    fontWeight: '700',
    fontSize: 14
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#EF5350',
    shadowColor: '#EF5350',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  deleteConfirmText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14
  },
  optionsRow: { marginTop: 4 },
  optionItem: { marginBottom: 5 },
  durationButtons: { flexDirection: 'row', gap: 10, marginTop: 1 },
  smallBtn: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#333',
    backgroundColor: '#000'
  },
  activeSmallBtn: { backgroundColor: '#1DB954', borderColor: '#1DB954' },
  smallBtnText: { color: '#888', fontSize: 11, fontWeight: '700' },
  activeSmallBtnText: { color: '#000' },
  repetitionContainer: { 
    marginTop: 15, 
    backgroundColor: '#0F0F0F', 
    padding: 12, 
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222'
  },
  repetitionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleBtn: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#333', padding: 2 },
  toggleOn: { backgroundColor: '#1DB954' },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleCircleOn: { alignSelf: 'flex-end' },
  repeatCountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#222' },
  repeatLabel: { color: '#AAA', fontSize: 13, fontWeight: '600' },
  countActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  countBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  countValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
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
