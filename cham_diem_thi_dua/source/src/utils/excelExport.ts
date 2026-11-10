import { MonthlyScoreRecord, UserProfile, Department } from '../types';
import { classifyEmulationRecord, compareEmulationScores, getPeriodBaseScore, getPeriodShortTitle, type PeriodSelection } from './academicYear';
import { CURRENT_SCHOOL_YEAR } from '../data/constants';
import { DEFAULT_PASSWORD } from './auth';

/**
 * Tải động thư viện SheetJS chỉ khi người dùng thực hiện thao tác liên quan tới Excel.
 * Giúp tiết kiệm hơn 400KB bundle khởi tạo ban đầu.
 */
async function getXlsx() {
  return await import('xlsx');
}

export async function exportMonthlyScoreToExcel(
  records: MonthlyScoreRecord[],
  period: PeriodSelection,
  year: string = CURRENT_SCHOOL_YEAR,
  schoolName: string = 'TRƯỜNG THPT CHU VĂN AN'
): Promise<void> {
  const XLSX = await getXlsx();
  const isNumericMonth = typeof period === 'number';
  const periodTitle = getPeriodShortTitle(period).toUpperCase();
  const sheetTag = isNumericMonth ? `T${String(period).padStart(2, '0')}` : period.toUpperCase();
  const periodBaseScore = getPeriodBaseScore(period);

  // Format data for Excel worksheet matching official school template
  const rows: (string | number)[][] = [
    ['SỞ GIÁO DỤC VÀ ĐÀO TẠO', '', '', '', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
    [schoolName.toUpperCase(), '', '', '', 'Độc lập - Tự do - Hạnh phúc'],
    ['', '', '', '', ''],
    [`BẢNG TỔNG HỢP CHẤM ĐIỂM THI ĐUA XẾP LOẠI CBVC - ${periodTitle}`],
    [`Năm học: ${year} (Điểm chuẩn kỳ báo cáo: ${periodBaseScore})`],
    ['', '', '', '', ''],
    [
      'STT',
      'Mã CBVC',
      'Họ và tên',
      'Chức vụ / Công tác',
      'Tổ chuyên môn',
      'Điểm nền',
      'Điểm Cộng (Ghi rõ nội dung cộng)',
      'Tổng điểm cộng',
      'Điểm Trừ (Ghi rõ nội dung trừ)',
      'Tổng điểm trừ',
      'Tổng điểm (Sau cộng trừ)',
      'Điểm chốt BGH',
      'Trạng thái duyệt',
      'Xếp loại dự kiến',
      'Ghi chú BGH'
    ],
  ];

  [...records].sort(compareEmulationScores).forEach((rec, idx) => {
    // Format bonus text: "+ 6đ(TTCM) + 3đ(phó BT)"
    const bonusText = rec.bonusItems.length > 0
      ? rec.bonusItems.map(b => `+${b.points}đ (${b.title.replace(/^\+?\d+đ\s*/, '')})`).join('; ')
      : '-';

    // Format penalty text: "- 2đ(Đi họp muộn)"
    const penaltyText = rec.penaltyItems.length > 0
      ? rec.penaltyItems.map(p => `-${p.points}đ (${p.title.replace(/^-?\d+đ\s*/, '')})`).join('; ')
      : '-';

    // Projected ranking badge
    const finalScore = rec.bghApprovedScore ?? rec.totalScore;
    const rankBadge = classifyEmulationRecord(finalScore, idx + 1, records.length, periodBaseScore).label;

    const statusText = rec.status === 'approved'
      ? 'Đã duyệt chốt điểm'
      : rec.status === 'submitted'
      ? 'Chờ BGH duyệt'
      : rec.status === 'locked'
      ? 'Đã khóa sổ'
      : 'Bản nháp';

    rows.push([
      idx + 1,
      rec.staffCode,
      rec.staffName,
      rec.position,
      rec.departmentName,
      rec.baseScore,
      bonusText,
      rec.totalBonus,
      penaltyText,
      rec.totalPenalty,
      rec.totalScore,
      rec.bghApprovedScore ?? 'Chưa chốt',
      statusText,
      rankBadge,
      rec.bghNotes || ''
    ]);
  });

  // Summary row
  const totalStaff = records.length;
  const avgScore = totalStaff > 0
    ? (records.reduce((acc, r) => acc + (r.bghApprovedScore ?? r.totalScore), 0) / totalStaff).toFixed(1)
    : 0;

  rows.push(['', '', '', '', '']);
  rows.push(['', '', 'TỔNG CỘNG / TRUNG BÌNH:', '', '', '', '', '', '', '', '', Number(avgScore), '', '', '']);
  rows.push(['', '', '', '', '']);
  rows.push([
    '',
    '',
    'NGƯỜI LẬP BẢNG',
    '',
    'TỔ TRƯỞNG CHUYÊN MÔN',
    '',
    'BAN THI ĐUA NHÀ TRƯỜNG',
    '',
    'HIỆU TRƯỞNG PHÊ DUYỆT'
  ]);
  rows.push([
    '',
    '',
    '(Ký và ghi rõ họ tên)',
    '',
    '(Ký và ghi rõ họ tên)',
    '',
    '(Ký và ghi rõ họ tên)',
    '',
    '(Ký tên và đóng dấu)'
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 6 },  // STT
    { wch: 10 }, // Ma CBVC
    { wch: 24 }, // Ho va ten
    { wch: 28 }, // Chuc vu
    { wch: 22 }, // To CM
    { wch: 10 }, // Diem nen
    { wch: 38 }, // Diem cong
    { wch: 14 }, // Tong cong
    { wch: 30 }, // Diem tru
    { wch: 14 }, // Tong tru
    { wch: 14 }, // Tong diem
    { wch: 14 }, // Diem chot BGH
    { wch: 18 }, // Trang thai
    { wch: 32 }, // Xep loai
    { wch: 36 }, // Ghi chu
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `ThiDua_${sheetTag}`);

  // Trigger download
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const cleanTag = isNumericMonth ? `Thang_${String(period).padStart(2, '0')}` : period.toUpperCase();
  const fileName = `Bang_Tong_Hop_Thi_Dua_${cleanTag}_${year}_${dateStr}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/** Tải file Excel mẫu danh sách CBVC */
export async function downloadSampleStaffExcel(): Promise<void> {
  const XLSX = await getXlsx();
  const sampleData = [
    {
      'STT': 1,
      'Mã CBVC': 'GV001',
      'Họ và tên': 'Nguyễn Văn Hưng',
      'Tổ chuyên môn': 'Ban Giám Hiệu',
      'Chức vụ': 'Hiệu trưởng - Chủ tịch Hội đồng TĐ',
      'Môn giảng dạy': 'Toán',
      'Nhiệm vụ kiêm nhiệm': 'Bí thư Chi bộ, Phụ trách chung',
      'Chủ nhiệm lớp': '',
      'Số điện thoại': '0912345678',
      'Email': 'hungnv@thptchuvanan.edu.vn'
    },
    {
      'STT': 2,
      'Mã CBVC': 'GV002',
      'Họ và tên': 'Trần Thị Mai',
      'Tổ chuyên môn': 'Ban Giám Hiệu',
      'Chức vụ': 'Phó Hiệu trưởng',
      'Môn giảng dạy': 'Ngữ văn',
      'Nhiệm vụ kiêm nhiệm': 'Phụ trách Chuyên môn & Thi đua',
      'Chủ nhiệm lớp': '',
      'Số điện thoại': '0912345679',
      'Email': 'maitt@thptchuvanan.edu.vn'
    },
    {
      'STT': 3,
      'Mã CBVC': 'GV004',
      'Họ và tên': 'Nguyễn Thị Thu Huyền',
      'Tổ chuyên môn': 'Tổ Toán - Tin',
      'Chức vụ': 'Giáo viên',
      'Môn giảng dạy': 'Toán',
      'Nhiệm vụ kiêm nhiệm': 'Bồi dưỡng HSG',
      'Chủ nhiệm lớp': '12A1',
      'Số điện thoại': '0912345681',
      'Email': 'huyenntt@thptchuvanan.edu.vn'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 25 },
    { wch: 22 },
    { wch: 30 },
    { wch: 15 },
    { wch: 30 },
    { wch: 15 },
    { wch: 15 },
    { wch: 28 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Danh_Sach_CBVC');
  XLSX.writeFile(wb, 'Mau_Danh_Sach_CBVC_THPT_Chu_Van_An.xlsx');
}

/** Xuất danh sách tài khoản CBVC (chỉ dùng cho BGH) */
export async function exportStaffAccountsToExcel(users: UserProfile[]): Promise<void> {
  const XLSX = await getXlsx();
  const accountRows = users.map((user, index) => ({
    'STT': index + 1,
    'Mã CBVC': user.code,
    'Họ và tên': user.name,
    'Email': user.email,
    'Tổ chuyên môn': user.departmentName,
    'Chức vụ': user.position,
    'Mật khẩu mặc định': DEFAULT_PASSWORD,
  }));
  const worksheet = XLSX.utils.json_to_sheet(accountRows);
  worksheet['!cols'] = [
    { wch: 6 }, { wch: 12 }, { wch: 26 }, { wch: 32 },
    { wch: 24 }, { wch: 30 }, { wch: 22 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tai_khoan_CBVC');
  XLSX.writeFile(workbook, 'Danh_sach_tai_khoan_CBVC_THPT_Chu_Van_An.xlsx');
}

/** Đọc và trích xuất danh sách giáo viên từ file Excel tải lên */
export async function parseStaffFromExcel(
  fileBinaryStr: string | ArrayBuffer,
  departments: Department[],
  existingCount: number
): Promise<UserProfile[]> {
  const XLSX = await getXlsx();
  const wb = XLSX.read(fileBinaryStr, { type: 'binary' });
  const wsname = wb.SheetNames[0];
  const ws = wb.Sheets[wsname];
  const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

  if (!data || data.length <= 1) {
    throw new Error('File Excel không có dữ liệu hoặc định dạng rỗng.');
  }

  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(5, data.length); r++) {
    const rowStr = JSON.stringify(data[r]).toLowerCase();
    if (rowStr.includes('tên') || rowStr.includes('mã') || rowStr.includes('chức vụ')) {
      headerRowIdx = r;
      break;
    }
  }

  const headers = (data[headerRowIdx] || []).map(h => String(h || '').trim().toLowerCase());
  const nameIdx = headers.findIndex(h => h.includes('tên') || h.includes('họ'));
  const codeIdx = headers.findIndex(h => h.includes('mã'));
  const deptIdx = headers.findIndex(h => h.includes('tổ') || h.includes('phòng') || h.includes('khoa'));
  const posIdx = headers.findIndex(h => h.includes('chức') || h.includes('vị trí'));
  const subjIdx = headers.findIndex((header, index) => index !== deptIdx && (header === 'môn' || header.startsWith('môn ')));
  const jobIdx = headers.findIndex(h => h.includes('kiêm'));
  const classIdx = headers.findIndex(h => h.includes('lớp') || h.includes('chủ nhiệm'));
  const phoneIdx = headers.findIndex(h => h.includes('thoại') || h.includes('sđt') || h.includes('phone'));
  const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('thư'));

  const parsedStaffList: UserProfile[] = [];

  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const rawName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
    if (!rawName) continue;

    const rawCode = codeIdx !== -1 && row[codeIdx]
      ? String(row[codeIdx]).trim().toUpperCase()
      : `GV${String(existingCount + parsedStaffList.length + 1).padStart(3, '0')}`;

    const rawDeptName = deptIdx !== -1 ? String(row[deptIdx] || '').trim() : '';
    const departmentKey = rawDeptName.toLowerCase().replace(/^tổ\s+/, '').trim();
    const matchedDept = departments.find(d => d.name.toLowerCase().replace(/^tổ\s+/, '').trim() === departmentKey);
    if (!matchedDept) throw new Error(`Dòng ${i + 1}: không xác định được tổ chuyên môn “${rawDeptName}”.`);

    const rawPos = posIdx !== -1 ? String(row[posIdx] || 'Giáo viên').trim() : 'Giáo viên';
    const rawSubj = subjIdx !== -1 ? String(row[subjIdx] || '').trim() : undefined;
    const rawJob = jobIdx !== -1 ? String(row[jobIdx] || '').trim() : undefined;
    const rawClass = classIdx !== -1 ? String(row[classIdx] || '').trim() : '';
    const rawPhone = phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : undefined;
    const rawEmail = emailIdx !== -1 ? String(row[emailIdx] || '').trim() : `${rawCode.toLowerCase()}@thpt.edu.vn`;

    let role: 'bgh' | 'ttcm' | 'gv' = 'gv';
    const posLower = rawPos.toLowerCase();
    const deptLower = rawDeptName.toLowerCase();
    if (posLower.includes('hiệu trưởng') || deptLower.includes('ban giám hiệu')) {
      role = 'bgh';
    } else if (posLower.includes('tổ trưởng') || posLower.includes('ttcm') || posLower.includes('trưởng bộ môn')) {
      role = 'ttcm';
    }

    const newStaff: UserProfile = {
      id: `u-${encodeURIComponent(rawCode.toLowerCase())}`,
      name: rawName,
      code: rawCode,
      email: rawEmail,
      role,
      departmentId: matchedDept.id,
      departmentName: matchedDept.name,
      position: rawPos,
      subject: rawSubj,
      concurrentJob: rawJob,
      isHomeroomTeacher: Boolean(rawClass),
      homeroomClass: rawClass || undefined,
      phone: rawPhone,
      status: 'active',
    };

    parsedStaffList.push(newStaff);
  }

  return parsedStaffList;
}
