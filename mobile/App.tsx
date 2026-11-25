import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { MapPin, Briefcase, PlusCircle, Wallet, User } from 'lucide-react-native';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { ActiveShiftScreen } from './src/screens/ActiveShiftScreen';
import { PostJobScreen } from './src/screens/PostJobScreen';
import { WalletScreen } from './src/screens/WalletScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { api } from './src/services/api';

export type TabType = 'EXPLORE' | 'ACTIVE_SHIFT' | 'POST_JOB' | 'WALLET' | 'PROFILE';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('EXPLORE');
  const [sessionReady, setSessionReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    api.hasSession().then(setAuthenticated).finally(() => setSessionReady(true));
  }, []);

  if (!sessionReady) {
    return <SafeAreaView style={styles.container}><ActivityIndicator color="#818cf8" /></SafeAreaView>;
  }
  if (!authenticated) {
    return <AuthScreen onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080D1A" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>MCE Mobile</Text>
            <Text style={styles.headerSubtitle}>Sàn việc làm tức thời 24/7</Text>
          </View>
        </View>
        <View style={styles.promoTag}>
          <Text style={styles.promoText}>0% PHÍ SÀN (90 NGÀY)</Text>
        </View>
      </View>

      {/* Main Screen Content */}
      <View style={styles.content}>
        {activeTab === 'EXPLORE' && <ExploreScreen onSelectJob={() => setActiveTab('ACTIVE_SHIFT')} />}
        {activeTab === 'ACTIVE_SHIFT' && <ActiveShiftScreen onCompleteShift={() => setActiveTab('WALLET')} />}
        {activeTab === 'POST_JOB' && <PostJobScreen onJobPosted={() => setActiveTab('EXPLORE')} />}
        {activeTab === 'WALLET' && <WalletScreen />}
        {activeTab === 'PROFILE' && <ProfileScreen onLogout={async () => { await api.logout(); setAuthenticated(false); setActiveTab('EXPLORE'); }} />}
      </View>

      {/* Bottom Navigation (5 Tabs) */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('EXPLORE')}
        >
          <MapPin size={20} color={activeTab === 'EXPLORE' ? '#6366F1' : '#94a3b8'} />
          <Text style={[styles.navLabel, activeTab === 'EXPLORE' && styles.navLabelActive]}>
            Tìm Việc
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('ACTIVE_SHIFT')}
        >
          <Briefcase size={20} color={activeTab === 'ACTIVE_SHIFT' ? '#6366F1' : '#94a3b8'} />
          <Text style={[styles.navLabel, activeTab === 'ACTIVE_SHIFT' && styles.navLabelActive]}>
            Ca Tôi
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('POST_JOB')}
        >
          <PlusCircle size={24} color="#10b981" />
          <Text style={styles.navLabel}>Đăng Việc</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('WALLET')}
        >
          <Wallet size={20} color={activeTab === 'WALLET' ? '#6366F1' : '#94a3b8'} />
          <Text style={[styles.navLabel, activeTab === 'WALLET' && styles.navLabelActive]}>
            Ví Tiền
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('PROFILE')}
        >
          <User size={20} color={activeTab === 'PROFILE' ? '#6366F1' : '#94a3b8'} />
          <Text style={[styles.navLabel, activeTab === 'PROFILE' && styles.navLabelActive]}>
            Cá Nhân
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080D1A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#273449',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#94A3B8',
  },
  promoTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  promoText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#273449',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#6366F1',
    fontWeight: '800',
  },
});
