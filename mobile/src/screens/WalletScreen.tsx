import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ArrowUpRight, ShieldCheck, Check } from 'lucide-react-native';

export const WalletScreen: React.FC = () => {
  const handleWithdraw = () => {
    Alert.alert('Rút tiền tức thì 24/7', 'Lệnh chuyển 480.000 VNĐ về tài khoản ngân hàng chính chủ MBBank đã được xử lý thành công qua NAPAS 247! (Phí rút: 0 VNĐ)');
  };

  return (
    <View style={styles.container}>
      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.badgeRow}>
          <Text style={styles.balanceLabel}>SỐ DƯ KHẢ DỤNG</Text>
          <View style={styles.zeroFeeBadge}>
            <Text style={styles.zeroFeeText}>0% Phí Sàn 90 Ngày</Text>
          </View>
        </View>

        <Text style={styles.balanceValue}>480.000 VNĐ</Text>
        <Text style={styles.balanceSub}>✓ Nhận trọn 100% thù lao theo chính sách ưu đãi</Text>

        <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw}>
          <Text style={styles.withdrawBtnText}>Rút Tiền Siêu Tốc 24/7 Về MBBank / Vietcombank</Text>
          <ArrowUpRight size={16} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {/* History */}
      <View style={styles.historyCard}>
        <Text style={styles.historyTitle}>LỊCH SỬ GIAO DỊCH GẦN ĐÂY:</Text>

        <View style={styles.txItem}>
          <View style={styles.txIcon}>
            <Check size={14} color="#059669" />
          </View>
          <View style={styles.txContent}>
            <Text style={styles.txTitle}>Hoàn thành ca Đóng gói Shopee</Text>
            <Text style={styles.txTime}>Hôm nay · 17:00</Text>
          </View>
          <View style={styles.txRight}>
            <Text style={styles.txAmount}>+240.000đ</Text>
            <Text style={styles.txFee}>Phí sàn: 0đ</Text>
          </View>
        </View>

        <View style={styles.txItem}>
          <View style={styles.txIcon}>
            <Check size={14} color="#059669" />
          </View>
          <View style={styles.txContent}>
            <Text style={styles.txTitle}>Hoàn thành ca Trông thú cưng</Text>
            <Text style={styles.txTime}>Hôm qua · 16:00</Text>
          </View>
          <View style={styles.txRight}>
            <Text style={styles.txAmount}>+150.000đ</Text>
            <Text style={styles.txFee}>Phí sàn: 0đ</Text>
          </View>
        </View>
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
  balanceCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 18,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  zeroFeeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  zeroFeeText: {
    color: '#34d399',
    fontSize: 9,
    fontWeight: '800',
  },
  balanceValue: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
  },
  balanceSub: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '600',
  },
  withdrawBtn: {
    marginTop: 10,
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  withdrawBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 11,
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  txIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  txContent: {
    flex: 1,
  },
  txTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  txTime: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#059669',
  },
  txFee: {
    fontSize: 9,
    color: '#94a3b8',
  },
});
