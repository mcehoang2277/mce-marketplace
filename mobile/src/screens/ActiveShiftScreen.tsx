import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const ActiveShiftScreen: React.FC<{ onCompleteShift: () => void }> = () => (
  <View style={styles.container}>
    <View style={styles.card}>
      <Text style={styles.title}>Chưa có ca làm đang hoạt động</Text>
      <Text style={styles.body}>Ca làm sẽ xuất hiện ở đây sau khi quy trình ứng tuyển, chủ việc xác nhận và gán người lao động được kết nối đầy đủ.</Text>
    </View>
    <View style={styles.warning}>
      <Text style={styles.warningTitle}>Check-in / Check-out đang tạm khóa</Text>
      <Text style={styles.body}>MCE chưa gửi tọa độ GPS hoặc ảnh minh chứng lên máy chủ trong bản hiện tại. Không có giờ công hay khoản thanh toán nào được ghi nhận từ màn hình này.</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 14, backgroundColor: '#f8fafc' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 },
  title: { color: '#0f172a', fontSize: 17, fontWeight: '900' },
  body: { color: '#64748b', fontSize: 12, lineHeight: 19 },
  warning: { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  warningTitle: { color: '#9a3412', fontSize: 14, fontWeight: '800' }
});
