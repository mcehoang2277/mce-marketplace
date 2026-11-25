import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { User, Phone, Mail, CreditCard, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react-native';

export function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  const [role, setRole] = useState<'WORKER' | 'POSTER'>('WORKER');

  // Skills
  const [skills, setSkills] = useState({
    pack: true,
    bike: true,
    warehouse: true,
    pet: false,
    queue: true,
  });

  const handleSave = () => {
    if (!phone || phone.trim().length < 9) {
      Alert.alert('Lỗi', 'Số điện thoại liên hệ là BẮT BUỘC để nhận ca làm!');
      return;
    }
    Alert.alert('Chưa khả dụng', 'API cập nhật hồ sơ chưa được triển khai. Thông tin chưa được lưu.');
  };

  const toggleRole = () => {
    setRole(prev => prev === 'WORKER' ? 'POSTER' : 'WORKER');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Profile Badge */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.slice(0, 2).toUpperCase()}</Text>
          <View style={styles.verifiedDot}>
            <CheckCircle2 size={12} color="#ffffff" />
          </View>
        </View>
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{name}</Text>
            <View style={styles.kycBadge}>
              <Text style={styles.kycText}>CHƯA XÁC MINH</Text>
            </View>
          </View>
          <Text style={styles.profileRole}>
            {role === 'WORKER' ? 'Người Làm Việc (Worker)' : 'Người Cần Thuê (Poster)'} · Chưa có đánh giá
          </Text>
          <Text style={styles.profilePhoneText}>📞 +84 {phone}</Text>
        </View>
      </View>

      {/* Role Toggle Card */}
      <View style={styles.card}>
        <View style={styles.roleToggleRow}>
          <Text style={styles.fieldLabel}>Vai trò hoạt động:</Text>
          <TouchableOpacity style={styles.roleBtn} onPress={toggleRole}>
            <RefreshCw size={14} color="#6366f1" />
            <Text style={styles.roleBtnText}>Đổi sang {role === 'WORKER' ? 'Người Thuê' : 'Người Làm'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Basic Contact Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Thông Tin Liên Hệ & Định Danh</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Họ và tên thật *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nhập họ và tên..."
            placeholderTextColor="#64748b"
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Số điện thoại liên hệ * (BẮT BUỘC)</Text>
            <Text style={styles.requiredTag}>SMS OTP</Text>
          </View>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="0981234567"
            placeholderTextColor="#64748b"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email / Gmail liên hệ</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="example@gmail.com"
            placeholderTextColor="#64748b"
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Số CCCD Gắn Chip (eKYC)</Text>
            <Text style={styles.verifiedTag}>Chưa xác minh</Text>
          </View>
          <TextInput
            style={[styles.input, styles.idInput]}
            value={idNumber}
            onChangeText={setIdNumber}
            placeholder="001098012345"
            placeholderTextColor="#64748b"
          />
        </View>
      </View>

      {/* Worker Skills Section */}
      {role === 'WORKER' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kỹ Năng & Ca Làm Mong Muốn</Text>
          <View style={styles.skillsGrid}>
            <TouchableOpacity
              style={[styles.skillItem, skills.pack && styles.skillItemActive]}
              onPress={() => setSkills({ ...skills, pack: !skills.pack })}
            >
              <Text style={styles.skillText}>📦 Đóng gói hàng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.skillItem, skills.bike && styles.skillItemActive]}
              onPress={() => setSkills({ ...skills, bike: !skills.bike })}
            >
              <Text style={styles.skillText}>🛵 Có xe máy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.skillItem, skills.warehouse && styles.skillItemActive]}
              onPress={() => setSkills({ ...skills, warehouse: !skills.warehouse })}
            >
              <Text style={styles.skillText}>💪 Bốc vác kho</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.skillItem, skills.pet && styles.skillItemActive]}
              onPress={() => setSkills({ ...skills, pet: !skills.pet })}
            >
              <Text style={styles.skillText}>🐶 Trông thú cưng</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bank Account for VietQR Auto Payout */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tài Khoản Giải Ngân VietQR 24/7</Text>
        <Text style={styles.subtext}>Tiền thù lao 100% tự động chuyển về tài khoản này ngay khi ca làm kết thúc.</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ngân hàng thụ hưởng</Text>
          <TextInput
            style={styles.input}
            value={bank}
            onChangeText={setBank}
            placeholder="MBBank, Vietcombank..."
            placeholderTextColor="#64748b"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Số tài khoản ngân hàng</Text>
          <TextInput
            style={[styles.input, styles.monoInput]}
            value={account}
            onChangeText={setAccount}
            placeholder="Số tài khoản..."
            placeholderTextColor="#64748b"
          />
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Save size={18} color="#ffffff" />
        <Text style={styles.saveBtnText}>Lưu Thay Đổi & Cập Nhật Hồ Sơ</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080D1A',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151F32',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#273449',
    marginBottom: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    position: 'relative',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10B981',
    borderRadius: 10,
    padding: 2,
    borderWidth: 2,
    borderColor: '#151F32',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  kycBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  kycText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '800',
  },
  profileRole: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  profilePhoneText: {
    fontSize: 11,
    color: '#818CF8',
    fontWeight: '600',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#151F32',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#273449',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtext: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 12,
    lineHeight: 16,
  },
  roleToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#273449',
  },
  roleBtnText: {
    fontSize: 11,
    color: '#818CF8',
    fontWeight: '700',
  },
  inputGroup: {
    marginTop: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  requiredTag: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '700',
  },
  verifiedTag: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#273449',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  phoneInput: {
    color: '#818CF8',
    fontWeight: '700',
  },
  idInput: {
    color: '#F8FAFC',
    fontFamily: 'monospace',
  },
  monoInput: {
    fontFamily: 'monospace',
    color: '#10B981',
    fontWeight: '700',
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  skillItem: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#273449',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  skillItemActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  skillText: {
    fontSize: 12,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    marginTop: 4,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
