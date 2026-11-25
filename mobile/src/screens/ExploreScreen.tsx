import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MapPin, Clock, ShieldCheck, Zap } from 'lucide-react-native';
import { ActivityIndicator } from 'react-native';
import { api, Job } from '../services/api';

interface Props {
  onSelectJob: (job: any) => void;
}

export const ExploreScreen: React.FC<Props> = ({ onSelectJob }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    api.listJobs()
      .then((result) => { if (active) setJobs(result.jobs); })
      .catch((error: Error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const formatVnd = (value: string | number) =>
    `${Number(value).toLocaleString('vi-VN')}đ`;


  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Map Simulation Bar */}
      <View style={styles.mapBanner}>
        <View style={styles.radarPill}>
          <View style={styles.radarDot} />
          <Text style={styles.radarText}>Quét việc làm trong bán kính 6.0 km</Text>
        </View>
        <Text style={styles.mapSub}>Việc làm đang mở từ hệ thống MCE</Text>
      </View>

      <View style={styles.jobList}>
        <Text style={styles.sectionTitle}>CÁC CA VIỆC ĐƯỢC CHẤM ĐIỂM CAO NHẤT:</Text>

        {loading && <ActivityIndicator color="#6366f1" style={{ marginVertical: 24 }} />}
        {!!loadError && <Text style={styles.metaText}>Không tải được việc làm: {loadError}</Text>}
        {!loading && !loadError && jobs.length === 0 && <Text style={styles.metaText}>Chưa có công việc nào đang mở.</Text>}
        {jobs.map((job) => (
          <View key={job.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.tagBadge}>
                <ShieldCheck size={12} color="#059669" />
                <Text style={styles.tagText}>{job.category}</Text>
              </View>
              <Text style={styles.payoutText}>{formatVnd(job.totalEstimatedVnd)}</Text>
            </View>

            <Text style={styles.jobTitle}>{job.title}</Text>
            
            <View style={styles.metaRow}>
              <MapPin size={13} color="#ef4444" />
              <Text style={styles.metaText}>{job.addressText}</Text>
            </View>

            <View style={styles.metaRow}>
              <Clock size={13} color="#6366f1" />
              <Text style={styles.metaText}>{new Date(job.startTime).toLocaleString('vi-VN')} – {new Date(job.endTime).toLocaleString('vi-VN')} · {formatVnd(job.hourlyRate)}/giờ</Text>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.escrowNote}>Thông tin do người đăng cung cấp</Text>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onSelectJob(job)}
              >
                <Zap size={14} color="#ffffff" />
                <Text style={styles.actionBtnText}>Nhận Ca Này</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mapBanner: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  radarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  radarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  radarText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  mapSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 8,
  },
  jobList: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#065f46',
  },
  payoutText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4f46e5',
  },
  jobTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  metaText: {
    fontSize: 11,
    color: '#64748b',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  escrowNote: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
});
