import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MapPin, Camera, CheckCircle2, ShieldAlert } from 'lucide-react-native';

interface Props {
  onCompleteShift: () => void;
}

export const ActiveShiftScreen: React.FC<Props> = ({ onCompleteShift }) => {
  const [status, setStatus] = useState<'READY' | 'IN_PROGRESS' | 'PENDING_REVIEW'>('READY');

  const handleCheckIn = () => {
    setStatus('IN_PROGRESS');
    Alert.alert('Chấm công thành công', 'Bạn đang ở cách điểm làm 25m (trong bán kính 150m). Bắt đầu tính giờ làm việc!');
  };

  const handleCheckOut = () => {
    setStatus('PENDING_REVIEW');
    Alert.alert('Đã nộp ảnh minh chứng', 'Hoàn tất nghiệm thu! Tiền thù lao 240.000 VNĐ đã giải ngân trọn 100% về ví (0% phí sàn).');
    onCompleteShift();
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {status === 'READY' && 'ĐÃ GÁN VIỆC · CHỜ CHECK-IN'}
            {status === 'IN_PROGRESS' && 'ĐANG LÀM VIỆC (IN_PROGRESS)'}
            {status === 'PENDING_REVIEW' && 'HOÀN TẤT · ĐÃ GIẢI NGÂN'}
          </Text>
        </View>

        <Text style={styles.title}>Phụ đóng gói 300 kiện hàng shopee</Text>
        <Text style={styles.address}>Số 12 Tràng Thi, Hoàn Kiếm, Hà Nội</Text>

        {/* GPS Radar Card */}
        <View style={styles.radarCard}>
          <View style={styles.radarHeader}>
            <Text style={styles.radarTitle}>Tọa Độ Thực Địa GPS Geofence</Text>
            <Text style={styles.radarAccuracy}>Sai số ± 8m</Text>
          </View>
          <View style={styles.radarMetric}>
            <Text style={styles.metricLabel}>Khoảng cách:</Text>
            <Text style={styles.metricValue}>25 mét (Hợp lệ)</Text>
          </View>
          <Text style={styles.radarNotice}>✓ Nằm trong bán kính 150m cho phép</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, status !== 'READY' ? styles.btnDisabled : styles.btnCheckIn]}
            disabled={status !== 'READY'}
            onPress={handleCheckIn}
          >
            <MapPin size={16} color="#ffffff" />
            <Text style={styles.btnText}>1. Check-in Chấm Công Vào Ca</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, status !== 'IN_PROGRESS' ? styles.btnDisabled : styles.btnCheckOut]}
            disabled={status !== 'IN_PROGRESS'}
            onPress={handleCheckOut}
          >
            <Camera size={16} color="#ffffff" />
            <Text style={styles.btnText}>2. Chụp Ảnh Minh Chứng & Nghiệm Thu</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.noticeCard}>
        <ShieldAlert size={16} color="#4f46e5" />
        <Text style={styles.noticeText}>
          Chính sách 3 tháng đầu: Bạn nhận trọn 100% thù lao (240.000 VNĐ). Sàn MCE miễn hoàn toàn phí chiết khấu 0%.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400e',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  address: {
    fontSize: 12,
    color: '#64748b',
  },
  radarCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 12,
    marginTop: 6,
    gap: 6,
  },
  radarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  radarTitle: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  radarAccuracy: {
    color: '#94a3b8',
    fontSize: 10,
  },
  radarMetric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    color: '#cbd5e1',
    fontSize: 11,
  },
  metricValue: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '800',
  },
  radarNotice: {
    color: '#94a3b8',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  actions: {
    gap: 8,
    marginTop: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnCheckIn: {
    backgroundColor: '#059669',
  },
  btnCheckOut: {
    backgroundColor: '#4f46e5',
  },
  btnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#eef2ff',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    color: '#312e81',
    fontWeight: '600',
    lineHeight: 16,
  },
});
