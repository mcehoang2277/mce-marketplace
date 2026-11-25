import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../services/api';

type WalletData = {
  availableBalanceVnd: number; lockedBalanceVnd: number;
  totalDepositedVnd: number; totalWithdrawnVnd: number;
};
type LedgerItem = {
  id: string; type: string; amountVnd: number; balanceAfterVnd: number;
  description: string; createdAt: string;
};

const money = (value: number) => `${value.toLocaleString('vi-VN')} đ`;

export const WalletScreen: React.FC = () => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [walletResult, ledgerResult] = await Promise.all([api.wallet(), api.walletTransactions()]);
      setWallet(walletResult.wallet);
      setTransactions(ledgerResult.transactions);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu ví.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
      <View style={styles.card}>
        <Text style={styles.label}>SỐ DƯ KHẢ DỤNG</Text>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.balance}>{money(wallet?.availableBalanceVnd || 0)}</Text>}
        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Đang ký quỹ</Text>
            <Text style={styles.metricValue}>{money(wallet?.lockedBalanceVnd || 0)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Đã nạp</Text>
            <Text style={styles.metricValue}>{money(wallet?.totalDepositedVnd || 0)}</Text>
          </View>
        </View>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Giao dịch tiền thật</Text>
        <Text style={styles.note}>Số dư được đọc từ sổ cái máy chủ. Nạp tiền chỉ được ghi nhận sau khi webhook ngân hàng được xác thực. Rút tiền tự động đang khóa cho đến khi có đối soát và quy trình chi trả được phê duyệt.</Text>
      </View>

      <View style={styles.ledgerCard}>
        <Text style={styles.sectionTitle}>LỊCH SỬ GIAO DỊCH</Text>
        {!loading && transactions.length === 0 && <Text style={styles.empty}>Chưa có giao dịch.</Text>}
        {transactions.map((item) => (
          <View key={item.id} style={styles.transaction}>
            <View style={styles.transactionText}>
              <Text style={styles.transactionTitle}>{item.description}</Text>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleString('vi-VN')}</Text>
            </View>
            <Text style={styles.amount}>{money(item.amountVnd)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  card: { backgroundColor: '#0f172a', borderRadius: 20, padding: 20, gap: 12 },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '800' },
  balance: { color: '#fff', fontSize: 28, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 24, marginTop: 8 },
  metric: { gap: 4 },
  metricLabel: { color: '#94a3b8', fontSize: 11 },
  metricValue: { color: '#cbd5e1', fontSize: 14, fontWeight: '800' },
  notice: { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1, borderRadius: 16, padding: 16, gap: 8, marginTop: 14 },
  noticeTitle: { color: '#9a3412', fontSize: 14, fontWeight: '800' },
  note: { color: '#7c2d12', fontSize: 12, lineHeight: 19 },
  ledgerCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 14, gap: 12 },
  sectionTitle: { color: '#475569', fontSize: 11, fontWeight: '900' },
  empty: { color: '#94a3b8', fontSize: 12 },
  transaction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, gap: 8 },
  transactionText: { flex: 1, gap: 4 },
  transactionTitle: { color: '#0f172a', fontSize: 12, fontWeight: '700' },
  date: { color: '#94a3b8', fontSize: 10 },
  amount: { color: '#0f766e', fontSize: 12, fontWeight: '900' },
  error: { color: '#b91c1c', marginTop: 10, fontSize: 12 }
});
