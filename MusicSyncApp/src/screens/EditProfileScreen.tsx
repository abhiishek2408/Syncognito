import React, { useState, useContext } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Image, ActivityIndicator, Alert, Dimensions
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import API_URL from '../utils/api';
import { useToast } from '../context/ToastContext';

export default function EditProfileScreen({ navigation }: any) {
  const { theme, accentColor } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor);

  const auth = useContext(AuthContext);
  const { showToast } = useToast();
  const user = auth.user;

  const [name, setName] = useState(user?.name || '');
  const [slug, setSlug] = useState(user?.anonSlug || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Name cannot be empty', 'error');
      return;
    }

    setSaving(true);
    try {
      const resp = await axios.put(`${API_URL}/api/users/me`, 
        { 
          displayName: name.trim(),
          anonSlug: slug.trim() || undefined
        },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      
      if (auth.updateUser) {
        auth.updateUser(resp.data);
      }
      showToast('Profile updated! ✨', 'success');
      navigation.goBack();
    } catch (err) {
      console.warn('Profile update error:', err);
      showToast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = () => {
    launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 500,
      maxHeight: 500,
      quality: 0.8,
    }, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        showToast(response.errorMessage || 'Failed to pick image', 'error');
        return;
      }

      const asset = response.assets?.[0];
      if (asset && asset.base64) {
        uploadAvatar(asset.base64, asset.type || 'image/jpeg');
      }
    });
  };

  const uploadAvatar = async (base64: string, mime: string) => {
    setUploading(true);
    try {
      const resp = await axios.put(`${API_URL}/api/users/me/avatar`, 
        { avatar: `data:${mime};base64,${base64}` },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      
      if (auth.updateUser) {
        auth.updateUser(resp.data);
      }
      showToast('Avatar updated! 📸', 'success');
    } catch (err) {
      console.warn('Upload error:', err);
      showToast('Failed to upload image', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={dynamicStyles.backBtn}>
          <MaterialCommunityIcons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={dynamicStyles.saveBtn}>
          {saving ? (
            <ActivityIndicator color="#1DB954" size="small" />
          ) : (
            <Text style={dynamicStyles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={dynamicStyles.content}>
        {/* Avatar Section */}
        <View style={dynamicStyles.avatarSection}>
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={handlePickImage} 
            style={dynamicStyles.avatarWrapper}
            disabled={uploading}
          >
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={dynamicStyles.avatar} />
            ) : (
              <View style={[dynamicStyles.avatar, dynamicStyles.placeholder]}>
                <MaterialCommunityIcons name="account" size={60} color="#1DB954" />
              </View>
            )}
            {uploading && (
              <View style={dynamicStyles.uploadOverlay}>
                <ActivityIndicator color="#FFF" />
              </View>
            )}
            <View style={dynamicStyles.cameraBtn}>
               <MaterialCommunityIcons name="camera" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={dynamicStyles.changePicText}>Change Profile Picture</Text>
        </View>

        {/* Form Fields */}
        <View style={dynamicStyles.form}>
           <View style={dynamicStyles.inputGroup}>
              <Text style={dynamicStyles.label}>Display Name</Text>
              <TextInput
                style={dynamicStyles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="#555"
              />
           </View>

           <View style={dynamicStyles.inputGroup}>
              <Text style={dynamicStyles.label}>Email Address</Text>
              <View style={dynamicStyles.readOnlyInput}>
                 <Text style={dynamicStyles.readOnlyText}>{user?.email}</Text>
                 <MaterialCommunityIcons name="lock" size={14} color="#444" />
              </View>
           </View>

           <View style={dynamicStyles.inputGroup}>
              <Text style={dynamicStyles.label}>Anonymous Slug</Text>
              <View style={dynamicStyles.slugInputContainer}>
                <Text style={dynamicStyles.atSymbol}>@</Text>
                <TextInput
                  style={dynamicStyles.slugInput}
                  value={slug}
                  onChangeText={(val) => setSlug(val.replace(/[^a-zA-Z0-9_\-]/g, '').toLowerCase())}
                  placeholder="your_secret_slug"
                  placeholderTextColor="#555"
                  autoCapitalize="none"
                />
              </View>
           </View>
        </View>
      </ScrollView>
    </View>
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
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.surfaceDarker
  },
  backBtn: { padding: 4 },
  headerTitle: { color: theme.text, fontSize: 18, fontWeight: '800' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  saveBtnText: { color: accentColor, fontSize: 16, fontWeight: '800' },
  
  content: { padding: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: theme.surface, borderWidth: 2, borderColor: accentColor },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: accentColor, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: theme.background },
  changePicText: { color: accentColor, marginTop: 12, fontSize: 14, fontWeight: '700' },

  form: { gap: 24 },
  inputGroup: { gap: 8 },
  label: { color: theme.textSecondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: theme.surface, borderRadius: 14, padding: 16, color: theme.text, fontSize: 16, borderWidth: 1, borderColor: theme.border },
  slugInputContainer: { backgroundColor: theme.surface, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: theme.border },
  atSymbol: { color: accentColor, fontSize: 16, fontWeight: '800', marginRight: 4 },
  slugInput: { flex: 1, paddingVertical: 16, color: theme.text, fontSize: 16 },
  readOnlyInput: { backgroundColor: theme.surface, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: theme.surface },
  readOnlyText: { color: '#555', fontSize: 16, fontWeight: '500' }
});
