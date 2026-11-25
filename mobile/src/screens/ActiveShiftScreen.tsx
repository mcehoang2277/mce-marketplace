import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, CheckCircle2, MapPin, RefreshCw, ShieldAlert } from 'lucide-react-native';
import * as Location from 'expo-location';
import { api, Job } from '../services/api';

type ActiveJob = Job & {
  status: string;
  posterId: string;
  workerId: string | null;
  checkEvents: Array<{ eventType: 'CHECK_IN' | 'CHECK_OUT'; recordedAt: string }>;
};

interface Props { onCompleteShift: () => void; }
const money = (value: string | number) => `${Number(value).toLocaleString('vi-VN')} đ`;

export const ActiveShiftScreen: React.FC<Props> = ({ onCompleteShift }) => {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [active, me] = await Promise.all([api.myActiveJobs(), api.me()]);
      setJobs(active.jobs);
      setUserId(me.user.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được ca làm.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const getDeviceLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') throw new Error('Bạn cần cấp quyền vị trí khi sử dụng ứng dụng.');
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) throw new Error('Hãy bật dịch vụ định vị trên điện thoại.');
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    if (position.coords.accuracy === null || position.coords.accuracy > 50) {
      throw new Error('GPS hiện chưa đủ chính xác (yêu cầu sai số tối đa 50m). Hãy thử lại ở nơi thoáng.');
    }
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracyMeters: position.coords.accuracy
    };
  };

  const checkAction = async (job: ActiveJob, action: 'CHECK_IN' | 'CHECK_OUT') => {
    setBusyJobId(job.id);
    try {
      const location = await getDeviceLocation();
      if (action === 'CHECK_IN') await api.checkIn(job.id, location);
      else await api.checkOut(job.id, location);
      Alert.alert(action === 'CHECK_IN' ? 'Check-in thành công' : 'Đã gửi nghiệm thu', action === 'CHECK_IN'
        ? 'Máy chủ đã ghi nhận vị trí và thời điểm bắt đầu ca.'
        : 'Đã ghi nhận check-out. Chủ việc cần xác nhận hoàn thành trước khi tiền được giải ngân.');
      await load();
    } catch (reason) {
      Alert.alert('Không thể chấm công', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
    } finally {
      setBusyJobId(null);
    }
  };

  const approve = async (job: ActiveJob) => {
    setBusyJobId(job.id);
    try {
      await api.approveCompletion(job.id);
      Alert.alert('Đã nghiệm thu', 'Khoản thù lao đã được chuyển vào số dư ví của người làm trong sổ cái nội bộ.');
      await load();
      onCompleteShift();
    } catch (reason) {
      Alert.alert('Không thể nghiệm thu', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
    } finally {
      setBusyJobId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.intro}>
        <Text style={styles.title}>Ca làm của tôi</Text>
        <Text style={styles.subtitle}>GPS được lấy từ thiết bị và kiểm tra lại tại máy chủ theo bán kính địa điểm công việc.</Text>
        <TouchableOpacity style={styles.refresh} onPress={() => { setLoading(true); void load(); }}>
          <RefreshCw size={14} color="#cbd5e1" />
          <Text style={styles.refreshText}>Làm mới</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color="#6366f1" style={{ margin: 24 }} />}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!loading && jobs.length === 0 && <View style={styles.empty}><Text style={styles.emptyTitle}>Chưa có ca làm đang hoạt động</Text><Text style={styles.emptyText}>Các công việc đã được giao sẽ xuất hiện tại đây.</Text></View>}

      {jobs.map((job) => {
        const isWorker = job.workerId === userId;
        const isPoster = job.posterId === userId;
        const busy = busyJobId === job.id;
        const statusLabel: Record<string, string> = {
          ASSIGNED: 'Đã phân công', IN_PROGRESS: 'Đang thực hiện', PENDING_REVIEW: 'Chờ nghiệm thu'
        };
        return (
          <View key={job.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Text style={styles.status}>{statusLabel[job.status] || job.status}</Text>
            </View>
            <Text style={styles.meta}>{job.addressText}</Text>
            <Text style={styles.amount}>{money(job.totalEstimatedVnd)}</Text>
            <View style={styles.eventRow}>
              <MapPin size={14} color="#64748b" />
              <Text style={styles.meta}>Check-in: {job.checkEvents.find((e) => e.eventType === 'CHECK_IN') ? new Date(job.checkEvents.find((e) => e.eventType === 'CHECK_IN')!.recordedAt).toLocaleString('vi-VN') : 'Chưa thực hiện'}</Text>
            </View>
            <View style={styles.eventRow}>
              <Camera size={14} color="#64748b" />
              <Text style={styles.meta}>Check-out: {job.checkEvents.find((e) => e.eventType === 'CHECK_OUT') ? new Date(job.checkEvents.find((e) => e.eventType === 'CHECK_OUT')!.recordedAt).toLocaleString('vi-VN') : 'Chưa thực hiện'}</Text>
            </View>

            {isWorker && job.status === 'ASSIGNED' && (
              <TouchableOpacity style={styles.primaryBtn} disabled={busy} onPress={() => checkAction(job, 'CHECK_IN')}>
                {busy ? <ActivityIndicator color="#fff" /> : <MapPin size={16} color="#fff" />}
                <Text style={styles.buttonText}>Check-in bằng GPS</Text>
              </TouchableOpacity>
            )}
            {isWorker && job.status === 'IN_PROGRESS' && (
              <TouchableOpacity style={styles.primaryBtn} disabled={busy} onPress={() => checkAction(job, 'CHECK_OUT')}>
                {busy ? <ActivityIndicator color="#fff" /> : <CheckCircle2 size={16} color="#fff" />}
                <Text style={styles.buttonText}>Check-out và gửi nghiệm thu</Text>
              </TouchableOpacity>
            )}
            {isPoster && job.status === 'PENDING_REVIEW' && (
              <TouchableOpacity style={styles.approveBtn} disabled={busy} onPress={() => approve(job)}>
                {busy ? <ActivityIndicator color="#fff" /> : <CheckCircle2 size={16} color="#fff" />}
                <Text style={styles.buttonText}>Xác nhận hoàn thành & giải ngân</Text>
              </TouchableOpacity>
            )}
            <View style={styles.notice}>
              <ShieldAlert size={15} color="#f59e0b" />
              <Text style={styles.noticeText}>GPS chỉ hỗ trợ xác định vị trí; không phải bằng chứng tuyệt đối chống giả lập vị trí. Ảnh nghiệm thu và chống gian lận thiết bị sẽ được bổ sung ở bước tiếp theo.</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080d1a' },
  content: { padding: 14, gap: 12 },
  intro: { backgroundColor: '#0f172a', borderRadius: 16, padding: 16, gap: 8 },
  title: { color: '#f8fafc', fontSize: 19, fontWeight: '900' },
  subtitle: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  refreshText: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 15, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  jobTitle: { flex: 1, color: '#0f172a', fontSize: 14, fontWeight: '900' },
  status: { color: '#4338ca', fontSize: 10, fontWeight: '800' },
  meta: { color: '#64748b', fontSize: 11 },
  amount: { color: '#059669', fontSize: 17, fontWeight: '900' },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  primaryBtn: { backgroundColor: '#4f46e5', borderRadius: 11, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  approveBtn: { backgroundColor: '#059669', borderRadius: 11, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, backgroundColor: '#fffbeb' },
  noticeText: { flex: 1, color: '#92400e', fontSize: 10, lineHeight: 15 },
  empty: { backgroundColor: '#0f172a', borderRadius: 14, padding: 18, gap: 6 },
  emptyTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  emptyText: { color: '#94a3b8', fontSize: 12 },
  error: { color: '#fca5a5', fontSize: 12 }
});
