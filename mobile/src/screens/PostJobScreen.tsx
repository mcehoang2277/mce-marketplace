import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Zap, ShieldCheck } from 'lucide-react-native';
import { ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { api } from '../services/api';

interface Props {
  onJobPosted: () => void;
}

export const PostJobScreen: React.FC<Props> = ({ onJobPosted }) => {
  const [title, setTitle] = useState('Phụ dọn kho & bốc xếp 50 thùng bánh');
  const [hours, setHours] = useState('3');
  const [rate, setRate] = useState('85000');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);

  const total = (parseInt(hours) || 0) * (parseInt(rate) || 0);

  const handlePost = async () => {
    const duration = Number(hours);
    const hourlyRate = Number(rate);
    if (!title.trim() || !address.trim() || !Number.isFinite(duration) || duration <= 0 || duration > 24 || !Number.isInteger(hourlyRate) || hourlyRate <= 0) {
      Alert.alert('Thông tin chưa hợp lệ', 'Vui lòng kiểm tra tên việc, địa chỉ, số giờ và mức thù lao.');
      return;
    }

    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Cần cấp quyền vị trí để xác định tọa độ công việc.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const start = new Date(Date.now() + 60 * 60 * 1000);
      const end = new Date(start.getTime() + duration * 60 * 60 * 1000);
      await api.createJob({
        title: title.trim(),
        description: title.trim(),
        category: 'Công việc thời vụ',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        hourlyRate,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        addressText: address.trim(),
        requiredSkills: []
      });
      Alert.alert('Đã lưu bản nháp', 'Công việc được lưu ở trạng thái DRAFT. Chưa mở nhận ứng tuyển vì hệ thống ký quỹ và thanh toán chưa hoàn thiện.');
      onJobPosted();
    } catch (error) {
      Alert.alert('Không thể lưu công việc', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.formCard}>
        <Text style={styles.header}>Đăng Ca Việc Mới (Trong 60 Giây)</Text>

        <View style={styles.field}>
          <Text style={styles.label}>TÊN CÔNG VIỆC</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ví dụ: Phụ dọn kho, xếp hàng..."
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>SỐ TIẾNG</Text>
            <TextInput
              style={[styles.input, styles.inputCenter]}
              value={hours}
              onChangeText={setHours}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.field, { flex: 1.5 }]}>
            <Text style={styles.label}>THÙ LAO (VNĐ/H)</Text>
            <TextInput
              style={[styles.input, styles.inputCenter, { color: '#4f46e5', fontWeight: '800' }]}
              value={rate}
              onChangeText={setRate}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>ĐỊA ĐIỂM THỰC HIỆN</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
          />
        </View>

        <View style={styles.calcCard}>
          <View>
            <Text style={styles.calcLabel}>TỔNG THÙ LAO DỰ KIẾN:</Text>
            <Text style={styles.calcTotal}>{total.toLocaleString('vi-VN')} VNĐ</Text>
          </View>
          <View style={styles.calcPromo}>
            <ShieldCheck size={12} color="#059669" />
            <Text style={styles.calcPromoText}>Chưa bao gồm ký quỹ</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handlePost} disabled={busy}>
          {busy ? <ActivityIndicator color="#ffffff" /> : <Zap size={16} color="#ffffff" />}
          <Text style={styles.submitBtnText}>Lưu Bản Nháp Công Việc</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  header: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  field: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  inputCenter: {
    textAlign: 'center',
  },
  calcCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  calcLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  calcTotal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4f46e5',
  },
  calcPromo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  calcPromoText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065f46',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
