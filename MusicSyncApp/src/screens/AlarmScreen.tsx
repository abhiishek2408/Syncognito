import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  Modal, Alert, ActivityIndicator, ScrollView, TouchableWithoutFeedback, Keyboard,
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
import RNFS from 'react-native-fs';

export default function AlarmScreen() {
  const { theme, accentColor, isDarkMode } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor, isDarkMode);

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
    const nextMin = new Date();
    nextMin.setMinutes(nextMin.getMinutes() + 1, 0, 0); // 1 min in future, 0 sec
    setTriggerDate(nextMin);
  };

  useEffect(() => {
    if (showCreate) {
      prefillCurrent();
    }
  }, [showCreate]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      // Keep the existing time, just update the date
      const newDate = new Date(triggerDate);
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setTriggerDate(newDate);
    }
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      // Keep the existing date, just update the time
      const newDate = new Date(triggerDate);
      newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      setTriggerDate(newDate);
    }
  };

  const createAlarm = async () => {
    if (triggerDate <= new Date()) {
      showToast('Alarm must be set for a future time', 'warning');
      return;
    }

    setCreating(true);
    try {
      const toneUrl = tone?.url || null;
      
      const body = {
        triggerAt: triggerDate.toISOString(),
        message: message.trim(),
        title: title.trim() || 'Alarm',
        toneUrl: toneUrl,
        duration,
        repetitionOn,
        repeatCount: repetitionOn ? repeatCount : 0
      };

      if (editingId) {
        const resp = await axios.put(`${API_URL}/api/alarms/${editingId}`, body, { headers });
        showToast(toneUrl ? 'Alarm updated with custom tone! 🎉' : 'Alarm updated!', 'success');
        // Re-schedule notification
        await notificationService.scheduleAlarmNotification(
          editingId, 
          body.title, 
          body.message, 
          triggerDate
        );
      } else {
        const resp = await axios.post(`${API_URL}/api/alarms`, body, { headers });
        showToast(toneUrl ? 'Alarm set with custom tone! 🎉' : 'Alarm set!', 'success');
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
      
      setLoading(true);
      const fileName = `alarm_${Date.now()}_${res.name || 'tone.mp3'}`;
      const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      
      // Copy to persistent storage
      await RNFS.copyFile(res.uri, destPath);
      const persistentUri = `file://${destPath}`;
      
      setTone({ url: persistentUri, name: res.name || 'Custom Tone' });
      showToast('Tone saved!', 'success');
    } catch (err: any) {
      if (DocumentPicker.isErrorWithCode(err) && err.code === DocumentPicker.errorCodes.OPERATION_CANCELED) {
        // user cancelled
      } else {
        console.warn(err);
        showToast('Failed to pick audio file', 'error');
      }
    } finally {
      setLoading(false);
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
    if (diffMs < 0) {
      return { 
        color: '#EF5350', 
        bg: isDarkMode ? '#080303' : '#FFEBEE' // Ultra Deep Red vs Light Pink
      };
    }

    // Palette for active alarms: Accent, Purple, Orange, Blue
    const palette = [
      { color: accentColor, bg: isDarkMode ? '#040B07' : theme.surface }, // Uses accent color for the first one
      { color: '#BB86FC', bg: isDarkMode ? '#05040A' : '#F3E5F5' }, // Ultra Deep Purple vs Light Purple
      { color: '#FFB74D', bg: isDarkMode ? '#080503' : '#FFF3E0' }, // Ultra Deep Orange vs Light Orange
      { color: '#64B5F6', bg: isDarkMode ? '#030508' : '#E3F2FD' }, // Ultra Deep Blue vs Light Blue
    ];
    return palette[index % palette.length];
  };

  return (
    <View style={dynamicStyles.container}>
      {/* Header */}
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}><MaterialCommunityIcons name="alarm" size={26} color={accentColor} /> Alarms</Text>
        <TouchableOpacity style={dynamicStyles.addBtn} onPress={() => setShowCreate(true)}>
          <MaterialCommunityIcons name="plus-circle" size={28} color={accentColor} />
        </TouchableOpacity>
      </View>

      {/* Alarm list */}
      {loading ? (
        <ActivityIndicator size="large" color={accentColor} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={alarms}
          keyExtractor={item => item._id}
          contentContainerStyle={dynamicStyles.list}
          renderItem={({ item, index }) => {
            const { dateFormatted, timeFormatted, relative, isPast } = formatDate(item.triggerAt);
            const { color, bg } = getAlarmTheme(item, index);
            const isFirst = index === 0;
            return (
              <View style={[
                dynamicStyles.alarmCard, 
                { backgroundColor: isFirst ? '#050D08' : bg }, // Dimmer Green Atmosphere
                isFirst && { 
                  borderColor: accentColor + '60', // Dimmer theme green border
                  shadowColor: accentColor,   
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.25,      // Dimmer Glow
                  shadowRadius: 15,
                  elevation: 10
                }
              ]}>
                {/* Decorative High-Fidelity Accents - Subtler */}
                <View style={[dynamicStyles.gridBlob, { 
                  backgroundColor: color + '15',
                }]} />
                <View style={[dynamicStyles.gridDot, { backgroundColor: color + '25' }]} />
                
                <View style={dynamicStyles.alarmHeader}>
                  <View style={[dynamicStyles.alarmIndicator, { backgroundColor: color, height: isFirst ? 32 : 28 }]} />
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => openEdit(item)}>
                    <Text style={[dynamicStyles.alarmTitle, isFirst && { fontSize: 22 }]}>{item.title}</Text>
                    <View style={dynamicStyles.statusBadgeRow}>
                      <AlarmCountdown triggerAt={item.triggerAt} isPast={isPast} color={color} />
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Bubble Action Buttons */}
                <View style={dynamicStyles.cardActions}>
                  <TouchableOpacity onPress={() => deleteAlarm(item._id)} style={dynamicStyles.deleteBubble}>
                    <MaterialCommunityIcons name="close" size={18} color="#EF5350" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEdit(item)} style={[dynamicStyles.editBubble, { borderColor: color + '40' }]}>
                    <MaterialCommunityIcons name="pencil" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>

                <View style={dynamicStyles.alarmTime}>
                  <MaterialCommunityIcons name="calendar-clock" size={16} color="#888" />
                  <Text style={dynamicStyles.alarmDateText}>{dateFormatted} at {timeFormatted}</Text>
                </View>

                {item.message ? (
                  <View style={dynamicStyles.alarmMessage}>
                    <MaterialCommunityIcons name="message-text" size={14} color="#666" />
                    <Text style={dynamicStyles.alarmMsgText}>{item.message}</Text>
                  </View>
                ) : null}

                {item.toneUrl && (
                  <View style={dynamicStyles.tonePreview}>
                    <MaterialCommunityIcons name="music-circle" size={14} color={accentColor + '90'} />
                    <Text style={dynamicStyles.tonePreviewText}>Custom Tone Link Active</Text>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={dynamicStyles.empty}>
              <MaterialCommunityIcons name="alarm-off" size={48} color="#333" />
              <Text style={dynamicStyles.emptyText}>No alarms set</Text>
              <Text style={dynamicStyles.emptySubtext}>Set alarms for days, months, or years ahead!</Text>
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
          <View style={dynamicStyles.nextAlarmToast}>
            <View style={dynamicStyles.toastGlow} />
            <MaterialCommunityIcons name="clock-fast" size={18} color={accentColor} style={dynamicStyles.toastIcon} />
            <Text style={dynamicStyles.toastTitle} numberOfLines={1}>{nextAlarm.title}</Text>
            <View style={dynamicStyles.toastDivider} />
            <AlarmCountdown 
              triggerAt={nextAlarm.triggerAt} 
              isPast={false} 
              color={accentColor} 
              style={dynamicStyles.toastCountdown} 
            />
          </View>
        );
      })()}

      {/* Create Alarm Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => { setShowCreate(false); resetForm(); Keyboard.dismiss(); }}>
          <View style={dynamicStyles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>{editingId ? 'Edit Alarm' : 'Set Alarm'}</Text>
            <Text style={dynamicStyles.modalSubTitle}>Enter date and time details below</Text>

            <View style={dynamicStyles.staticContent}>
              {/* Title */}
              <Text style={dynamicStyles.fieldLabel}>Title</Text>
              <TextInput
                style={dynamicStyles.modalInput}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Birthday Reminder"
                placeholderTextColor="#555"
                maxLength={50}
              />

              {/* Date and Time Pickers */}
              <View style={dynamicStyles.pickerContainer}>
                <View style={dynamicStyles.pickerSection}>
                  <Text style={dynamicStyles.fieldLabel}>Date</Text>
                  <TouchableOpacity 
                    style={dynamicStyles.pickerBtn} 
                    onPress={() => setShowDatePicker(true)}
                  >
                    <MaterialCommunityIcons name="calendar" size={20} color={accentColor} />
                    <Text style={dynamicStyles.pickerBtnText}>
                      {triggerDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={dynamicStyles.pickerSection}>
                  <Text style={dynamicStyles.fieldLabel}>Time</Text>
                  <TouchableOpacity 
                    style={dynamicStyles.pickerBtn} 
                    onPress={() => setShowTimePicker(true)}
                  >
                    <MaterialCommunityIcons name="clock-outline" size={20} color={accentColor} />
                    <Text style={dynamicStyles.pickerBtnText}>
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
                  onChange={onDateChange}
                  minimumDate={new Date()}
                />
              )}

              {showTimePicker && (
                <DateTimePicker
                  value={triggerDate}
                  mode="time"
                  display="default"
                  onChange={onTimeChange}
                />
              )}

              {/* Message */}
              <Text style={dynamicStyles.fieldLabel}>Message</Text>
              <TextInput
                style={[dynamicStyles.modalInput, dynamicStyles.msgInput]}
                value={message}
                onChangeText={setMessage}
                placeholder="Add a note or reminder text..."
                placeholderTextColor="#555"
                multiline
                numberOfLines={3}
                maxLength={200}
              />

              <Text style={dynamicStyles.fieldLabel}>Alarm Tone</Text>
              <TouchableOpacity style={dynamicStyles.toneBtn} onPress={pickTone}>
                 <View style={dynamicStyles.toneIconContainer}>
                   <MaterialCommunityIcons name="cloud-upload-outline" size={24} color={tone ? '#1DB954' : '#888'} />
                 </View>
                 <View style={dynamicStyles.toneTextContainer}>
                   <Text style={[dynamicStyles.toneMainText, tone && {color: '#fff'}]}>
                     {tone ? tone.name : 'Choose Alarm Tone'}
                   </Text>
                   <Text style={dynamicStyles.toneSubText}>
                     {tone ? 'File selected' : 'Tap to browse audio files'}
                   </Text>
                 </View>
                 {tone ? (
                   <TouchableOpacity onPress={() => setTone(null)} style={dynamicStyles.clearToneBtn}>
                     <MaterialCommunityIcons name="close-circle" size={20} color="#FF5252" />
                   </TouchableOpacity>
                 ) : (
                   <MaterialCommunityIcons name="chevron-right" size={20} color="#333" />
                 )}
              </TouchableOpacity>

              {/* Duration and Repetition */}
              <View style={dynamicStyles.optionsRow}>
                <View style={dynamicStyles.optionItem}>
                  <Text style={dynamicStyles.fieldLabel}>Duration</Text>
                  <View style={dynamicStyles.durationButtons}>
                    {[15, 30, 60, 300].map(val => (
                      <TouchableOpacity 
                        key={val} 
                        style={[dynamicStyles.smallBtn, duration === val && dynamicStyles.activeSmallBtn]}
                        onPress={() => setDuration(val)}
                      >
                        <Text style={[dynamicStyles.smallBtnText, duration === val && dynamicStyles.activeSmallBtnText]}>
                          {val < 60 ? `${val}s` : `${val/60}m`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View style={dynamicStyles.repetitionContainer}>
                <View style={dynamicStyles.repetitionHeader}>
                  <Text style={dynamicStyles.fieldLabel}>Repeat Alarm</Text>
                  <TouchableOpacity 
                    onPress={() => setRepetitionOn(!repetitionOn)}
                    style={[dynamicStyles.toggleBtn, repetitionOn && dynamicStyles.toggleOn]}
                  >
                    <View style={[dynamicStyles.toggleCircle, repetitionOn && dynamicStyles.toggleCircleOn]} />
                  </TouchableOpacity>
                </View>
                
                {repetitionOn && (
                  <View style={dynamicStyles.repeatCountRow}>
                    <Text style={dynamicStyles.repeatLabel}>Repeat Count:</Text>
                    <View style={dynamicStyles.countActions}>
                      <TouchableOpacity onPress={() => setRepeatCount(Math.max(0, repeatCount - 1))} style={dynamicStyles.countBtn}>
                        <MaterialCommunityIcons name="minus" size={20} color="#fff" />
                      </TouchableOpacity>
                      <Text style={dynamicStyles.countValue}>{repeatCount}</Text>
                      <TouchableOpacity onPress={() => setRepeatCount(Math.min(10, repeatCount + 1))} style={dynamicStyles.countBtn}>
                        <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Fixed Actions at Bottom */}
            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity style={dynamicStyles.cancelBtn} onPress={() => { setShowCreate(false); resetForm(); }}>
                <Text style={dynamicStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.confirmBtn} onPress={createAlarm} disabled={creating}>
                {creating ? <ActivityIndicator color="#000" /> : <Text style={dynamicStyles.confirmText}>{editingId ? 'Save Changes' : 'Set Alarm'}</Text>}
              </TouchableOpacity>
            </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={!!deleteId} transparent animationType="fade">
        <View style={dynamicStyles.confirmOverlay}>
          <View style={dynamicStyles.confirmContent}>
            <View style={dynamicStyles.confirmGlow} />
            <View style={dynamicStyles.dangerIconContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={32} color="#EF5350" />
            </View>
            <Text style={dynamicStyles.confirmTitle}>Delete Alarm?</Text>
            <Text style={dynamicStyles.confirmSubTitle}>This action cannot be undone. Are you sure you want to remove this alarm?</Text>
            
            <View style={dynamicStyles.confirmActions}>
              <TouchableOpacity 
                style={dynamicStyles.cancelConfirmBtn} 
                onPress={() => setDeleteId(null)}
              >
                <Text style={dynamicStyles.cancelConfirmText}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={dynamicStyles.deleteConfirmBtn} 
                onPress={confirmDelete}
              >
                <Text style={dynamicStyles.deleteConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const getStyles = (theme: any, accentColor: string, isDarkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 25 },
  title: { color: theme.text, fontSize: 26, fontWeight: '800' },
  addBtn: { padding: 4 },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 100 },
  // Alarm card
  alarmCard: { 
    backgroundColor: theme.surface, 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 16, 
    borderWidth: 1.5, 
    borderColor: theme.border,
    overflow: 'hidden',
    shadowColor: theme.background,
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
  alarmTitle: { color: theme.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statusBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  statusBadge: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  cardActions: { position: 'absolute', right: 16, top: 16, gap: 12, alignItems: 'center' },
  deleteBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.background,
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
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: accentColor + '40',
    shadowColor: accentColor,
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
    backgroundColor: theme.background, 
    padding: 12, 
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.border
  },
  alarmMsgText: { color: theme.textSecondary, fontSize: 13, fontStyle: 'italic', flex: 1 },
  tonePreview: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, opacity: 0.6 },
  tonePreviewText: { color: accentColor, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  // Empty
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: theme.textSecondary, fontSize: 16, marginTop: 12 },
  emptySubtext: { color: theme.textSecondary, fontSize: 13, marginTop: 4 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'flex-end', paddingBottom: 40, paddingHorizontal: 20 },
  modalScroll: { maxHeight: 400 },
  scrollContent: { paddingBottom: 10 },
  staticContent: { paddingBottom: 10 },
  modalContent: { 
    backgroundColor: theme.surface, 
    borderRadius: 32, 
    padding: 16, 
    paddingTop: 10,
    paddingBottom: 20,
    borderWidth: 1.5,
    borderColor: accentColor + '20',
    maxHeight: '90%'
  },
  modalTitle: { color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 0, textAlign: 'center', letterSpacing: -0.5 },
  modalSubTitle: { color: '#555', fontSize: 11, textAlign: 'center', marginBottom: 4, fontWeight: '500' },
  fieldLabel: { color: theme.textSecondary, fontSize: 10, fontWeight: '800', marginBottom: 1, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInput: { 
    backgroundColor: theme.background, 
    color: theme.text, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 12, 
    fontSize: 15, 
    borderWidth: 1.5, 
    borderColor: theme.border, 
    marginBottom: 2,
    fontWeight: '600'
  },
  msgInput: { height: 50, textAlignVertical: 'top' },
  // Pickers
  pickerContainer: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  pickerSection: { flex: 1 },
  pickerBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: isDarkMode ? '#0F0F0F' : theme.surface, 
    padding: 10, 
    borderRadius: 10, 
    borderWidth: 1.5, 
    borderColor: theme.border,
    gap: 8,
    marginTop: 2
  },
  pickerBtnText: { color: theme.text, fontSize: 13, fontWeight: '600' },
  // Actions
  modalActions: { flexDirection: 'row', gap: 15, marginTop: 15 },
  cancelBtn: { 
    flex: 1, 
    backgroundColor: theme.surface, 
    paddingVertical: 10, 
    borderRadius: 18, 
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.border
  },
  cancelText: { color: '#777', fontWeight: '700', fontSize: 15 },
  confirmBtn: { 
    flex: 2, 
    backgroundColor: accentColor, 
    paddingVertical: 10, 
    borderRadius: 18, 
    alignItems: 'center',
    shadowColor: accentColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8
  },
  confirmText: { color: theme.background, fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
  toneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1.5, 
    borderColor: theme.border,
    borderStyle: 'dashed',
    gap: 12,
  },
  toneIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border
  },
  toneTextContainer: { flex: 1 },
  toneMainText: { color: '#AAA', fontSize: 14, fontWeight: '700' },
  toneSubText: { color: '#555', fontSize: 11, marginTop: 2 },
  clearToneBtn: { padding: 4 },
  toneText: { color: theme.textSecondary, fontSize: 14, flex: 1 },
  // Custom Picker
  pickerModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  customPickerContent: { backgroundColor: theme.card, borderRadius: 24, padding: 24, width: '80%', borderWidth: 1.5, borderColor: theme.border },
  customPickerTitle: { color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  wheelContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 200, marginBottom: 20 },
  wheelWrapper: { width: 60, height: 200 },
  wheelItem: { height: 40, justifyContent: 'center', alignItems: 'center' },
  wheelItemText: { color: theme.textSecondary, fontSize: 20, fontWeight: '600' },
  wheelItemActive: { color: accentColor, fontSize: 24, fontWeight: '800' },
  wheelDivider: { color: '#555', fontSize: 24, fontWeight: '700', marginHorizontal: 10 },
  pickerActions: { flexDirection: 'row', gap: 12 },
  pickerCancel: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  pickerCancelText: { color: theme.textSecondary, fontWeight: '600' },
  pickerConfirm: { flex: 2, backgroundColor: accentColor, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  pickerConfirmText: { color: theme.background, fontWeight: '700' },
  // Next Alarm Toastbar
  nextAlarmToast: {
    position: 'absolute',
    bottom: 30,
    left: '10%',
    right: '10%',
    backgroundColor: isDarkMode ? '#121212' : theme.surface,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: accentColor + '40',
    shadowColor: accentColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 100,
  },
  toastGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: accentColor + '05',
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
    backgroundColor: theme.border,
    marginHorizontal: 12,
  },
  toastCountdown: {
    fontSize: 12,
    fontWeight: '800',
    color: accentColor,
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
    backgroundColor: theme.surface,
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
    color: theme.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
    letterSpacing: -0.5
  },
  confirmSubTitle: {
    color: theme.textSecondary,
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
    backgroundColor: theme.surfaceDarker,
    borderWidth: 1,
    borderColor: theme.border
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
    color: theme.text,
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
    borderColor: theme.border,
    backgroundColor: theme.background
  },
  activeSmallBtn: { backgroundColor: accentColor, borderColor: accentColor },
  smallBtnText: { color: theme.textSecondary, fontSize: 11, fontWeight: '700' },
  activeSmallBtnText: { color: theme.background },
  repetitionContainer: { 
    marginTop: 8, 
    backgroundColor: isDarkMode ? '#0F0F0F' : theme.surface, 
    padding: 8, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border
  },
  repetitionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleBtn: { width: 44, height: 24, borderRadius: 12, backgroundColor: theme.border, padding: 2 },
  toggleOn: { backgroundColor: accentColor },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.text },
  toggleCircleOn: { alignSelf: 'flex-end' },
  repeatCountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border },
  repeatLabel: { color: '#AAA', fontSize: 13, fontWeight: '600' },
  countActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  countBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' },
  countValue: { color: theme.text, fontSize: 18, fontWeight: '800' },
});

// Helper Types outside to prevent unnecessary re-creations
type Alarm = {
  _id: string;
  triggerAt: string;
  message: string;
  title: string;
  isTriggered: boolean;
  toneUrl?: string | null;
  duration?: number;
  repetitionOn?: boolean;
  repeatCount?: number;
};
