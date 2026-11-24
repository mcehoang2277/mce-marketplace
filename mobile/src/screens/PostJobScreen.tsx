import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Zap, ShieldCheck } from 'lucide-react-native';

interface Props {
  onJobPosted: () => void;
}

export const PostJobScreen: React.FC<Props> = ({ onJobPosted }) => {
  const [title, setTitle] = useState('Phụ dọn kho & bốc xếp 50 thùng bánh');
  const [hours, setHours] = useState('3');
  const [rate, setRate] = useState('85000');
  const [address, setAddress] = useState('Kho 18 Bạch Đằng, Hai Bà Trưng, Hà Nội');

  const total = (parseInt(hours) || 0) * (parseInt(rate) || 0);

  const handlePost = () => {
    Alert.alert(
      'Nạp cọc VietQR thành công',
      `Đã nạp ký quỹ ${total.toLocaleString('vi-VN')} VNĐ vào Escrow. Ca việc đã được mở trên bản đồ cho các ứng viên xung quanh 6km nhận việc tức thì!`
    );
    onJobPosted();
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
            <Text style={styles.calcLabel}>TỔNG TIỀN CỌC KÝ QUỸ:</Text>
            <Text style={styles.calcTotal}>{total.toLocaleString('vi-VN')} VNĐ</Text>
          </View>
          <View style={styles.calcPromo}>
            <ShieldCheck size={12} color="#059669" />
            <Text style={styles.calcPromoText}>Phí sàn: 0 VNĐ</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handlePost}>
          <Zap size={16} color="#ffffff" />
          <Text style={styles.submitBtnText}>Nạp Cọc VietQR & Đăng Lên Bản Đồ</Text>
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
