import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCheck,
  Clock3,
  TrendingUp,
  TrendingDown,
  Award,
  ChevronRight,
  ShieldCheck,
  Users2,
  Building2,
  BarChart3,
  BarChart2,
  Table as TableIcon,
  ArrowUpRight,
  Trophy,
  Medal,
  CalendarCheck2,
  Sparkles,
  Flame,
  ArrowUpDown,
  SlidersHorizontal
} from 'lucide-react';
import { MonthlyScoreRecord, UserProfile } from '../types';
import { NavTab } from './Sidebar';
import {
  PeriodSelection,
  getPeriodLabel,
  getPeriodShortTitle,
  getPeriodBaseScore,
  aggregateScoresForPeriod,
  formatMonthName
} from '../utils/academicYear';
import { AcademicPeriodSelector } from './AcademicPeriodSelector';

interface DashboardOverviewProps {
  scores: MonthlyScoreRecord[];
  currentMonth: number;
  onChangeMonth: (m: number) => void;
  currentUser: UserProfile;
  onNavigate: (tab: NavTab) => void;
  onSelectRecordToScore: (record: MonthlyScoreRecord) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  scores,
  currentMonth,
  onChangeMonth,
  currentUser,
  onNavigate,
  onSelectRecordToScore,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection>(currentMonth);
  const [deptViewMode, setDeptViewMode] = useState<'chart' | 'table'>('chart');
  const [deptSortBy, setDeptSortBy] = useState<'avgDesc' | 'avgAsc' | 'progress' | 'bonus' | 'name'>('avgDesc');

  // Keep the dashboard selector in sync when the month is changed elsewhere.
  useEffect(() => {
    setSelectedPeriod(currentMonth);
  }, [currentMonth]);

  const handlePeriodChange = (period: PeriodSelection) => {
    setSelectedPeriod(period);
    if (typeof period === 'number') {
      onChangeMonth(period);
    }
  };

  const periodBaseScore = getPeriodBaseScore(selectedPeriod);
  const periodLabel = getPeriodLabel(selectedPeriod);
  const periodShortTitle = getPeriodShortTitle(selectedPeriod);
  const isAggregated = typeof selectedPeriod !== 'number';

  const currentPeriodScores = useMemo(() => {
    return aggregateScoresForPeriod(scores, selectedPeriod);
  }, [scores, selectedPeriod]);

  const totalStaff = currentPeriodScores.length;
  const evaluatedCount = currentPeriodScores.filter(s => s.status === 'approved' || s.status === 'locked').length;
  const pendingCount = currentPeriodScores.filter(s => s.status === 'submitted').length;
  const draftCount = currentPeriodScores.filter(s => s.status === 'draft').length;

  const completionPercent = totalStaff > 0 ? Math.round(((evaluatedCount + pendingCount) / totalStaff) * 100) : 0;
  const approvedPercent = totalStaff > 0 ? Math.round((evaluatedCount / totalStaff) * 100) : 0;

  // Average score
  const totalScoreSum = currentPeriodScores.reduce((acc, curr) => acc + (curr.bghApprovedScore ?? curr.totalScore), 0);
  const schoolAvgNum = totalStaff > 0 ? totalScoreSum / totalStaff : periodBaseScore;
  const avgScore = totalStaff > 0 ? schoolAvgNum.toFixed(1) : String(periodBaseScore);

  // Bonus & penalty sums
  const totalBonus = currentPeriodScores.reduce((acc, curr) => acc + curr.totalBonus, 0);
  const totalPenalty = currentPeriodScores.reduce((acc, curr) => acc + curr.totalPenalty, 0);

  // Official 20% quota for Hoàn thành Xuất sắc nhiệm vụ
  const top20Quota = Math.max(1, Math.round(totalStaff * 0.2));

  // Sorted by score descending for leaderboard preview
  const sortedScores = useMemo(() => {
    return [...currentPeriodScores].sort((a, b) => {
      const scoreA = a.bghApprovedScore ?? a.totalScore;
      const scoreB = b.bghApprovedScore ?? b.totalScore;
      return scoreB - scoreA;
    });
  }, [currentPeriodScores]);

  // Department Analytics Breakdown
  const rawDepartmentStats = useMemo(() => {
    const map = new Map<string, {
      deptId: string;
      deptName: string;
      teachersCount: number;
      totalScore: number;
      approvedCount: number;
      pendingCount: number;
      draftCount: number;
      topScore: number;
      minScore: number;
      totalBonus: number;
      totalPenalty: number;
    }>();

    currentPeriodScores.forEach(rec => {
      const existing = map.get(rec.departmentId) || {
        deptId: rec.departmentId,
        deptName: rec.departmentName,
        teachersCount: 0,
        totalScore: 0,
        approvedCount: 0,
        pendingCount: 0,
        draftCount: 0,
        topScore: 0,
        minScore: 99999,
        totalBonus: 0,
        totalPenalty: 0,
      };

      const finalScore = rec.bghApprovedScore ?? rec.totalScore;
      existing.teachersCount += 1;
      existing.totalScore += finalScore;
      existing.totalBonus += rec.totalBonus || 0;
      existing.totalPenalty += rec.totalPenalty || 0;
      if (rec.status === 'approved' || rec.status === 'locked') existing.approvedCount += 1;
      else if (rec.status === 'submitted') existing.pendingCount += 1;
      else existing.draftCount += 1;

      if (finalScore > existing.topScore) existing.topScore = finalScore;
      if (finalScore < existing.minScore) existing.minScore = finalScore;

      map.set(rec.departmentId, existing);
    });

    return Array.from(map.values()).map(dept => {
      const avgScoreNum = dept.teachersCount > 0 ? (dept.totalScore / dept.teachersCount) : periodBaseScore;
      const avgScoreStr = avgScoreNum.toFixed(1);
      const deltaFromSchool = avgScoreNum - schoolAvgNum;
      const deltaFromBase = avgScoreNum - periodBaseScore;
      const progressPercent = dept.teachersCount > 0 ? Math.round(((dept.approvedCount + dept.pendingCount) / dept.teachersCount) * 100) : 0;
      const approvedPercent = dept.teachersCount > 0 ? Math.round((dept.approvedCount / dept.teachersCount) * 100) : 0;

      // Rating classification for emulation
      let rating = 'Đạt chuẩn';
      let ratingColor = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
      if (deltaFromBase >= 4) {
        rating = 'Xuất sắc';
        ratingColor = 'text-amber-300 bg-amber-400/20 border-amber-400/50';
      } else if (deltaFromBase >= 0) {
        rating = 'Tốt';
        ratingColor = 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40';
      } else if (deltaFromBase < -5) {
        rating = 'Cần nỗ lực';
        ratingColor = 'text-rose-300 bg-rose-500/20 border-rose-500/40';
      }

      return {
        ...dept,
        minScore: dept.minScore === 99999 ? 0 : dept.minScore,
        avgScoreNum,
        avgScore: avgScoreStr,
        deltaFromSchool,
        deltaFromBase,
        progressPercent,
        approvedPercent,
        rating,
        ratingColor
      };
    });
  }, [currentPeriodScores, periodBaseScore, schoolAvgNum]);

  // Sorted department list based on user selection
  const departmentStats = useMemo(() => {
    const list = [...rawDepartmentStats];
    switch (deptSortBy) {
      case 'avgAsc':
        return list.sort((a, b) => a.avgScoreNum - b.avgScoreNum);
      case 'progress':
        return list.sort((a, b) => b.progressPercent - a.progressPercent || b.avgScoreNum - a.avgScoreNum);
      case 'bonus':
        return list.sort((a, b) => b.totalBonus - a.totalBonus || b.avgScoreNum - a.avgScoreNum);
      case 'name':
        return list.sort((a, b) => a.deptName.localeCompare(b.deptName, 'vi'));
      case 'avgDesc':
      default:
        return list.sort((a, b) => b.avgScoreNum - a.avgScoreNum);
    }
  }, [rawDepartmentStats, deptSortBy]);

  // Overall department metrics for BGH executive overview
  const bghInsights = useMemo(() => {
    if (rawDepartmentStats.length === 0) return null;
    const sortedByScore = [...rawDepartmentStats].sort((a, b) => b.avgScoreNum - a.avgScoreNum);
    const topDept = sortedByScore[0];
    const lowestDept = sortedByScore[sortedByScore.length - 1];
    const scoreDiff = (topDept.avgScoreNum - lowestDept.avgScoreNum).toFixed(1);

    const sortedByBonus = [...rawDepartmentStats].sort((a, b) => b.totalBonus - a.totalBonus);
    const topBonusDept = sortedByBonus[0];

    const deptsAboveBase = rawDepartmentStats.filter(d => d.deltaFromBase >= 0).length;
    const fullyApprovedDepts = rawDepartmentStats.filter(d => d.approvedCount === d.teachersCount && d.teachersCount > 0).length;

    const maxScore = Math.max(...rawDepartmentStats.map(d => d.avgScoreNum), periodBaseScore);
    const minScore = Math.min(...rawDepartmentStats.map(d => d.avgScoreNum), periodBaseScore);

    return {
      topDept,
      lowestDept,
      scoreDiff,
      topBonusDept,
      deptsAboveBase,
      totalDepts: rawDepartmentStats.length,
      fullyApprovedDepts,
      maxScore,
      minScore
    };
  }, [rawDepartmentStats, periodBaseScore]);

  // Maximum average score across departments for scale normalization
  const maxDeptAvg = useMemo(() => {
    if (departmentStats.length === 0) return periodBaseScore;
    return Math.max(...departmentStats.map(d => d.avgScoreNum), periodBaseScore * 1.03);
  }, [departmentStats, periodBaseScore]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Top Header & Month selector */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-2">
            <CalendarCheck2 className="w-3.5 h-3.5 text-amber-400" />
            <span>HỆ THỐNG THI ĐUA THỜI GIAN THỰC</span>
            <span className="text-emerald-600">·</span>
            <span className="text-emerald-300">{periodLabel.toUpperCase()} (2026–2027)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
            Bảng Điều Khiển Tổng Quan
          </h2>
          <p className="text-xs sm:text-sm text-emerald-200/80 mt-1 max-w-2xl leading-relaxed">
            {selectedPeriod === 'hk1'
              ? 'Tổng hợp điểm Học kỳ I = Tổng điểm các tháng 9, 10, 11, 12, 01 (Thang điểm chuẩn 1150đ).'
              : selectedPeriod === 'hk2'
              ? 'Tổng hợp điểm Học kỳ II = Tổng điểm các tháng 02, 03, 04, 05 (Thang điểm chuẩn 920đ).'
              : selectedPeriod === 'annual'
              ? 'Tổng hợp điểm Cả năm = Tổng điểm Học kỳ I + Học kỳ II (9 tháng: 2070đ).'
              : `Tổng hợp tiến độ chấm điểm, phân tích trung bình 10 tổ chuyên môn và tôn vinh giáo viên xuất sắc tháng ${selectedPeriod}.`}
          </p>
        </div>

        {/* Academic Period Selector Bar */}
        <AcademicPeriodSelector
          selectedPeriod={selectedPeriod}
          onChangePeriod={handlePeriodChange}
          showAnnual={true}
          className="dashboard-overview-periods"
        />
      </div>

      {/* Role Alert Banner if pending approvals */}
      {currentUser.role === 'bgh' && pendingCount > 0 && (
        <div className="bg-gradient-to-r from-[#093c31] to-[#0a483b] border border-amber-400/80 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-md shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-[#031713] font-bold flex items-center justify-center shrink-0 shadow-xs">
              <Clock3 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span>Có {pendingCount} hồ sơ thi đua đang chờ Ban Giám Hiệu phê duyệt {formatMonthName(currentMonth)}</span>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-400 text-[#031713] font-extrabold">Cần xử lý</span>
              </div>
              <div className="text-[11px] text-emerald-200/90 mt-0.5">
                Các tổ chuyên môn đã hoàn tất rà soát minh chứng và nộp bảng điểm lên Hội đồng Thi đua.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate('scoring')}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-[#031713] font-bold text-xs transition-all shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <span>Xem & Duyệt ngay</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Điểm trung bình */}
        <div className="bg-[#062921] rounded-2xl p-5 border border-[#0e4438] shadow-sm hover:border-amber-400 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between text-emerald-300/80 text-xs font-semibold">
            <span>Điểm trung bình toàn trường</span>
            <span className="p-2 rounded-xl bg-[#093c31] text-amber-400 border border-[#1b7360] group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-serif text-amber-300 font-mono">
              {avgScore}
            </span>
            <span className="text-xs font-semibold text-emerald-300/70">/ {periodBaseScore} chuẩn</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-300 font-medium flex items-center gap-1.5">
            <span className="font-bold text-emerald-400">+{totalBonus}đ thưởng</span>
            <span className="text-emerald-700">·</span>
            <span className="text-rose-400 font-bold">-{totalPenalty}đ phạt</span>
          </div>
        </div>

        {/* Card 2: Tiến độ đánh giá */}
        <div className="bg-[#062921] rounded-2xl p-5 border border-[#0e4438] shadow-sm hover:border-emerald-400 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between text-emerald-300/80 text-xs font-semibold">
            <span>Tiến độ rà soát chấm điểm</span>
            <span className="p-2 rounded-xl bg-[#093c31] text-emerald-300 border border-[#1b7360] group-hover:scale-110 transition-transform">
              <Clock3 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-serif text-white font-mono">
              {completionPercent}%
            </span>
            <span className="text-xs font-semibold text-emerald-300/70">
              ({evaluatedCount + pendingCount}/{totalStaff})
            </span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-300/80 flex items-center gap-1">
            <span className="font-bold text-amber-400">{pendingCount} hồ sơ</span>
            <span>chờ BGH chốt điểm</span>
          </div>
        </div>

        {/* Card 3: Đã chốt điểm BGH */}
        <div className="bg-[#062921] rounded-2xl p-5 border border-[#0e4438] shadow-sm hover:border-emerald-400 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between text-emerald-300/80 text-xs font-semibold">
            <span>Hồ sơ đã chốt điểm</span>
            <span className="p-2 rounded-xl bg-[#093c31] text-emerald-400 border border-[#1b7360] group-hover:scale-110 transition-transform">
              <CheckCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-serif text-white font-mono">
              {evaluatedCount}
            </span>
            <span className="text-xs font-semibold text-emerald-300/70">/ {totalStaff} CBVC</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-400 font-bold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Đạt {approvedPercent}% niêm phong</span>
          </div>
        </div>

        {/* Card 4: Tổng cán bộ giáo viên */}
        <div className="bg-[#062921] rounded-2xl p-5 border border-[#0e4438] shadow-sm hover:border-teal-400 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between text-emerald-300/80 text-xs font-semibold">
            <span>Tổng nhân sự theo dõi</span>
            <span className="p-2 rounded-xl bg-[#093c31] text-teal-300 border border-[#1b7360] group-hover:scale-110 transition-transform">
              <Users2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-serif text-white font-mono">
              {totalStaff}
            </span>
            <span className="text-xs font-semibold text-emerald-300/70">cán bộ giáo viên</span>
          </div>
          <div className="mt-2 text-[11px] text-teal-300 font-bold flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" />
            <span>10 Tổ chuyên môn & Văn phòng</span>
          </div>
        </div>
      </div>

      {/* BGH Executive Insights Callout Bar */}
      {bghInsights && (
        <div className="bg-[#05211b] border border-[#0e4438] rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#0e4438]/80">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-400/20 text-amber-400 border border-amber-400/40">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider font-serif">
                Nhận Định Thi Đua Dành Cho Ban Giám Hiệu ({periodShortTitle})
              </h3>
            </div>
            <span className="text-[11px] text-emerald-300/70 font-mono">
              Chuẩn kỳ: <span className="text-amber-300 font-bold">{periodBaseScore}đ</span> · TB Trường: <span className="text-white font-bold">{avgScore}đ</span>
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Insight 1: Dẫn đầu */}
            <div className="bg-[#041d17] p-3 rounded-xl border border-[#0e4438] hover:border-amber-400/50 transition-colors">
              <div className="text-[10px] text-emerald-300/70 font-medium flex items-center gap-1">
                <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Tổ Dẫn Đầu Toàn Trường</span>
              </div>
              <div className="mt-1 font-bold text-amber-300 text-sm truncate font-serif">
                {bghInsights.topDept.deptName}
              </div>
              <div className="mt-0.5 text-[11px] text-white font-mono flex items-center gap-1">
                <span>{bghInsights.topDept.avgScore}đ TB</span>
                <span className="text-emerald-400 text-[10px]">
                  (+{(bghInsights.topDept.avgScoreNum - schoolAvgNum).toFixed(1)}đ)
                </span>
              </div>
            </div>

            {/* Insight 2: Khoảng cách thi đua */}
            <div className="bg-[#041d17] p-3 rounded-xl border border-[#0e4438] hover:border-teal-400/50 transition-colors">
              <div className="text-[10px] text-emerald-300/70 font-medium flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-teal-400 shrink-0" />
                <span>Khoảng Cách Thi Đua (Δ)</span>
              </div>
              <div className="mt-1 font-bold text-teal-300 text-sm font-mono">
                {bghInsights.scoreDiff} điểm
              </div>
              <div className="mt-0.5 text-[10px] text-emerald-300/70 truncate">
                Từ {bghInsights.lowestDept.avgScore}đ đến {bghInsights.topDept.avgScore}đ
              </div>
            </div>

            {/* Insight 3: Phong trào thi đua */}
            <div className="bg-[#041d17] p-3 rounded-xl border border-[#0e4438] hover:border-emerald-400/50 transition-colors">
              <div className="text-[10px] text-emerald-300/70 font-medium flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Đầu Tàu Phong Trào</span>
              </div>
              <div className="mt-1 font-bold text-white text-sm truncate font-serif">
                {bghInsights.topBonusDept.deptName}
              </div>
              <div className="mt-0.5 text-[11px] text-emerald-400 font-mono font-bold">
                +{bghInsights.topBonusDept.totalBonus}đ điểm thưởng
              </div>
            </div>

            {/* Insight 4: Tỷ lệ đạt chuẩn */}
            <div className="bg-[#041d17] p-3 rounded-xl border border-[#0e4438] hover:border-emerald-400/50 transition-colors">
              <div className="text-[10px] text-emerald-300/70 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Tổ Đạt & Vượt Chuẩn</span>
              </div>
              <div className="mt-1 font-bold text-white text-sm font-mono">
                {bghInsights.deptsAboveBase}/{bghInsights.totalDepts} Tổ
              </div>
              <div className="mt-0.5 text-[10px] text-emerald-400 font-medium">
                {Math.round((bghInsights.deptsAboveBase / bghInsights.totalDepts) * 100)}% số tổ đạt &gt;= {periodBaseScore}đ
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Department Comparison & Leaderboard Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Department Emulation Comparison (8 cols) */}
        <div className="lg:col-span-8 bg-[#05211b] rounded-2xl border border-[#0e4438] p-5 shadow-sm space-y-4">
          {/* Header & Controls Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#0e4438]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#093c31] text-amber-400 border border-[#1b7360] flex items-center justify-center font-bold shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm sm:text-base font-serif">
                  Điểm Thi Đua 10 Tổ Chuyên Môn {periodShortTitle}
                </h3>
                <p className="text-[11px] text-emerald-300/70">
                  Biểu đồ trực quan & bảng số liệu so sánh điểm trung bình giữa các tổ
                </p>
              </div>
            </div>

            {/* Controls: Mode Toggle & Sort Dropdown */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              {/* View Mode Toggle */}
              <div className="p-0.5 bg-[#041d17] border border-[#0e4438] rounded-xl flex items-center">
                <button
                  onClick={() => setDeptViewMode('chart')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    deptViewMode === 'chart'
                      ? 'bg-amber-400 text-[#031713] shadow-xs'
                      : 'text-emerald-300/80 hover:text-white'
                  }`}
                  title="Xem biểu đồ so sánh điểm trực quan"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Biểu đồ</span>
                </button>
                <button
                  onClick={() => setDeptViewMode('table')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    deptViewMode === 'table'
                      ? 'bg-amber-400 text-[#031713] shadow-xs'
                      : 'text-emerald-300/80 hover:text-white'
                  }`}
                  title="Xem bảng thống kê số liệu chi tiết"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Bảng số liệu</span>
                </button>
              </div>

              {/* Sort Selector */}
              <select
                value={deptSortBy}
                onChange={e => setDeptSortBy(e.target.value as any)}
                className="bg-[#041d17] border border-[#0e4438] text-emerald-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-400 cursor-pointer font-medium"
              >
                <option value="avgDesc">Điểm TB: Cao → Thấp</option>
                <option value="avgAsc">Điểm TB: Thấp → Cao</option>
                <option value="progress">Tiến độ duyệt BGH</option>
                <option value="bonus">Điểm thưởng phong trào</option>
                <option value="name">Tên tổ A → Z</option>
              </select>

              <button
                onClick={() => onNavigate('scoring')}
                className="p-1.5 rounded-xl bg-[#072a23] hover:bg-[#0a382e] text-amber-400 border border-[#0e4438] text-xs font-bold transition-colors cursor-pointer hidden md:flex items-center gap-1"
                title="Đến Sổ Chấm Điểm Thi Đua Toàn Trường"
              >
                <span>Vào sổ</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scale Legend & Benchmark Indicator Bar */}
          <div className="bg-[#041d17] p-2.5 rounded-xl border border-[#0e4438] flex flex-wrap items-center justify-between gap-3 text-[11px]">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
                <span className="text-emerald-300/80">Điểm chuẩn kỳ:</span>
                <span className="font-bold text-amber-300 font-mono">{periodBaseScore}đ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shrink-0"></span>
                <span className="text-emerald-300/80">Trung bình trường:</span>
                <span className="font-bold text-white font-mono">{avgScore}đ</span>
              </div>
            </div>
            <div className="text-emerald-400/80 text-[10px] hidden sm:block">
              * Vạch kẻ đứt đoạn hiển thị mốc trung bình toàn trường ({avgScore}đ)
            </div>
          </div>

          {/* VIEW MODE 1: VISUAL BAR CHART */}
          {deptViewMode === 'chart' && (
            <div className="space-y-3 pt-1">
              {departmentStats.map((dept, index) => {
                const isTop1 = dept.avgScoreNum === (bghInsights?.topDept.avgScoreNum ?? -1);
                const isTop2 = index === 1 && deptSortBy === 'avgDesc';
                const isTop3 = index === 2 && deptSortBy === 'avgDesc';
                const deltaSchool = dept.deltaFromSchool;
                const isAboveSchool = deltaSchool >= 0;

                // Relative bar fill width percentage normalized to max dept score
                const barWidthPercent = Math.min(
                  100,
                  Math.max(20, Math.round((dept.avgScoreNum / maxDeptAvg) * 100))
                );

                // School average marker position on track
                const schoolAvgPositionPercent = Math.min(
                  98,
                  Math.max(10, Math.round((schoolAvgNum / maxDeptAvg) * 100))
                );

                return (
                  <div
                    key={dept.deptId}
                    className={`p-3 sm:p-3.5 rounded-xl border transition-all ${
                      isTop1
                        ? 'bg-gradient-to-r from-[#072a23] via-[#093c31] to-[#072a23] border-amber-400/60 shadow-sm'
                        : 'bg-[#072a23] border-[#0e4438] hover:border-amber-400/40 hover:bg-[#0a382e]'
                    }`}
                  >
                    {/* Top row: Rank, Name, Staff count, Avg Score & Delta */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Rank Badge */}
                        <span
                          className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center text-xs font-mono shrink-0 shadow-2xs ${
                            isTop1
                              ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-[#031713] font-black'
                              : isTop2
                              ? 'bg-slate-300 text-stone-900 font-bold'
                              : isTop3
                              ? 'bg-amber-800/50 text-amber-300 font-bold border border-amber-500/40'
                              : 'bg-[#041d17] text-emerald-300 border border-[#0e4438]'
                          }`}
                        >
                          {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : index + 1}
                        </span>

                        {/* Dept Name */}
                        <div className="truncate">
                          <div className="font-bold text-white text-xs sm:text-sm truncate flex items-center gap-1.5">
                            <span>{dept.deptName}</span>
                            <span className="text-[10px] text-emerald-300/70 font-normal px-1.5 py-0.2 rounded bg-[#041d17] border border-[#0e4438]">
                              {dept.teachersCount} GV
                            </span>
                            {isTop1 && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/50 hidden xs:inline">
                                Dẫn đầu
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Metrics: Avg Score + Delta Badge + Rating */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Rating Tag */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border hidden sm:inline ${dept.ratingColor}`}>
                          {dept.rating}
                        </span>

                        {/* Delta vs School Average */}
                        <span
                          className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                            isAboveSchool
                              ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/30'
                              : 'text-rose-300 bg-rose-500/10 border border-rose-500/30'
                          }`}
                          title={`Chênh lệch so với điểm trung bình toàn trường (${avgScore}đ)`}
                        >
                          {isAboveSchool ? `+${deltaSchool.toFixed(1)}đ` : `${deltaSchool.toFixed(1)}đ`}
                        </span>

                        {/* Average Score */}
                        <div className="text-right">
                          <span className="font-mono font-extrabold text-sm sm:text-base text-amber-300">
                            {dept.avgScore}
                          </span>
                          <span className="text-[10px] text-emerald-400/70 ml-0.5 font-normal">đ</span>
                        </div>
                      </div>
                    </div>

                    {/* Center: Comparative Visual Bar with School Benchmark Guideline */}
                    <div className="relative pt-1 pb-1">
                      <div className="w-full bg-[#041d17] h-4 rounded-full overflow-hidden border border-[#0e4438] relative flex items-center">
                        {/* School Average Reference Guideline */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-teal-300/80 z-10 shadow-xs"
                          style={{ left: `${schoolAvgPositionPercent}%` }}
                          title={`Vạch trung bình trường: ${avgScore}đ`}
                        />

                        {/* Animated Gradient Bar */}
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 ${
                            isTop1
                              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 shadow-sm shadow-amber-400/30'
                              : isTop2 || isTop3
                              ? 'bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400'
                              : isAboveSchool
                              ? 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-500'
                              : 'bg-gradient-to-r from-emerald-800 to-amber-600'
                          }`}
                          style={{ width: `${barWidthPercent}%` }}
                        >
                          {barWidthPercent > 40 && (
                            <span className="text-[9px] font-black text-[#031713] font-mono leading-none">
                              {dept.avgScore}đ
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Sub-info: Min-Max Score, Bonus, Approval Progress */}
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-emerald-300/70 pt-1 border-t border-[#0e4438]/60">
                      <div className="flex items-center gap-2">
                        <span>Biên độ: <strong className="text-white font-mono">{dept.minScore}đ</strong> – <strong className="text-white font-mono">{dept.topScore}đ</strong></span>
                        <span className="text-emerald-700">·</span>
                        <span className="text-emerald-400 font-medium">+{dept.totalBonus}đ thưởng</span>
                        {dept.totalPenalty > 0 && (
                          <span className="text-rose-400 font-medium">-{dept.totalPenalty}đ phạt</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400/80">Đã duyệt BGH:</span>
                        <span className="font-bold text-white font-mono">{dept.approvedPercent}%</span>
                        <span className="text-[9px] text-emerald-400/60">({dept.approvedCount}/{dept.teachersCount})</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW MODE 2: DETAILED STATISTICAL TABLE */}
          {deptViewMode === 'table' && (
            <div className="overflow-x-auto rounded-xl border border-[#0e4438] bg-[#041d17]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#0e4438] bg-[#072a23] text-emerald-300/80 text-[11px] font-bold">
                    <th className="py-2.5 px-3">Hạng</th>
                    <th className="py-2.5 px-3">Tổ Chuyên Môn</th>
                    <th className="py-2.5 px-2 text-center">CBGV</th>
                    <th className="py-2.5 px-3 text-right">Điểm TB Tổ</th>
                    <th className="py-2.5 px-3 text-right">Δ Trường</th>
                    <th className="py-2.5 px-3 text-right">Δ Chuẩn</th>
                    <th className="py-2.5 px-3 text-center">Thấp – Cao</th>
                    <th className="py-2.5 px-3 text-center">Thưởng / Phạt</th>
                    <th className="py-2.5 px-3 text-center">Duyệt BGH</th>
                    <th className="py-2.5 px-3 text-center">Xếp Loại</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0e4438]/80 text-emerald-200">
                  {departmentStats.map((dept, index) => {
                    const isTop = index === 0 && deptSortBy === 'avgDesc';
                    const isAboveSchool = dept.deltaFromSchool >= 0;
                    return (
                      <tr
                        key={dept.deptId}
                        className={`hover:bg-[#072a23] transition-colors ${
                          isTop ? 'bg-amber-400/5' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold">
                          {isTop ? '🥇 1' : index === 1 && deptSortBy === 'avgDesc' ? '🥈 2' : index === 2 && deptSortBy === 'avgDesc' ? '🥉 3' : index + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{dept.deptName}</span>
                            {isTop && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/40">
                                Top 1
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-emerald-300">
                          {dept.teachersCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-amber-300 text-sm">
                          {dept.avgScore}đ
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-xs">
                          <span className={isAboveSchool ? 'text-emerald-400' : 'text-rose-400'}>
                            {isAboveSchool ? `+${dept.deltaFromSchool.toFixed(1)}` : dept.deltaFromSchool.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs">
                          <span className={dept.deltaFromBase >= 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-medium'}>
                            {dept.deltaFromBase >= 0 ? `+${dept.deltaFromBase.toFixed(1)}` : dept.deltaFromBase.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-emerald-300/80">
                          {dept.minScore} – {dept.topScore}đ
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                          <span className="text-emerald-400 font-bold">+{dept.totalBonus}</span>
                          <span className="text-emerald-700 mx-0.5">/</span>
                          <span className="text-rose-400 font-bold">-{dept.totalPenalty}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-[11px] font-mono">
                            <span className="font-bold text-white">{dept.approvedPercent}%</span>
                            <span className="text-[10px] text-emerald-400/60">({dept.approvedCount}/{dept.teachersCount})</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${dept.ratingColor}`}>
                            {dept.rating}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#072a23] font-bold text-white border-t border-[#0e4438] text-[11px]">
                    <td colSpan={2} className="py-2.5 px-3 text-amber-300">
                      Toàn Trường ({departmentStats.length} Tổ)
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-white">
                      {totalStaff} GV
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-300 font-black text-sm">
                      {avgScore}đ
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                      ±0.0
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-300">
                      {(schoolAvgNum - periodBaseScore >= 0 ? '+' : '') + (schoolAvgNum - periodBaseScore).toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-emerald-300">
                      Chuẩn: {periodBaseScore}đ
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-emerald-300">
                      +{totalBonus} / -{totalPenalty}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-emerald-400">
                      {approvedPercent}% ({evaluatedCount}/{totalStaff})
                    </td>
                    <td className="py-2.5 px-3 text-center text-amber-300 font-bold">
                      Hội đồng TĐ
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Right: Top Teachers Podium Preview (4 cols) */}
        <div className="lg:col-span-4 bg-[#05211b] rounded-2xl border border-[#0e4438] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#0e4438]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#093c31] text-amber-400 border border-[#1b7360] flex items-center justify-center font-bold">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm font-serif">Giáo Viên Dẫn Đầu {periodShortTitle}</h3>
                <p className="text-[11px] text-amber-300/80 font-medium">Chỉ tiêu HT Xuất sắc: 20% ({top20Quota} CBGV)</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('leaderboard')}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Xem BXH</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {sortedScores.slice(0, 6).map((rec, index) => {
              const finalScore = rec.bghApprovedScore ?? rec.totalScore;
              const isTop20 = index < top20Quota && finalScore >= periodBaseScore;
              return (
                <div
                  key={rec.id}
                  onClick={() => onSelectRecordToScore(rec)}
                  className="p-3 rounded-xl border border-[#0e4438] bg-[#072a23] hover:border-amber-400 hover:bg-[#0a382e] transition-all flex items-center justify-between gap-3 text-xs cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`w-7 h-7 rounded-xl font-bold flex items-center justify-center text-xs font-mono shrink-0 shadow-2xs ${
                        index === 0
                          ? 'bg-amber-400 text-[#031713] font-extrabold'
                          : index === 1
                          ? 'bg-slate-300 text-stone-900 font-bold'
                          : index === 2
                          ? 'bg-amber-800/40 text-amber-300 font-bold border border-amber-500/40'
                          : 'bg-[#041d17] text-emerald-300 border border-[#0e4438]'
                      }`}
                    >
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </span>
                    <div className="truncate">
                      <div className="font-bold text-white group-hover:text-amber-300 truncate flex items-center gap-1.5">
                        <span>{rec.staffName}</span>
                        {isTop20 && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0">
                            Top 20%
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-emerald-300/60 truncate">
                        {rec.position} · {rec.departmentName}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-extrabold font-mono text-sm text-amber-300">
                      {finalScore} đ
                    </span>
                    <div className="text-[10px] text-emerald-400 font-semibold">
                      +{rec.totalBonus}đ thưởng
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
