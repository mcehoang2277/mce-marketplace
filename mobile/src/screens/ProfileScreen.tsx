import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';

type Profile = {
  id: string; name: string; phone: string; role: string; karmaScore: number;
  isKycVerified: boolean; isPhoneVerified: boolean; skills: string[];
  avatarUrl: string | null; walletBalanceVnd: number;
};

export function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [skills, setSkills] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [completedJobs, setCompletedJobs] = useState<Array<{ id: string; title: string; posterId: string; workerId: string | null; poster: { id: string; fullName: string }; worker: { id: string; fullName: string } | null; reviews: Array<{ id: string; rating: number }> }>>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);

  const loadProfile = async () => {
    const [result, completed] = await Promise.all([api.me(), api.completedJobs()]);
    setCompletedJobs(completed.jobs);
    const user = result.user as Profile;
    setProfile(user);
    setFullName(user.name);
    setSkills((user.skills || []).join(', '));
  };

  useEffect(() => {
    let active = true;
    Promise.all([api.me(), api.completedJobs()])
      .then(([result, completed]) => {
        if (active) setCompletedJobs(completed.jobs);
        if (!active) return;
        const user = result.user as Profile;
        setProfile(user);
        setFullName(user.name);
        setSkills((user.skills || []).join(', '));
      })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async () => {
    if (fullName.trim().length < 2) {
      Alert.alert('Tên chưa hợp lệ', 'Tên hiển thị cần có ít nhất 2 ký tự.');
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({
        fullName: fullName.trim(),
        skills: skills.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 30)
      });
      await loadProfile();
      Alert.alert('Đã cập nhật', 'Thông tin hồ sơ đã được lưu.');
    } catch (reason) {
      Alert.alert('Không thể cập nhật', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.heading}>HỒ SƠ MCE</Text>
        {loading && <ActivityIndicator color="#818cf8" />}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {profile && (
          <>
            <Text style={styles.label}>HỌ VÀ TÊN</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} maxLength={100} />
            <Text style={styles.label}>KỸ NĂNG (PHÂN CÁCH BẰNG DẤU PHẨY)</Text>
            <TextInput style={styles.input} value={skills} onChangeText={setSkills} placeholder="Ví dụ: phục vụ, nhập liệu, bốc xếp" />
            <Text style={styles.value}>Số điện thoại: {profile.phone}</Text>
            <Text style={styles.value}>Vai trò: {profile.role}</Text>
            <Text style={styles.value}>Xác minh số điện thoại: {profile.isPhoneVerified ? 'Đã xác minh' : 'Chưa xác minh'}</Text>
            <Text style={styles.value}>eKYC: {profile.isKycVerified ? 'Đã xác minh' : 'Chưa xác minh'}</Text>
            <Text style={styles.value}>Điểm uy tín: {profile.karmaScore.toFixed(1)} / 5</Text>
            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Lưu hồ sơ</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
      {profile && completedJobs.length > 0 && (
        <View style={styles.reviewCard}>
          <Text style={styles.reviewHeading}>ĐÁNH GIÁ SAU CÔNG VIỆC</Text>
          {completedJobs.map((job) => {
            const reviewee = job.posterId === profile.id ? job.worker : job.poster;
            const alreadyReviewed = job.reviews.length > 0;
            return (
              <View key={job.id} style={styles.reviewItem}>
                <Text style={styles.reviewJob}>{job.title}</Text>
                <Text style={styles.reviewMeta}>Đánh giá: {reviewee?.fullName || 'Người tham gia'}</Text>
                {alreadyReviewed ? (
                  <Text style={styles.reviewDone}>Bạn đã gửi đánh giá cho công việc này.</Text>
                ) : (
                  <>
                    <View style={styles.ratingRow}>
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <TouchableOpacity key={rating} onPress={() => setRatings((old) => ({ ...old, [job.id]: rating }))}>
                          <Text style={[styles.star, (ratings[job.id] || 5) >= rating && styles.starSelected]}>★</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity style={styles.reviewButton} disabled={reviewBusy === job.id} onPress={async () => {
                      setReviewBusy(job.id);
                      try {
                        await api.submitReview(job.id, ratings[job.id] || 5);
                        const refreshed = await api.completedJobs();
                        setCompletedJobs(refreshed.jobs);
                        Alert.alert('Đã gửi đánh giá', 'Cảm ơn bạn đã đóng góp điểm uy tín cho cộng đồng MCE.');
                      } catch (reason) {
                        Alert.alert('Không thể gửi đánh giá', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
                      } finally {
                        setReviewBusy(null);
                      }
                    }}>
                      <Text style={styles.reviewButtonText}>{reviewBusy === job.id ? 'Đang gửi...' : 'Gửi đánh giá'}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            );
          })}
        </View>
      )}
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Xác minh danh tính</Text>
        <Text style={styles.note}>MCE chưa kết nối nhà cung cấp SMS OTP/eKYC. Trạng thái xác minh chỉ được cập nhật sau khi đối tác xác thực độc lập; người dùng không thể tự đánh dấu đã xác minh.</Text>
      </View>
      <TouchableOpacity style={styles.logout} onPress={() => {
        Alert.alert('Đăng xuất', 'Bạn có muốn đăng xuất khỏi MCE?', [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Đăng xuất', style: 'destructive', onPress: onLogout }
        ]);
      }}>
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080d1a' },
  content: { padding: 16, gap: 14 },
  card: { backgroundColor: '#151f32', borderColor: '#273449', borderWidth: 1, borderRadius: 18, padding: 18, gap: 11 },
  heading: { color: '#94a3b8', fontSize: 11, fontWeight: '900' },
  label: { color: '#94a3b8', fontSize: 10, fontWeight: '800' },
  input: { backgroundColor: '#0f172a', borderColor: '#334155', borderWidth: 1, borderRadius: 10, padding: 11, color: '#f8fafc', fontSize: 13 },
  value: { color: '#cbd5e1', fontSize: 12 },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 11, alignItems: 'center', padding: 13, marginTop: 4 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  error: { color: '#fca5a5', fontSize: 12 },
  reviewCard: { backgroundColor: '#151f32', borderColor: '#334155', borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  reviewHeading: { color: '#cbd5e1', fontSize: 11, fontWeight: '900' },
  reviewItem: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10, gap: 6 },
  reviewJob: { color: '#f8fafc', fontSize: 13, fontWeight: '800' },
  reviewMeta: { color: '#94a3b8', fontSize: 11 },
  reviewDone: { color: '#34d399', fontSize: 11 },
  ratingRow: { flexDirection: 'row', gap: 12 },
  star: { color: '#475569', fontSize: 24 },
  starSelected: { color: '#fbbf24' },
  reviewButton: { backgroundColor: '#059669', alignSelf: 'flex-start', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  reviewButtonText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  notice: { backgroundColor: '#1c1917', borderColor: '#78350f', borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  noticeTitle: { color: '#fdba74', fontSize: 14, fontWeight: '800' },
  note: { color: '#cbd5e1', fontSize: 12, lineHeight: 19 },
  logout: { backgroundColor: '#7f1d1d', borderRadius: 12, alignItems: 'center', padding: 14 },
  logoutText: { color: '#fff', fontWeight: '800' }
});
