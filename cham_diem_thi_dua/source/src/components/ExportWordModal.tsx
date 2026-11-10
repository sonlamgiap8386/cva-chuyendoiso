import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Download,
  FileText,
  CheckCircle2,
  Building2,
  Sliders,
  ShieldCheck,
  Award,
  Sparkles,
  Calendar,
  Info
} from 'lucide-react';
import { getReportDepartmentId, scopeReportScores } from '../utils/reportScope';
import { CURRENT_SCHOOL_YEAR } from '../data/constants';
import { MonthlyScoreRecord, UserProfile, Department } from '../types';
import {
  PeriodSelection,
  getPeriodShortTitle,
  getPeriodBaseScore,
  compareEmulationScores,
  classifyEmulationRecord
} from '../utils/academicYear';

const councilChair = 'Trần Văn Thi';
const councilSecretary = 'Nguyễn Thị Diệu Thiên';
const councilAttendees = [
  { name: councilChair, role: 'Hiệu trưởng, Chủ tịch Hội đồng Thi đua - Khen thưởng' },
  { name: 'Nguyễn Đăng Tấn', role: 'Phó Hiệu trưởng, Phó Chủ tịch Hội đồng Thi đua - Khen thưởng' },
  { name: 'Đặng Vũ Hải', role: 'Phó Hiệu trưởng, Phó Chủ tịch Thường trực Hội đồng Thi đua - Khen thưởng' },
  { name: councilSecretary, role: 'Thư ký Hội đồng' },
];

interface ExportWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  scores: MonthlyScoreRecord[];
  period: PeriodSelection;
  departments: Department[];
  currentUser: UserProfile;
}

export const ExportWordModal: React.FC<ExportWordModalProps> = ({
  isOpen,
  onClose,
  scores,
  period,
  departments,
  currentUser,
}) => {
  // Configuration options
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const isDepartmentLeader = currentUser.role === 'ttcm';
  const reportDepartmentId = getReportDepartmentId(currentUser);
  const effectiveDeptId = reportDepartmentId === undefined ? selectedDeptId : reportDepartmentId;
  const [fontSizeOption, setFontSizeOption] = useState<'normal' | 'compact'>('normal');
  const isMonthlyMinutes = typeof period === 'number';
  const minutesTitle = isDepartmentLeader
    ? 'BIÊN BẢN HỌP TỔ CHUYÊN MÔN'
    : 'BIÊN BẢN HỌP HỘI ĐỒNG THI ĐUA KHEN THƯỞNG';
  const minutesCode = isDepartmentLeader ? 'BB-TCM' : 'BB-HĐTĐKT';

  // Today's date in official Vietnamese format
  const today = useMemo(() => {
    const d = new Date();
    return {
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    };
  }, []);

  const signDate = `Bắc Ninh, ngày ${String(today.day).padStart(2, '0')} tháng ${String(today.month).padStart(2, '0')} năm ${today.year}`;

  const periodBaseScore = getPeriodBaseScore(period);
  const periodShortTitle = getPeriodShortTitle(period);

  // Filter scores by selected department
  const filteredScores = useMemo(() => {
    const allowedScores = currentUser.role === 'gv' ? scores.filter(score => score.staffId === currentUser.id) : scores;
    const list = scopeReportScores(allowedScores, effectiveDeptId === 'all' ? undefined : effectiveDeptId);
    // Sort by final score descending
    return [...list].sort(compareEmulationScores);
  }, [scores, effectiveDeptId, currentUser.id, currentUser.role]);

  // Overall statistics for executive summary
  const stats = useMemo(() => {
    const totalStaff = filteredScores.length;
    const totalApproved = filteredScores.filter(s => s.status === 'approved' || s.status === 'locked').length;
    const totalScore = filteredScores.reduce((acc, curr) => acc + (curr.bghApprovedScore ?? curr.totalScore), 0);
    const avgScore = totalStaff > 0 ? (totalScore / totalStaff).toFixed(1) : String(periodBaseScore);

    // Official 20% quota for Hoàn thành Xuất sắc (Nghị định 90/2020/NĐ-CP)
    const top20Quota = Math.max(1, Math.round(totalStaff * 0.2));

    let excellentCount = 0;
    let goodCount = 0;
    let passCount = 0;

    filteredScores.forEach((rec, idx) => {
      const rank = idx + 1;
      const finalScore = rec.bghApprovedScore ?? rec.totalScore;
      const classification = classifyEmulationRecord(finalScore, rank, totalStaff, periodBaseScore);

      if (classification.type === 'xuat_sac') {
        excellentCount++;
      } else if (classification.type === 'tot') {
        goodCount++;
      } else {
        passCount++;
      }
    });

    const totalBonus = filteredScores.reduce((acc, curr) => acc + curr.totalBonus, 0);
    const totalPenalty = filteredScores.reduce((acc, curr) => acc + curr.totalPenalty, 0);

    return {
      totalStaff,
      totalApproved,
      avgScore,
      top20Quota,
      excellentCount,
      goodCount,
      passCount,
      totalBonus,
      totalPenalty,
    };
  }, [filteredScores, periodBaseScore]);

  // Selected department object
  const departmentName = departments.find(d => d.id === effectiveDeptId)?.name
    || (reportDepartmentId ? currentUser.departmentName || reportDepartmentId : '');

  const paperRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const handleDownloadWord = async () => {
    const paper = paperRef.current;
    if (!paper || exporting || reportDepartmentId === null) return;
    setExporting(true);
    setExportError('');
    try {
      const { downloadReportWord } = await import('../utils/reportWord');
      const documentKind = isMonthlyMinutes ? 'Bien_Ban_Thi_Dua' : 'Bang_Diem_Thi_Dua';
      const filename = `${documentKind}_${periodShortTitle}_THPT_Chu_Van_An.docx`;
      await downloadReportWord(paper, filename, fontSizeOption === 'compact');
    } catch {
      setExportError('Không tạo được tệp Word. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="word-export-modal-backdrop"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-start justify-center p-2 sm:p-4 md:p-6"
    >
      <div
        id="word-export-modal-panel"
        className="relative w-full max-w-6xl bg-[#031713] border border-[#0e4438] rounded-2xl shadow-2xl flex flex-col my-auto max-h-[96vh] overflow-hidden"
      >
        {/* Modal Header Toolbar (Hidden in print) */}
        <div className="no-print bg-[#05211b] border-b border-[#0e4438] px-4 py-3 sm:px-6 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/40 flex items-center justify-center font-bold shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white font-serif flex items-center gap-2">
                <span>{isMonthlyMinutes ? `Xuất ${minutesTitle.toLocaleLowerCase('vi-VN')}` : 'Xuất Bảng Điểm Thi Đua Ra Định Dạng Word'}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                  {periodShortTitle}
                </span>
              </h2>
              <p className="text-xs text-emerald-300/70">
                Biểu mẫu chính quy chuẩn thể thức văn bản quản lý giáo dục · Hỗ trợ ký tên & con dấu Ban Giám Hiệu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadWord}
              disabled={exporting || reportDepartmentId === null}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-[#031713] text-xs font-black shadow-md transition-all cursor-pointer"
              title="Tải tệp Word khổ A4 ngang"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Đang tạo Word…' : 'Tải Word A4'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#041d17] hover:bg-rose-950/40 text-emerald-400 hover:text-rose-300 border border-[#0e4438] transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Configuration Subheader (Hidden in print) */}
        <div className="no-print bg-[#041d17] border-b border-[#0e4438] px-4 py-2.5 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Dept Filter */}
          <div className="flex items-center gap-2">
            <span className="text-emerald-300/80 font-medium">Phạm vi xuất:</span>
            {reportDepartmentId === undefined ? <select
              value={selectedDeptId}
              onChange={e => setSelectedDeptId(e.target.value)}
              className="bg-[#062921] border border-[#0e4438] text-white rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">Toàn trường (Tất cả {departments.length} Tổ chuyên môn)</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select> : <span className="font-semibold text-white">
              {departmentName || 'Tài khoản chưa được gán tổ quản lý'}
            </span>}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Font size toggle */}
            <div className="flex items-center gap-1 bg-[#062921] p-0.5 rounded-lg border border-[#0e4438]">
              <button
                type="button"
                onClick={() => setFontSizeOption('normal')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  fontSizeOption === 'normal'
                    ? 'bg-amber-400 text-[#031713]'
                    : 'text-emerald-300 hover:text-white'
                }`}
              >
                Cỡ chữ chuẩn
              </button>
              <button
                type="button"
                onClick={() => setFontSizeOption('compact')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  fontSizeOption === 'compact'
                    ? 'bg-amber-400 text-[#031713]'
                    : 'text-emerald-300 hover:text-white'
                }`}
              >
                Cỡ chữ gọn
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body: Document Preview Scroll Container */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
          {/* Authentic A4 Document Paper */}
          <div
            id="word-document-paper"
            ref={paperRef}
            data-report-minutes={isMonthlyMinutes ? '' : undefined}
            className={`mx-auto w-full max-w-[1060px] bg-white text-black shadow-2xl p-6 sm:p-10 font-serif ${
              fontSizeOption === 'compact' ? 'text-[11px]' : 'text-[12px]'
            }`}
            style={{
              fontFamily: '"Times New Roman", Times, "Noto Serif", Georgia, serif',
              backgroundColor: '#ffffff',
              color: '#000000',
              lineHeight: 1.4,
            }}
          >
            {/* Header: Agency & National Emblem */}
            <div className="grid grid-cols-2 items-start gap-4 pb-2">
              {/* Left Column: School & Dept */}
              <div data-report-agency className="text-center">
                <div className="text-[12px] uppercase font-bold tracking-tight">
                  SỞ GIÁO DỤC VÀ ĐÀO TẠO TP BẮC NINH
                </div>
                <div className="text-[13px] uppercase font-extrabold tracking-normal mt-0.5">
                  TRƯỜNG THPT CHU VĂN AN
                </div>
                <div className="w-32 h-[1px] bg-black mx-auto mt-1.5 mb-1"></div>
                <div className="text-[11px]">
                  {isMonthlyMinutes ? `Số: ……/${minutesCode}` : 'Số: ...... /BC-CVA'}
                </div>
              </div>

              {/* Right Column: National Motto */}
              <div data-report-agency className="text-center">
                <div className="text-[12px] uppercase font-extrabold tracking-normal">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </div>
                <div className="text-[13px] font-bold tracking-tight">
                  Độc lập - Tự do - Hạnh phúc
                </div>
                <div className="w-40 h-[1.5px] bg-black mx-auto mt-1 mb-1.5"></div>
                <div className="text-[11px] italic">
                  {signDate}
                </div>
              </div>
            </div>

            {/* Document Title */}
            <div data-report-title className="text-center my-6">
              <h1 className="text-[17px] sm:text-[19px] font-extrabold uppercase tracking-wide leading-snug">
                {isMonthlyMinutes
                  ? minutesTitle
                  : 'BẢNG TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ, XẾP LOẠI THI ĐUA CÁN BỘ, GIÁO VIÊN'}
              </h1>
              <div className="text-[13px] sm:text-[14px] font-bold uppercase mt-1">
                VỀ VIỆC ĐÁNH GIÁ, XẾP LOẠI THI ĐUA CBVC {periodShortTitle.toLocaleUpperCase('vi-VN')}
              </div>
              <div className="text-[11px] italic mt-1 text-black/80">
                Năm học {CURRENT_SCHOOL_YEAR.replace('-', ' - ')}
              </div>
              {departmentName && (
                <div className="inline-block mt-2 px-3 py-0.5 rounded border border-black font-bold text-[11px] uppercase bg-slate-100">
                  Phạm vi: {departmentName} ({filteredScores.length} cán bộ giáo viên)
                </div>
              )}
            </div>

            <div className="space-y-2 mb-4 leading-relaxed text-justify">
              <p data-report-intro>
                Vào hồi …… giờ …… phút, ngày ……/……/……, tại ……………………………,{' '}
                {isDepartmentLeader
                  ? 'Tổ chuyên môn họp để tổng hợp, đánh giá và công bố kết quả thi đua các thành viên trong tổ'
                  : 'Hội đồng Thi đua - Khen thưởng Trường THPT Chu Văn An họp để tổng hợp, đánh giá và công bố kết quả thi đua cán bộ, giáo viên, nhân viên'}{' '}
                {periodShortTitle.toLocaleLowerCase('vi-VN')}.
              </p>
              <h2 data-report-intro className="font-bold">I. THÀNH PHẦN THAM DỰ</h2>
              <ul className="space-y-1 pl-3">
                {isDepartmentLeader ? (
                  <>
                    <li data-report-intro>• Đ/c …………………………… – Tổ trưởng chuyên môn.</li>
                    <li data-report-intro>• Đ/c …………………………… – Thư ký.</li>
                    <li data-report-intro>• Cùng các thành viên trong tổ tham dự.</li>
                  </>
                ) : (
                  <>
                    {councilAttendees.map(({ name, role }) => (
                      <li key={name} data-report-intro>• Đ/c <strong>{name}</strong> – {role}.</li>
                    ))}
                    <li data-report-intro>• Các tổ trưởng chuyên môn và đại diện các bộ phận tham dự: ……………………………</li>
                  </>
                )}
              </ul>
              <h2 data-report-intro className="font-bold">II. TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ THI ĐUA</h2>
              <p data-report-intro>
                Căn cứ Quy chế thi đua của Trường THPT Chu Văn An và mức điểm chuẩn <strong>{periodBaseScore} điểm</strong>,
                {isDepartmentLeader ? 'tổ chuyên môn' : 'Hội đồng'} đã thẩm tra hồ sơ, đối chiếu minh chứng và thống nhất kết quả đánh giá như sau:
              </p>
            </div>

            {/* Score Sheet Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-black text-black">
                <thead>
                  <tr className="bg-slate-100 text-center font-bold text-[11px]">
                    <th className="border border-black p-1.5 w-8">STT</th>
                    <th className="border border-black p-1.5 w-16">Mã CB</th>
                    <th className="border border-black p-1.5 min-w-[140px] text-left">Họ và tên</th>
                    <th className="border border-black p-1.5 min-w-[100px] text-left">Tổ chuyên môn</th>
                    <th className="border border-black p-1.5 min-w-[90px] text-left">Chức vụ</th>
                    <th className="border border-black p-1.5 w-14">Điểm chuẩn</th>
                    <th className="border border-black p-1.5 w-12 text-emerald-800">Cộng (+)</th>
                    <th className="border border-black p-1.5 w-12 text-rose-800">Trừ (-)</th>
                    <th className="border border-black p-1.5 w-14">Tự chấm</th>
                    <th className="border border-black p-1.5 w-16 bg-amber-50">BGH duyệt</th>
                    <th className="border border-black p-1.5 min-w-[125px]">Xếp loại thi đua</th>
                    <th className="border border-black p-1.5 min-w-[110px] text-left">Ghi chú / Minh chứng</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScores.map((rec, index) => {
                    const finalScore = rec.bghApprovedScore ?? rec.totalScore;
                    const rank = index + 1;
                    const classification = classifyEmulationRecord(
                      finalScore,
                      rank,
                      filteredScores.length,
                      periodBaseScore
                    );

                    return (
                      <tr
                        key={rec.id}
                        className={index % 2 === 1 ? 'bg-slate-50' : 'bg-white'}
                      >
                        <td className="border border-black p-1 text-center font-mono font-medium">
                          {rank}
                        </td>
                        <td className="border border-black p-1 text-center font-mono text-[10px]">
                          {rec.staffCode}
                        </td>
                        <td className="border border-black p-1 font-bold">
                          {rec.staffName}
                        </td>
                        <td className="border border-black p-1 text-[11px]">
                          {rec.departmentName}
                        </td>
                        <td className="border border-black p-1 text-[10px]">
                          {rec.position}
                        </td>
                        <td className="border border-black p-1 text-center font-mono text-[11px]">
                          {rec.baseScore}
                        </td>
                        <td className="border border-black p-1 text-center font-mono font-semibold text-emerald-800">
                          {rec.totalBonus > 0 ? `+${rec.totalBonus}` : '0'}
                        </td>
                        <td className="border border-black p-1 text-center font-mono font-semibold text-rose-800">
                          {rec.totalPenalty > 0 ? `-${rec.totalPenalty}` : '0'}
                        </td>
                        <td className="border border-black p-1 text-center font-mono">
                          {rec.totalScore}
                        </td>
                        <td className="border border-black p-1 text-center font-mono font-extrabold text-[12px] bg-amber-50/50">
                          {finalScore}
                        </td>
                        <td className="border border-black p-1 text-center text-[10.5px]">
                          {classification.isTop20 ? (
                            <span className="font-extrabold text-amber-900 bg-amber-100/80 px-1.5 py-0.5 rounded-xs border border-amber-400">
                              HT Xuất sắc (Top 20%)
                            </span>
                          ) : classification.type === 'tot' ? (
                            <span className="font-semibold text-emerald-900">
                              HT Tốt nhiệm vụ
                            </span>
                          ) : (
                            <span className="text-black/80">
                              {classification.label}
                            </span>
                          )}
                        </td>
                        <td className="border border-black p-1 text-[10px] italic">
                          {rec.bghNotes || (rec.bonusItems.length > 0 ? rec.bonusItems[0].title : '')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-200 font-bold border-t-2 border-black text-[11px]">
                    <td colSpan={5} className="border border-black p-1.5 text-center uppercase">
                      Tổng Cộng ({filteredScores.length} CBGV)
                    </td>
                    <td className="border border-black p-1.5 text-center font-mono">
                      {periodBaseScore}
                    </td>
                    <td className="border border-black p-1.5 text-center font-mono text-emerald-900">
                      +{stats.totalBonus}
                    </td>
                    <td className="border border-black p-1.5 text-center font-mono text-rose-900">
                      -{stats.totalPenalty}
                    </td>
                    <td className="border border-black p-1.5 text-center font-mono">
                      TB: {stats.avgScore}
                    </td>
                    <td className="border border-black p-1.5 text-center font-mono font-black text-[12px] bg-amber-100">
                      {stats.avgScore}đ
                    </td>
                    <td colSpan={2} className="border border-black p-1.5 text-center">
                      Xuất sắc: {stats.excellentCount}/{stats.top20Quota} (20%) · Tốt: {stats.goodCount} · HT: {stats.passCount}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div data-report-signatures className="mt-5 grid grid-cols-2 gap-4 text-center text-[12px] break-inside-avoid">
              <div>
                <div>
                  <div className="font-bold">{isDepartmentLeader ? 'THƯ KÝ' : 'THƯ KÝ HỘI ĐỒNG'}</div>
                  <div className="italic">(Ký và ghi rõ họ tên)</div>
                </div>
                <div className="pt-16 font-bold">{isDepartmentLeader ? '..............................' : councilSecretary}</div>
              </div>
              <div>
                <div>
                  <div className="font-bold">{isDepartmentLeader ? 'TỔ TRƯỞNG' : 'HIỆU TRƯỞNG - CHỦ TỊCH HỘI ĐỒNG'}</div>
                  <div className="italic">{isDepartmentLeader ? '(Ký và ghi rõ họ tên)' : '(Ký tên, đóng dấu)'}</div>
                </div>
                <div className="pt-16 font-bold">{isDepartmentLeader ? '..............................' : councilChair}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions Footer (Hidden in print) */}
        <div className="no-print bg-[#05211b] border-t border-[#0e4438] px-4 py-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-emerald-300/80">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            {exportError ? <span role="alert">{exportError}</span> : <span>Tệp Word khổ A4 ngang có thể chỉnh sửa trước khi in.</span>}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#041d17] hover:bg-[#072a23] text-emerald-300 border border-[#0e4438] font-bold cursor-pointer transition-colors"
            >
              Đóng
            </button>
            <button
              onClick={handleDownloadWord}
              disabled={exporting || reportDepartmentId === null}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-[#031713] font-black shadow-md cursor-pointer transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Đang tạo Word…' : 'Tải Word A4'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
