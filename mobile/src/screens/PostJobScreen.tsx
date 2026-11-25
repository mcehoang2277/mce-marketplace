import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Image, ScrollView } from 'react-native';
import { Zap, ShieldCheck, QrCode, RefreshCw } from 'lucide-react-native';
import { ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { api } from '../services/api';

interface Props { onJobPosted: () => void; }
type Payment = {
  paymentId: string; referenceCode: string; amountVnd: number; transferContent: string;
  qrImageUrl: string; bankCode: string; accountNumber: string; accountName: string; status: string;
};

export const PostJobScreen: React.FC<Props> = ({ onJobPosted }) => {
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState('3');
  const [rate, setRate] = useState('85000');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentStatus, setPaymentStatus] = useState('PENDING');

  const total = (parseInt(hours, 10) || 0) * (parseInt(rate, 10) || 0);

  const createQr = async (jobId: string) => {
    setBusy(true);
    try {
      const result = await api.createVietQrPayment(jobId);
      setPayment(result.payment);
      setPaymentStatus('PENDING');
      Alert.alert('Đã tạo yêu cầu thanh toán', 'Chuyển đúng số tiền và nội dung hiển thị. Công việc chỉ được mở khi ngân hàng/đơn vị đối soát xác nhận giao dịch.');
    } catch (error) {
      Alert.alert('Chưa tạo được QR', error instanceof Error ? error.message : 'Kiểm tra cấu hình tài khoản nhận tiền trên máy chủ.');
    } finally {
      setBusy(false);
    }
  };

  const refreshPaymentStatus = async () => {
    if (!payment) return;
    setBusy(true);
    try {
      const result = await api.paymentStatus(payment.paymentId);
      setPaymentStatus(result.payment.status);
      if (result.payment.status === 'SUCCESS') {
        Alert.alert('Đã xác nhận thanh toán', 'Ngân hàng đã xác nhận giao dịch. Công việc đã được mở nhận ứng tuyển.');
      } else {
        Alert.alert('Chưa nhận được xác nhận', 'Giao dịch vẫn đang chờ ngân hàng/SePay đối soát.');
      }
    } catch (error) {
      Alert.alert('Không kiểm tra được', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const handlePost = async () => {
    const duration = Number(hours);
    const hourlyRate = Number(rate);
    if (!title.trim() || title.trim().length < 5 || !address.trim() || !Number.isFinite(duration) || duration <= 0 || duration > 24 || !Number.isSafeInteger(hourlyRate) || hourlyRate <= 0) {
      Alert.alert('Thông tin chưa hợp lệ', 'Vui lòng kiểm tra tên việc, địa chỉ, số giờ và mức thù lao.');
      return;
    }

    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Cần cấp quyền vị trí để xác định tọa độ công việc.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const start = new Date(Date.now() + 60 * 60 * 1000);
      const end = new Date(start.getTime() + duration * 60 * 60 * 1000);
      const result = await api.createJob({
        title: title.trim(),
        description: title.trim(),
        category: 'Công việc thời vụ',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        hourlyRate,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        addressText: address.trim(),
        requiredSkills: []
      });
      setCreatedJobId(result.job.id);
      await createQr(result.job.id);
    } catch (error) {
      Alert.alert('Không thể tạo công việc', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.formCard}>
        <Text style={styles.header}>Đăng công việc mới</Text>
        <Text style={styles.helper}>Công việc sẽ ở trạng thái nháp cho đến khi ký quỹ được xác nhận.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>TÊN CÔNG VIỆC</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ví dụ: Phụ dọn kho, hỗ trợ sự kiện..." />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>SỐ TIẾNG</Text>
            <TextInput style={[styles.input, styles.inputCenter]} value={hours} onChangeText={setHours} keyboardType="numeric" />
          </View>
          <View style={[styles.field, { flex: 1.5 }]}>
            <Text style={styles.label}>THÙ LAO (VNĐ/GIỜ)</Text>
            <TextInput style={[styles.input, styles.inputCenter, { color: '#4f46e5', fontWeight: '800' }]} value={rate} onChangeText={setRate} keyboardType="numeric" />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>ĐỊA ĐIỂM THỰC HIỆN</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Số nhà, đường, phường/xã..." />
        </View>

        <View style={styles.calcCard}>
          <View>
            <Text style={styles.calcLabel}>NGÂN SÁCH KÝ QUỸ:</Text>
            <Text style={styles.calcTotal}>{total.toLocaleString('vi-VN')} VNĐ</Text>
          </View>
          <View style={styles.calcPromo}>
            <ShieldCheck size={12} color="#059669" />
            <Text style={styles.calcPromoText}>Máy chủ tính lại</Text>
          </View>
        </View>

        {!createdJobId && (
          <TouchableOpacity style={styles.submitBtn} onPress={handlePost} disabled={busy}>
            {busy ? <ActivityIndicator color="#ffffff" /> : <Zap size={16} color="#ffffff" />}
            <Text style={styles.submitBtnText}>Tạo công việc và yêu cầu ký quỹ</Text>
          </TouchableOpacity>
        )}
      </View>

      {createdJobId && (
        <View style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>Bước 2 · Thanh toán ký quỹ</Text>
          {payment ? (
            <>
              <Image source={{ uri: payment.qrImageUrl }} style={styles.qr} resizeMode="contain" />
              <Text style={styles.paymentAmount}>{payment.amountVnd.toLocaleString('vi-VN')} VNĐ</Text>
              <Text style={styles.paymentText}>Trạng thái: {paymentStatus === 'SUCCESS' ? 'ĐÃ XÁC NHẬN' : paymentStatus === 'FAILED' ? 'THẤT BẠI' : 'ĐANG CHỜ XÁC NHẬN'}</Text>
              <Text style={styles.paymentText}>Ngân hàng: {payment.bankCode}</Text>
              <Text style={styles.paymentText}>Tài khoản: {payment.accountNumber}</Text>
              <Text style={styles.paymentText}>Chủ tài khoản: {payment.accountName}</Text>
              <Text style={styles.paymentText}>Nội dung: {payment.transferContent}</Text>
              <Text style={styles.warning}>Không đánh dấu đã thanh toán bằng ảnh chụp. Trạng thái sẽ chỉ thay đổi sau khi webhook ngân hàng thật được tích hợp và xác thực.</Text>
            </>
          ) : (
            <Text style={styles.helper}>Bản nháp đã được tạo. Có thể thử tạo lại QR sau khi máy chủ cấu hình tài khoản nhận tiền.</Text>
          )}
          <TouchableOpacity style={styles.retryBtn} onPress={() => createQr(createdJobId)} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <RefreshCw size={15} color="#fff" />}
            <Text style={styles.submitBtnText}>{payment ? 'Tạo lại yêu cầu thanh toán' : 'Tạo mã VietQR'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.retryBtn} onPress={refreshPaymentStatus} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <RefreshCw size={15} color="#fff" />}
            <Text style={styles.submitBtnText}>Kiểm tra trạng thái thanh toán</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtn} onPress={onJobPosted}>
            <Text style={styles.doneText}>Quay lại danh sách việc</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 14 },
  formCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  header: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  helper: { color: '#64748b', fontSize: 12, lineHeight: 18 },
  field: { gap: 5 },
  row: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, color: '#0f172a' },
  inputCenter: { textAlign: 'center' },
  calcCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 12, borderRadius: 14 },
  calcLabel: { fontSize: 10, color: '#64748b', fontWeight: '700' },
  calcTotal: { fontSize: 17, fontWeight: '900', color: '#4f46e5' },
  calcPromo: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  calcPromoText: { fontSize: 10, fontWeight: '800', color: '#065f46' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4f46e5', paddingVertical: 14, borderRadius: 14 },
  submitBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  paymentCard: { backgroundColor: '#0f172a', borderRadius: 18, padding: 18, gap: 10 },
  paymentTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  qr: { width: 220, height: 220, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 12 },
  paymentAmount: { color: '#34d399', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  paymentText: { color: '#e2e8f0', fontSize: 12 },
  warning: { color: '#fcd34d', fontSize: 11, lineHeight: 17, marginTop: 4 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4f46e5', padding: 13, borderRadius: 12 },
  doneBtn: { alignItems: 'center', padding: 10 },
  doneText: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' }
});
