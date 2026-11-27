export interface VietnamBankInfo {
  code: string;
  bin: string;
  shortName: string;
  fullName: string;
  swiftCode: string;
  aliases: string[];
  napasSupported: boolean;
}

/**
 * Danh mục ngân hàng Việt Nam hỗ trợ chuyển khoản nhanh NAPAS 24/7 & VietQR.
 */
export const VIETNAM_BANKS: VietnamBankInfo[] = [
  { code: 'VCB', bin: '970436', shortName: 'Vietcombank', fullName: 'Ngân hàng TMCP Ngoại thương Việt Nam', swiftCode: 'BFTVVNVX', aliases: ['vcb', 'ngoai thuong', 'vietcombank'], napasSupported: true },
  { code: 'TCB', bin: '970407', shortName: 'Techcombank', fullName: 'Ngân hàng TMCP Kỹ thương Việt Nam', swiftCode: 'VTCBVNVX', aliases: ['tcb', 'ky thuong', 'techcombank'], napasSupported: true },
  { code: 'MB', bin: '970422', shortName: 'MBBank', fullName: 'Ngân hàng TMCP Quân đội', swiftCode: 'MSCBVNVX', aliases: ['mb', 'mbbank', 'quan doi'], napasSupported: true },
  { code: 'BIDV', bin: '970418', shortName: 'BIDV', fullName: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', swiftCode: 'BIDVVNVX', aliases: ['bidv', 'dau tu va phat trien'], napasSupported: true },
  { code: 'ICB', bin: '970415', shortName: 'VietinBank', fullName: 'Ngân hàng TMCP Công thương Việt Nam', swiftCode: 'ICBVVNVX', aliases: ['ctg', 'icb', 'cong thuong', 'vietinbank'], napasSupported: true },
  { code: 'ACB', bin: '970416', shortName: 'ACB', fullName: 'Ngân hàng TMCP Á Châu', swiftCode: 'ASCBVNVX', aliases: ['acb', 'a chau'], napasSupported: true },
  { code: 'VPB', bin: '970432', shortName: 'VPBank', fullName: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', swiftCode: 'VPBKVNVX', aliases: ['vpb', 'vpbank', 'thinh vuong'], napasSupported: true },
  { code: 'TPB', bin: '970423', shortName: 'TPBank', fullName: 'Ngân hàng TMCP Tiên Phong', swiftCode: 'TPBVVNVX', aliases: ['tpb', 'tpbank', 'tien phong'], napasSupported: true },
  { code: 'STB', bin: '970403', shortName: 'Sacombank', fullName: 'Ngân hàng TMCP Sài Gòn Thương Tín', swiftCode: 'SGTTVNVX', aliases: ['stb', 'sacombank', 'sai gon thuong tin'], napasSupported: true },
  { code: 'HDB', bin: '970437', shortName: 'HDBank', fullName: 'Ngân hàng TMCP Phát triển TP. Hồ Chí Minh', swiftCode: 'HDBCVNVX', aliases: ['hdb', 'hdbank'], napasSupported: true },
  { code: 'VIB', bin: '970441', shortName: 'VIB', fullName: 'Ngân hàng TMCP Quốc tế Việt Nam', swiftCode: 'VNIBVNVX', aliases: ['vib', 'quoc te'], napasSupported: true },
  { code: 'MSB', bin: '970426', shortName: 'MSB', fullName: 'Ngân hàng TMCP Hàng Hải Việt Nam', swiftCode: 'MCOBVNVX', aliases: ['msb', 'hang hai', 'maritime'], napasSupported: true },
  { code: 'SHB', bin: '970443', shortName: 'SHB', fullName: 'Ngân hàng TMCP Sài Gòn - Hà Nội', swiftCode: 'SHBAVNVX', aliases: ['shb', 'sai gon ha noi'], napasSupported: true },
  { code: 'OCB', bin: '970448', shortName: 'OCB', fullName: 'Ngân hàng TMCP Phương Đông', swiftCode: 'ORCOVNVX', aliases: ['ocb', 'phuong dong'], napasSupported: true },
  { code: 'SEAB', bin: '970440', shortName: 'SeABank', fullName: 'Ngân hàng TMCP Đông Nam Á', swiftCode: 'SEAVVNVX', aliases: ['seab', 'seabank', 'dong nam a'], napasSupported: true },
  { code: 'EIB', bin: '970431', shortName: 'Eximbank', fullName: 'Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam', swiftCode: 'EBVIVNVX', aliases: ['eib', 'eximbank', 'xuat nhap khau'], napasSupported: true },
  { code: 'LPB', bin: '970449', shortName: 'LPBank', fullName: 'Ngân hàng TMCP Lộc Phát Việt Nam', swiftCode: 'LVBKVNVX', aliases: ['lpb', 'lpbank', 'lien viet', 'loc phat'], napasSupported: true },
  { code: 'VBA', bin: '970405', shortName: 'Agribank', fullName: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam', swiftCode: 'VBAAVNVX', aliases: ['vba', 'agribank', 'nong nghiep'], napasSupported: true },
  { code: 'NAB', bin: '970428', shortName: 'Nam A Bank', fullName: 'Ngân hàng TMCP Nam Á', swiftCode: 'NAMAVNVX', aliases: ['nab', 'nam a'], napasSupported: true },
  { code: 'ABB', bin: '970425', shortName: 'ABBANK', fullName: 'Ngân hàng TMCP An Bình', swiftCode: 'ABBKVNVX', aliases: ['abb', 'abbank', 'an binh'], napasSupported: true },
  { code: 'BAB', bin: '970409', shortName: 'Bac A Bank', fullName: 'Ngân hàng TMCP Bắc Á', swiftCode: 'NASCVNVX', aliases: ['bab', 'bac a'], napasSupported: true },
  { code: 'BVB', bin: '970454', shortName: 'BVBank', fullName: 'Ngân hàng TMCP Bản Việt', swiftCode: 'VCBCVNVX', aliases: ['bvb', 'bvbank', 'ban viet', 'vietcapital'], napasSupported: true },
  { code: 'CAKE', bin: '546034', shortName: 'CAKE by VPBank', fullName: 'Ngân hàng số CAKE by VPBank', swiftCode: 'VPBKVNVX', aliases: ['cake', 'ngan hang so cake'], napasSupported: true },
  { code: 'UBANK', bin: '546035', shortName: 'Ubank by VPBank', fullName: 'Ngân hàng số Ubank by VPBank', swiftCode: 'VPBKVNVX', aliases: ['ubank'], napasSupported: true },
  { code: 'TIMO', bin: '963388', shortName: 'Timo', fullName: 'Ngân hàng số Timo by Bản Việt', swiftCode: 'VCBCVNVX', aliases: ['timo'], napasSupported: true },
  { code: 'PVCB', bin: '970412', shortName: 'PVcomBank', fullName: 'Ngân hàng TMCP Đại Chúng Việt Nam', swiftCode: 'WBVNVNVX', aliases: ['pvcb', 'pvcombank', 'dai chung'], napasSupported: true },
  { code: 'SHBVN', bin: '970424', shortName: 'Shinhan Bank', fullName: 'Ngân hàng TNHH MTV Shinhan Việt Nam', swiftCode: 'SHBKVNVX', aliases: ['shbvn', 'shinhan'], napasSupported: true },
  { code: 'WVN', bin: '970457', shortName: 'Woori Bank', fullName: 'Ngân hàng TNHH MTV Woori Việt Nam', swiftCode: 'HVBKVNVX', aliases: ['wvn', 'woori'], napasSupported: true },
  { code: 'HSBC', bin: '458761', shortName: 'HSBC', fullName: 'Ngân hàng TNHH MTV HSBC Việt Nam', swiftCode: 'HSBCVNVX', aliases: ['hsbc'], napasSupported: true },
  { code: 'SCVN', bin: '970410', shortName: 'Standard Chartered', fullName: 'Ngân hàng TNHH MTV Standard Chartered Việt Nam', swiftCode: 'SCBLVNVX', aliases: ['scvn', 'standard chartered'], napasSupported: true },
  { code: 'KLB', bin: '970452', shortName: 'KienlongBank', fullName: 'Ngân hàng TMCP Kiên Long', swiftCode: 'KLBKVNVX', aliases: ['klb', 'kienlongbank', 'kien long'], napasSupported: true },
  { code: 'SGB', bin: '970400', shortName: 'SAIGONBANK', fullName: 'Ngân hàng TMCP Sài Gòn Công Thương', swiftCode: 'SBITVNVX', aliases: ['sgb', 'saigonbank'], napasSupported: true },
  { code: 'BVBANK', bin: '970438', shortName: 'BaoViet Bank', fullName: 'Ngân hàng TMCP Bảo Việt', swiftCode: 'BVBVVNVX', aliases: ['bvbk', 'baoviet', 'bao viet'], napasSupported: true },
  { code: 'VAB', bin: '970427', shortName: 'VietABank', fullName: 'Ngân hàng TMCP Việt Á', swiftCode: 'VNACVNVX', aliases: ['vab', 'vietabank', 'viet a'], napasSupported: true },
  { code: 'NCB', bin: '970419', shortName: 'NCB', fullName: 'Ngân hàng TMCP Quốc Dân', swiftCode: 'NVBAVNVX', aliases: ['ncb', 'quoc dan'], napasSupported: true },
  { code: 'PGB', bin: '970430', shortName: 'PGBank', fullName: 'Ngân hàng TMCP Thịnh Vượng và Phát triển', swiftCode: 'PGBLVNVX', aliases: ['pgb', 'pgbank', 'petrolimex'], napasSupported: true },
  { code: 'VIETBANK', bin: '970433', shortName: 'VietBank', fullName: 'Ngân hàng TMCP Việt Nam Thương Tín', swiftCode: 'VNTTVNVX', aliases: ['vietbank'], napasSupported: true },
  { code: 'COOPBANK', bin: '970446', shortName: 'CO-OPBANK', fullName: 'Ngân hàng Hợp tác xã Việt Nam', swiftCode: 'COOPVNVX', aliases: ['coopbank', 'hop tac xa'], napasSupported: true },
  { code: 'UOB', bin: '970458', shortName: 'UOB', fullName: 'Ngân hàng TNHH MTV United Overseas Bank Việt Nam', swiftCode: 'UOVBVNVX', aliases: ['uob'], napasSupported: true }
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase();
}

export function searchVietnamBanks(query?: string): VietnamBankInfo[] {
  const q = normalizeText(query || '');
  if (!q) return VIETNAM_BANKS;
  return VIETNAM_BANKS.filter((bank) => {
    const fields = [bank.code, bank.bin, bank.shortName, bank.fullName, ...bank.aliases];
    return fields.some((item) => normalizeText(item).includes(q));
  });
}

export function findVietnamBank(input?: string): VietnamBankInfo | undefined {
  const q = normalizeText(input || '');
  if (!q) return undefined;
  return VIETNAM_BANKS.find((bank) =>
    normalizeText(bank.code) === q ||
    normalizeText(bank.bin) === q ||
    normalizeText(bank.shortName) === q ||
    normalizeText(bank.fullName) === q ||
    bank.aliases.some((alias) => normalizeText(alias) === q)
  );
}
