import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldAlert, MapPin, Camera } from 'lucide-react-native';

interface Props {
  onCompleteShift: () => void;
}

export type ShiftWorkflowStage =
  | 'APPLIED'
  | 'POSTER_REVIEW'
  | 'ASSIGNED'
  | 'CHECKED_IN'
  | 'COMPLETED';

/**
 * Safe placeholder until authenticated check-in/check-out APIs, server-side
 * geofence validation, evidence upload and escrow release are implemented.
 * This screen deliberately does not simulate GPS, photos or wallet payouts.
 */
export const ActiveShiftScreen: React.FC<Props> = () => (
  <View style={styles.container}>
    <View style={styles.card}>
      <View style={styles.heading}>
        <MapPin color="#94A3B8" size={18} />
        <Text style={styles.title}>Chấm công ca làm</Text>
      </View>
      <Text style={styles.body}>
        Quy trình check-in/check-out đang được hoàn thiện. Ứng dụng chưa ghi nhận vị trí,
        ảnh minh chứng hoặc giải ngân trong phiên bản này.
      </Text>
      <View style={styles.notice}>
        <ShieldAlert color="#F59E0B" size={18} />
        <Text style={styles.noticeText}>
          Tính năng tạm khóa để tránh ghi nhận chấm công hoặc thanh toán giả. Khi API xác thực
          và đối soát hoàn tất, trạng thái ca làm sẽ được đồng bộ từ máy chủ.
        </Text>
      </View>
      <View style={styles.disabledAction}>
        <MapPin color="#64748B" size={16} />
        <Text style={styles.disabledText}>Check-in GPS — chưa khả dụng</Text>
      </View>
      <View style={styles.disabledAction}>
        <Camera color="#64748B" size={16} />
        <Text style={styles.disabledText}>Check-out & nghiệm thu — chưa khả dụng</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 14, gap: 12, backgroundColor: '#080D1A' },
  card: { backgroundColor: '#0F172A', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#1E293B', gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  body: { color: '#CBD5E1', fontSize: 13, lineHeight: 20 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12, backgroundColor: '#422006' },
  noticeText: { flex: 1, color: '#FDE68A', fontSize: 12, lineHeight: 18 },
  disabledAction: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 13, borderRadius: 10, backgroundColor: '#1E293B' },
  disabledText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' }
});
