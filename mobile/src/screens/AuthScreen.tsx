import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { api } from '../services/api';

type Props = { onAuthenticated: () => void };

export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'WORKER' | 'POSTER' | 'BOTH'>('WORKER');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!phone.trim() || !password) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số điện thoại và mật khẩu.');
      return;
    }
    if (mode === 'REGISTER' && !fullName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ tên.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'LOGIN') {
        await api.login(phone.trim(), password);
      } else {
        await api.register({ phone: phone.trim(), password, fullName: fullName.trim(), role });
      }
      onAuthenticated();
    } catch (error) {
      Alert.alert('Không thể đăng nhập', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.logo}><Text style={styles.logoText}>M</Text></View>
          <Text style={styles.title}>MCE Marketplace</Text>
          <Text style={styles.subtitle}>Kết nối công việc linh hoạt quanh bạn</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.modeRow}>
            <TouchableOpacity style={[styles.modeButton, mode === 'LOGIN' && styles.modeActive]} onPress={() => setMode('LOGIN')}>
              <Text style={[styles.modeText, mode === 'LOGIN' && styles.modeTextActive]}>Đăng nhập</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modeButton, mode === 'REGISTER' && styles.modeActive]} onPress={() => setMode('REGISTER')}>
              <Text style={[styles.modeText, mode === 'REGISTER' && styles.modeTextActive]}>Tạo tài khoản</Text>
            </TouchableOpacity>
          </View>

          {mode === 'REGISTER' && (
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Họ và tên" placeholderTextColor="#94a3b8" />
          )}
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Số điện thoại" keyboardType="phone-pad" autoComplete="tel" placeholderTextColor="#94a3b8" />
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Mật khẩu (tối thiểu 10 ký tự khi đăng ký)" secureTextEntry autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'} placeholderTextColor="#94a3b8" />

          {mode === 'REGISTER' && (
            <View style={styles.roleGroup}>
              <Text style={styles.roleTitle}>Bạn muốn sử dụng MCE với vai trò:</Text>
              {([
                ['WORKER', 'Tìm việc'],
                ['POSTER', 'Đăng việc'],
                ['BOTH', 'Cả hai']
              ] as const).map(([value, label]) => (
                <TouchableOpacity key={value} style={[styles.roleOption, role === value && styles.roleSelected]} onPress={() => setRole(value)}>
                  <Text style={[styles.roleLabel, role === value && styles.roleLabelSelected]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={[styles.submit, busy && styles.disabled]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{mode === 'LOGIN' ? 'Đăng nhập' : 'Tạo tài khoản'}</Text>}
          </TouchableOpacity>
          <Text style={styles.note}>Tài khoản được xác thực qua API MCE. Không sử dụng tài khoản demo mặc định.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080d1a' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  brand: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText: { color: '#fff', fontSize: 30, fontWeight: '900' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 6 },
  card: { backgroundColor: '#111827', borderColor: '#273449', borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 },
  modeRow: { flexDirection: 'row', backgroundColor: '#080d1a', borderRadius: 12, padding: 4, marginBottom: 4 },
  modeButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  modeActive: { backgroundColor: '#3730a3' },
  modeText: { color: '#94a3b8', fontWeight: '700' },
  modeTextActive: { color: '#fff' },
  input: { backgroundColor: '#080d1a', borderColor: '#334155', borderWidth: 1, borderRadius: 12, padding: 14, color: '#f8fafc' },
  roleGroup: { gap: 8 },
  roleTitle: { color: '#cbd5e1', fontWeight: '700', marginBottom: 2 },
  roleOption: { borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 11 },
  roleSelected: { borderColor: '#818cf8', backgroundColor: '#312e81' },
  roleLabel: { color: '#cbd5e1', textAlign: 'center', fontWeight: '600' },
  roleLabelSelected: { color: '#fff' },
  submit: { backgroundColor: '#4f46e5', borderRadius: 12, alignItems: 'center', padding: 15, marginTop: 4 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.6 },
  note: { color: '#64748b', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 }
});
