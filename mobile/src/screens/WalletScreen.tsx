import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const WalletScreen: React.FC = () => (
  <View style={styles.container}>
    <View style={styles.card}>
      <Text style={styles.label}>VÍ MCE</Text>
      <Text style={styles.title}>Chưa có dữ liệu số dư</Text>
      <Text style={styles.note}>Số dư và lịch sử giao dịch sẽ chỉ hiển thị sau khi sổ cái PostgreSQL, đối soát ngân hàng và quy trình giải ngân được hoàn thiện.</Text>
    </View>
    <View style={styles.notice}>
      <Text style={styles.noticeTitle}>Rút tiền đang tạm khóa</Text>
      <Text style={styles.note}>MCE chưa thực hiện bất kỳ lệnh chuyển tiền thật nào từ ứng dụng. Không nhập thông tin ngân hàng để thử nghiệm ở giai đoạn này.</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 14, backgroundColor: '#f8fafc' },
  card: { backgroundColor: '#0f172a', borderRadius: 20, padding: 20, gap: 10 },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '800' },
  title: { color: '#fff', fontSize: 21, fontWeight: '900' },
  note: { color: '#94a3b8', fontSize: 12, lineHeight: 19 },
  notice: { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  noticeTitle: { color: '#9a3412', fontSize: 14, fontWeight: '800' }
});
