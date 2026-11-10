import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  CalendarCheck2,
  BarChart3,
  Award,
  CheckCircle2,
  Printer,
  FilePieChart,
  Building2,
  FileText
} from 'lucide-react';
import { MonthlyScoreRecord, Department, UserProfile } from '../types';
import { exportMonthlyScoreToExcel } from '../utils/excelExport';
import { getReportDepartmentId, scopeReportScores } from '../utils/reportScope';
import {
  SEMESTER_1_MONTHS,
  SEMESTER_2_MONTHS,
  PeriodSelection,
  getSemesterName,
  formatMonthName,
  getPeriodShortTitle,
  getPeriodBaseScore,
  aggregateScoresForPeriod,
  compareEmulationScores,
  classifyEmulationRecord
} from '../utils/academicYear';
import { ExportWordModal } from './ExportWordModal';

interface ReportsViewProps {
  scores: MonthlyScoreRecord[];
  currentMonth: number;
  departments: Department[];
  currentUser: UserProfile;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  scores,
  currentMonth,
  departments,
  currentUser,
}) => {
  const [reportType, setReportType] = useState<'monthly' | 'semester1' | 'semester2' | 'annual'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [isExportWordOpen, setIsExportWordOpen] = useState(false);
  const reportDepartmentId = getReportDepartmentId(currentUser);

  // Derive PeriodSelection
  const activePeriod: PeriodSelection = useMemo(() => {
    if (reportType === 'monthly') return selectedMonth;
    if (reportType === 'semester1') return 'hk1';
    if (reportType === 'semester2') return 'hk2';
    return 'annual';
  }, [reportType, selectedMonth]);

  const aggregatedStaffRecords = useMemo(() => aggregateScoresForPeriod(
    scopeReportScores(scores, reportDepartmentId), activePeriod
  ).sort(compareEmulationScores), [scores, activePeriod, reportDepartmentId]);

  const totalEvaluated = aggregatedStaffRecords.length;
  const grandTotalScore = aggregatedStaffRecords.reduce(
    (acc, curr) => acc + (curr.bghApprovedScore ?? curr.totalScore),
    0
  );
  const avgScore = totalEvaluated > 0 ? (grandTotalScore / totalEvaluated).toFixed(1) : '230.0';
  const periodBaseScore = getPeriodBaseScore(activePeriod);
  const top20Quota = Math.max(1, Math.round(totalEvaluated * 0.2));
  const excellentCount = aggregatedStaffRecords.filter((rec, idx) => {
    const score = rec.bghApprovedScore ?? rec.totalScore;
    return idx + 1 <= top20Quota && score >= periodBaseScore;
  }).length;

  const handleExport = () => {
    if (reportDepartmentId === null) return;
    void exportMonthlyScoreToExcel(aggregatedStaffRecords, activePeriod);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200 text-stone-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold text-amber-400/90 uppercase tracking-widest mb-1 flex items-center gap-2">
            <FilePieChart className="w-3.5 h-3.5 text-amber-400" />
            <span>TỔNG HỢP & KẾT XUẤT HỒ SƠ</span>
            <span>·</span>
            <span>NĂM HỌC 2026–2027</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
            <span>Báo Cáo Tổng Hợp Điểm Thi Đua</span>
          </h2>
          <p className="text-xs sm:text-sm text-emerald-200/80 mt-1 max-w-2xl">
            Xuất dữ liệu định kỳ hàng tháng, theo học kỳ hoặc cả năm học sang định dạng Excel (.xlsx) chuẩn mẫu biểu của Bộ & Sở GD&ĐT.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsExportWordOpen(true)}
            disabled={reportDepartmentId === null}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-[#031713] text-xs font-black shadow-md transition-all cursor-pointer"
            title="Xuất bảng điểm ra định dạng Word chính quy kèm con dấu & chữ ký Ban Giám Hiệu"
          >
            <Printer className="w-4 h-4" />
            <span>Xuất Word {getPeriodShortTitle(activePeriod)}</span>
          </button>
          <button
            onClick={handleExport}
            disabled={reportDepartmentId === null}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-950 text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Xuất file Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Report Period Selector */}
      <div className="bg-[#05211b] p-4 rounded-2xl border border-[#0e4438] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-200">Kỳ báo cáo:</span>
          <div className="flex flex-wrap items-center gap-1.5 bg-[#031713] p-1 rounded-xl border border-[#0e4438]">
            <button
              onClick={() => setReportType('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                reportType === 'monthly'
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              Hàng tháng
            </button>
            <button
              onClick={() => setReportType('semester1')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                reportType === 'semester1'
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              Học kỳ I
            </button>
            <button
              onClick={() => setReportType('semester2')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                reportType === 'semester2'
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              Học kỳ II
            </button>
            <button
              onClick={() => setReportType('annual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                reportType === 'annual'
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              Cả năm học (9 tháng)
            </button>
          </div>
        </div>

        {reportType === 'monthly' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-200">Chọn tháng:</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-[#031713] border border-[#0e4438] rounded-xl px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
            >
              <optgroup label="Học kỳ I" className="bg-[#05211b] text-white">
                {SEMESTER_1_MONTHS.map(m => (
                  <option key={m} value={m}>
                    {formatMonthName(m)} (HK I)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Học kỳ II" className="bg-[#05211b] text-white">
                {SEMESTER_2_MONTHS.map(m => (
                  <option key={m} value={m}>
                    {formatMonthName(m)} (HK II)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        )}
      </div>

      {/* Key Metric Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#05211b] p-4 sm:p-5 rounded-2xl border border-[#0e4438] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
            <span>Tổng số CBVC đánh giá</span>
            <BarChart3 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">
            {totalEvaluated} <span className="text-xs font-normal text-stone-400">cán bộ giáo viên</span>
          </div>
        </div>

        <div className="bg-[#05211b] p-4 sm:p-5 rounded-2xl border border-[#0e4438] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
            <span>Điểm trung bình kỳ này</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-300 font-mono">
            {avgScore} <span className="text-xs font-normal text-stone-400">điểm / người</span>
          </div>
        </div>

        <div className="bg-[#05211b] p-4 sm:p-5 rounded-2xl border border-[#0e4438] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
            <span>Chỉ tiêu HT Xuất sắc (20%)</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-300 font-mono">
            {excellentCount}/{top20Quota} <span className="text-xs font-normal text-stone-400">cán bộ ({totalEvaluated > 0 ? Math.round((excellentCount / totalEvaluated) * 100) : 0}%)</span>
          </div>
        </div>

        <div className="bg-[#05211b] p-4 sm:p-5 rounded-2xl border border-[#0e4438] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
            <span>Tổ chuyên môn tham gia</span>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-300 font-mono">
            10 <span className="text-xs font-normal text-stone-400">tổ chuyên môn</span>
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-[#05211b] rounded-2xl border border-[#0e4438] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#072a23] border-b border-[#0e4438] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-bold text-white uppercase tracking-wider">
            DANH SÁCH BẢNG ĐIỂM TỔNG HỢP ({aggregatedStaffRecords.length} DÒNG)
          </div>
          <div className="text-xs text-amber-300/90 font-medium">
            * Khống chế chỉ tiêu Hoàn thành Xuất sắc tối đa 20% (Nghị định 90/2020/NĐ-CP)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#031713] text-emerald-200 font-bold uppercase tracking-wider text-[11px] border-b border-[#0e4438]">
                <th className="py-3 px-3 w-12 text-center border-r border-[#0e4438]">STT</th>
                <th className="py-3 px-4 min-w-[180px] border-r border-[#0e4438]">Họ và tên</th>
                <th className="py-3 px-4 border-r border-[#0e4438]">Tổ chuyên môn</th>
                <th className="py-3 px-3 text-center w-28 border-r border-[#0e4438]">Điểm nền</th>
                <th className="py-3 px-3 text-center w-28 border-r border-[#0e4438]">Thưởng (+đ)</th>
                <th className="py-3 px-3 text-center w-28 border-r border-[#0e4438]">Trừ (-đ)</th>
                <th className="py-3 px-3 text-center w-32 border-r border-[#0e4438]">Tổng điểm</th>
                <th className="py-3 px-4 min-w-[180px]">Xếp loại thi đua</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0e4438]">
              {aggregatedStaffRecords.map((rec, index) => {
                const finalScore = rec.bghApprovedScore ?? rec.totalScore;
                const rank = index + 1;
                const classification = classifyEmulationRecord(
                  finalScore,
                  rank,
                  totalEvaluated,
                  periodBaseScore
                );

                return (
                  <tr key={rec.id} className="hover:bg-[#072a23]/80 transition-colors">
                    <td className="py-3 px-3 text-center font-bold text-stone-300 border-r border-[#0e4438]">
                      {rank}
                    </td>
                    <td className="py-3 px-4 border-r border-[#0e4438]">
                      <div className="font-bold text-white">{rec.staffName}</div>
                      <div className="text-[11px] text-stone-400">{rec.staffCode} · {rec.position}</div>
                    </td>
                    <td className="py-3 px-4 border-r border-[#0e4438] text-stone-300">
                      {rec.departmentName}
                    </td>
                    <td className="py-3 px-3 text-center border-r border-[#0e4438] font-mono text-stone-300">
                      {rec.baseScore}
                    </td>
                    <td className="py-3 px-3 text-center border-r border-[#0e4438] font-mono text-emerald-400 font-bold">
                      +{rec.totalBonus}
                    </td>
                    <td className="py-3 px-3 text-center border-r border-[#0e4438] font-mono text-rose-400 font-bold">
                      -{rec.totalPenalty}
                    </td>
                    <td className="py-3 px-3 text-center border-r border-[#0e4438] font-mono text-base font-extrabold text-amber-300">
                      {finalScore}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10.5px] font-bold border ${classification.badgeClass}`}>
                        {classification.shortLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Word Export Modal */}
      <ExportWordModal
        isOpen={isExportWordOpen}
        onClose={() => setIsExportWordOpen(false)}
        scores={aggregatedStaffRecords}
        period={activePeriod}
        departments={departments}
        currentUser={currentUser}
      />
    </div>
  );
};
