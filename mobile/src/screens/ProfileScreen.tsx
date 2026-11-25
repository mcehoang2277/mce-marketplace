import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';

type Profile = {
  id: string;
  name: string;
  phone: string;
  role: string;
  karmaScore: number;
  isKycVerified: boolean;
  walletBalanceVnd: number;
};

export function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.me()
      .then((result) => { if (active) setProfile(result.user); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.heading}>Tài khoản MCE</Text>
        {loading && <ActivityIndicator color="#818cf8" />}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {profile && (
          <>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.value}>Số điện thoại: {profile.phone}</Text>
            <Text style={styles.value}>Vai trò: {profile.role}</Text>
            <Text style={styles.value}>Định danh: {profile.isKycVerified ? 'Đã xác minh' : 'Chưa xác minh'}</Text>
            <Text style={styles.value}>Điểm uy tín: {profile.karmaScore.toFixed(1)} / 5</Text>
          </>
        )}
      </View>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Một số chức năng chưa mở</Text>
        <Text style={styles.note}>Cập nhật hồ sơ, SMS OTP, eKYC, quản lý tài khoản ngân hàng và rút tiền chưa được triển khai. MCE không hiển thị trạng thái xác minh khi chưa có dữ liệu xác thực.</Text>
      </View>
      <TouchableOpacity style={styles.logout} onPress={() => {
        Alert.alert('Đăng xuất', 'Bạn có muốn đăng xuất khỏi MCE?', [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Đăng xuất', style: 'destructive', onPress: onLogout }
        ]);
      }}>
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 14, backgroundColor: '#080d1a' },
  card: { backgroundColor: '#151f32', borderColor: '#273449', borderWidth: 1, borderRadius: 18, padding: 18, gap: 10 },
  heading: { color: '#94a3b8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  name: { color: '#f8fafc', fontSize: 20, fontWeight: '900' },
  value: { color: '#cbd5e1', fontSize: 13 },
  error: { color: '#fca5a5', fontSize: 12 },
  notice: { backgroundColor: '#1c1917', borderColor: '#78350f', borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  noticeTitle: { color: '#fdba74', fontSize: 14, fontWeight: '800' },
  note: { color: '#cbd5e1', fontSize: 12, lineHeight: 19 },
  logout: { backgroundColor: '#7f1d1d', borderRadius: 12, alignItems: 'center', padding: 14 },
  logoutText: { color: '#fff', fontWeight: '800' }
});
