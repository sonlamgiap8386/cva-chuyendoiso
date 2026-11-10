import React, { useState, useMemo } from 'react';
import {
  HelpCircle,
  X,
  Send,
  CheckCircle2,
  Lock,
  Award,
  BookOpen,
  CalendarCheck,
  Scale,
  Search,
  Filter,
  AlertTriangle,
  ShieldCheck,
  Building2,
  FileCheck2,
  Users2,
  Check
} from 'lucide-react';
import { CRITERIA_LIST } from '../data/criteria';
import { CriterionItem } from '../types';

interface ScoringGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  criteria?: CriterionItem[];
}

export const ScoringGuideModal: React.FC<ScoringGuideModalProps> = ({ isOpen, onClose, criteria = CRITERIA_LIST }) => {
  const [activeTab, setActiveTab] = useState<'process' | 'criteria' | 'ranking'>('process');
  const [criteriaSearch, setCriteriaSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    criteria.forEach(c => {
      if (!map.has(c.category)) {
        map.set(c.category, c.categoryTitle);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [criteria]);

  const filteredCriteria = useMemo(() => {
    return criteria.filter(c => {
      const matchCat = selectedCategory === 'all' || c.category === selectedCategory;
      const q = criteriaSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        c.trackingDept.toLowerCase().includes(q) ||
        c.categoryTitle.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [criteria, criteriaSearch, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#05211b] w-full max-w-4xl rounded-3xl shadow-2xl border border-[#145b4c] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#041d17] text-white p-4 sm:p-5 flex items-center justify-between border-b border-[#0e4438]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-serif text-white">
                  Quy Chế Thi Đua & Hướng Dẫn Tính Điểm
                </h3>
                <span className="hidden sm:inline text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full">
                  Trường THPT Chu Văn An · Năm học 2026–2027
                </span>
              </div>
              <p className="text-xs text-emerald-300/80 mt-0.5">
                Căn cứ Quy chế thi đua khen thưởng nội bộ ban hành cho cán bộ, giáo viên, nhân viên
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-emerald-400 hover:text-white hover:bg-[#072a23] transition-colors cursor-pointer"
            aria-label="Đóng hướng dẫn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#0e4438] bg-[#031813] px-4 pt-2 gap-2 overflow-x-auto text-xs shrink-0">
          <button
            onClick={() => setActiveTab('process')}
            className={`px-3.5 py-2.5 rounded-t-xl font-bold flex items-center gap-2 transition-colors cursor-pointer border-b-2 ${
              activeTab === 'process'
                ? 'bg-[#05211b] text-amber-300 border-amber-400'
                : 'text-emerald-300/70 hover:text-white border-transparent hover:bg-[#05211b]/50'
            }`}
          >
            <CalendarCheck className="w-4 h-4 text-amber-400" />
            <span>1. Quy trình & Lịch nộp điểm</span>
          </button>

          <button
            onClick={() => setActiveTab('criteria')}
            className={`px-3.5 py-2.5 rounded-t-xl font-bold flex items-center gap-2 transition-colors cursor-pointer border-b-2 ${
              activeTab === 'criteria'
                ? 'bg-[#05211b] text-amber-300 border-amber-400'
                : 'text-emerald-300/70 hover:text-white border-transparent hover:bg-[#05211b]/50'
            }`}
          >
            <Scale className="w-4 h-4 text-emerald-400" />
            <span>2. Tiêu chí & Biểu điểm theo Quy chế ({CRITERIA_LIST.length} mục)</span>
          </button>

          <button
            onClick={() => setActiveTab('ranking')}
            className={`px-3.5 py-2.5 rounded-t-xl font-bold flex items-center gap-2 transition-colors cursor-pointer border-b-2 ${
              activeTab === 'ranking'
                ? 'bg-[#05211b] text-amber-300 border-amber-400'
                : 'text-emerald-300/70 hover:text-white border-transparent hover:bg-[#05211b]/50'
            }`}
          >
            <Award className="w-4 h-4 text-yellow-400" />
            <span>3. Tiêu chuẩn Xếp loại thi đua</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs text-stone-100">
          {/* TAB 1: Quy trình & Thời hạn nộp điểm */}
          {activeTab === 'process' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#041d17] rounded-2xl border border-amber-400/30 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 font-bold">
                  230
                </div>
                <div className="text-emerald-200 leading-relaxed text-xs">
                  <div className="font-bold text-amber-300 text-sm mb-1">Nguyên Tắc Tính Điểm Hàng Tháng</div>
                  Mỗi cán bộ, giáo viên xuất phát với mức <strong>Điểm nền chuẩn 230 điểm/tháng</strong> (trong đó: 80 điểm Phẩm chất chính trị, đạo đức lối sống + 150 điểm Chuyên môn, ngày giờ công, nề nếp).
                  <div className="font-mono text-amber-300 bg-[#021410] border border-[#0e4438] rounded-lg p-2 mt-2 font-bold text-center">
                    Tổng điểm = 230đ (Điểm nền) + Tổng điểm thưởng (Bonus) − Tổng điểm phạt (Penalty)
                  </div>
                </div>
              </div>

              {/* 4 Steps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Step 1 */}
                <div className="p-4 bg-[#041d17] rounded-2xl border border-[#0e4438] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-xs">
                        1
                      </span>
                      <span className="text-[11px] font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        Ngày 20 – 25 hàng tháng
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-sm mb-1">TTCM rà soát & Chấm điểm cho Tổ</h4>
                    <p className="text-emerald-300/80 leading-relaxed text-[11px]">
                      Tổ trưởng chuyên môn (TTCM) căn cứ sổ theo dõi ngày giờ công, kết quả giảng dạy, hồ sơ CSDL, thành tích bồi dưỡng HSG để nhập các mục điểm thưởng và điểm phạt tương ứng cho từng giáo viên.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-[#0e4438] text-[11px] text-stone-400 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Lưu bản nháp để điều chỉnh trong kỳ họp tổ.</span>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-4 bg-[#041d17] rounded-2xl border border-[#0e4438] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-xs">
                        2
                      </span>
                      <span className="text-[11px] font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        Trước 17h00 ngày 26 hàng tháng
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-sm mb-1">Họp Tổ thông qua & Nộp lên BGH</h4>
                    <p className="text-emerald-300/80 leading-relaxed text-[11px]">
                      Sau khi thông qua biên bản họp tổ, TTCM nhấn <strong className="text-amber-300">"Lưu & Gửi BGH duyệt"</strong>. Hồ sơ chuyển trạng thái sang <span className="font-bold text-amber-300 bg-amber-950 px-1 py-0.2 rounded border border-amber-600">Chờ BGH duyệt</span> và được khóa tạm thời ở cấp tổ.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-[#0e4438] text-[11px] text-stone-400 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-amber-400" />
                    <span>Giáo viên có thể xem điểm và gửi phản hồi minh chứng.</span>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-4 bg-[#041d17] rounded-2xl border border-[#0e4438] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-300 font-bold flex items-center justify-center text-xs">
                        3
                      </span>
                      <span className="text-[11px] font-bold text-blue-300 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20">
                        Ngày 27 – 29 hàng tháng
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-sm mb-1">Ban Giám Hiệu thẩm định & Phê duyệt</h4>
                    <p className="text-emerald-300/80 leading-relaxed text-[11px]">
                      BGH đối chiếu với số liệu của Ban Nề nếp, Đoàn trường, Công đoàn, CSDL để phê duyệt. BGH có thẩm quyền điều chỉnh điểm chốt chính thức và nhập ý kiến chỉ đạo theo quy chế.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-[#0e4438] text-[11px] text-stone-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Trạng thái chuyển sang <strong>Đã duyệt</strong>.</span>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-4 bg-[#041d17] rounded-2xl border border-[#0e4438] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-6 h-6 rounded-lg bg-yellow-500/20 text-yellow-300 font-bold flex items-center justify-center text-xs">
                        4
                      </span>
                      <span className="text-[11px] font-bold text-yellow-300 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                        Ngày 30 hàng tháng
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-sm mb-1">Khóa sổ tháng & Công bố công khai</h4>
                    <p className="text-emerald-300/80 leading-relaxed text-[11px]">
                      BGH tiến hành <strong>Khóa sổ tháng</strong>. Toàn bộ điểm số được chốt vĩnh viễn, đồng bộ tức thì lên <strong>Bảng Xếp Hạng & Báo Cáo</strong> toàn trường để làm căn cứ xếp loại thi đua, nâng lương và khen thưởng.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-[#0e4438] text-[11px] text-stone-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Điểm chốt được công khai toàn trường.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Chi tiết Tiêu chí & Biểu điểm theo Quy chế */}
          {activeTab === 'criteria' && (
            <div className="space-y-4">
              {/* Category Filter & Search Box */}
              <div className="p-3 bg-[#041d17] rounded-2xl border border-[#0e4438] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm tiêu chí theo tên, bộ phận theo dõi, điểm..."
                    value={criteriaSearch}
                    onChange={e => setCriteriaSearch(e.target.value)}
                    className="w-full bg-[#031713] border border-[#0e4438] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-amber-400"
                  />
                  {criteriaSearch && (
                    <button
                      onClick={() => setCriteriaSearch('')}
                      className="absolute right-2.5 top-2 text-stone-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-emerald-400 shrink-0" />
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="bg-[#031713] border border-[#0e4438] rounded-xl px-2.5 py-1.5 text-xs text-emerald-200 focus:outline-none focus:border-amber-400 cursor-pointer max-w-[240px] truncate"
                  >
                    <option value="all">Tất cả nhóm tiêu chí ({CRITERIA_LIST.length})</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2.5 bg-[#041d17] border border-[#0e4438] rounded-xl text-center">
                  <div className="text-stone-400">Điểm nền chuẩn</div>
                  <div className="font-bold text-white text-sm font-mono">230 đ/tháng</div>
                </div>
                <div className="p-2.5 bg-[#041d17] border border-[#0e4438] rounded-xl text-center">
                  <div className="text-stone-400">Chuẩn HK1 (5 tháng)</div>
                  <div className="font-bold text-emerald-300 text-sm font-mono">1150 đ</div>
                </div>
                <div className="p-2.5 bg-[#041d17] border border-[#0e4438] rounded-xl text-center">
                  <div className="text-stone-400">Chuẩn HK2 (4 tháng)</div>
                  <div className="font-bold text-emerald-300 text-sm font-mono">920 đ</div>
                </div>
                <div className="p-2.5 bg-[#041d17] border border-[#0e4438] rounded-xl text-center">
                  <div className="text-stone-400">Chuẩn Cả năm (9 tháng)</div>
                  <div className="font-bold text-amber-300 text-sm font-mono">2070 đ</div>
                </div>
              </div>

              {/* Criteria Table List */}
              <div className="space-y-3">
                {filteredCriteria.length === 0 ? (
                  <div className="p-8 text-center bg-[#041d17] rounded-2xl border border-[#0e4438] text-stone-400">
                    Không tìm thấy tiêu chí nào phù hợp với từ khóa "{criteriaSearch}".
                  </div>
                ) : (
                  filteredCriteria.map((c: CriterionItem, idx) => {
                    const isReward = !!c.rewardPoints;
                    const isPenalty = !!c.penaltyPoints;
                    const isInitial = !!c.initialPoints;

                    return (
                      <div
                        key={c.id || idx}
                        className="p-3.5 bg-[#041d17] rounded-xl border border-[#0e4438] hover:border-[#1b7360] transition-colors space-y-1.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex-1 min-w-[240px]">
                            <div className="text-[10px] uppercase font-bold text-emerald-400/80 mb-0.5">
                              {c.categoryTitle}
                            </div>
                            <h5 className="font-bold text-white text-xs leading-snug">
                              {c.title}
                            </h5>
                            {c.description && (
                              <p className="text-[11px] text-stone-400 mt-0.5">
                                {c.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isInitial && (
                              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#093c31] text-emerald-300 border border-[#1b7360]">
                                Điểm nền: {c.initialPoints}đ
                              </span>
                            )}
                            {isReward && (
                              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#083329] text-emerald-300 border border-[#125c4b]">
                                +{c.rewardPoints}đ ({c.rewardUnit || `${c.rewardPoints}đ/lần`})
                              </span>
                            )}
                            {isPenalty && (
                              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#3b0d18] text-rose-300 border border-[#7a1830]">
                                -{c.penaltyPoints}đ ({c.penaltyUnit || `-${c.penaltyPoints}đ/lần`})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-[11px] text-stone-400 pt-1 border-t border-[#0e4438]/60 gap-2">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>Bộ phận theo dõi: <strong className="text-stone-300">{c.trackingDept}</strong></span>
                          </div>

                          {c.maxPerSemester && c.maxPerSemester > 0 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-600/40 font-semibold">
                              Trần tối đa cả học kỳ: {c.maxPerSemester}đ
                            </span>
                          ) : (
                            <span className="text-[10px] text-stone-500 italic">
                              Không áp trần học kỳ
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Tiêu chuẩn Xếp loại thi đua */}
          {activeTab === 'ranking' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-[#041d17] rounded-2xl border border-[#0e4438]">
                <div className="font-bold text-white text-sm mb-1 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Khung Tiêu Chuẩn Xếp Loại Thi Đua Cán Bộ Giáo Viên</span>
                </div>
                <p className="text-emerald-300/80 text-xs leading-relaxed">
                  Căn cứ tổng điểm được Ban Giám Hiệu phê duyệt và các điều kiện kỷ luật theo Quy chế của Nhà trường, mức xếp loại được phân định minh bạch như sau:
                </p>
              </div>

              <div className="space-y-3">
                {/* Xuất sắc */}
                <div className="p-4 bg-gradient-to-r from-amber-950/40 via-[#05211b] to-[#041d17] rounded-2xl border border-amber-500/50 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-400 text-stone-950 font-black text-lg flex items-center justify-center shadow">
                        A
                      </div>
                      <div>
                        <div className="font-bold text-amber-300 text-sm">
                          Hoàn Thành Xuất Sắc Nhiệm Vụ (Tối đa 20%)
                        </div>
                        <div className="text-[11px] text-stone-300">
                          Khung điểm: <strong>≥ 235 điểm/tháng</strong> (Cả năm <strong>≥ 2100 điểm</strong>)
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                      Tỷ lệ khống chế ≤ 20%
                    </span>
                  </div>

                  <div className="text-[11px] text-emerald-200/90 pl-13 space-y-1">
                    <div>• Hoàn thành vượt mức mọi nhiệm vụ giảng dạy và công tác được giao.</div>
                    <div>• Có đóng góp nổi bật: GVG, bồi dưỡng HSG có giải, SKKN được công nhận, nghiên cứu KHKT.</div>
                    <div>• <strong>Không bị trừ điểm</strong> về ngày giờ công, nề nếp hoặc quy chế chuyên môn trong kỳ.</div>
                  </div>
                </div>

                {/* Tốt */}
                <div className="p-4 bg-gradient-to-r from-emerald-950/40 via-[#05211b] to-[#041d17] rounded-2xl border border-emerald-500/50 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 text-stone-950 font-black text-lg flex items-center justify-center shadow">
                        B
                      </div>
                      <div>
                        <div className="font-bold text-emerald-300 text-sm">
                          Hoàn Thành Tốt Nhiệm Vụ
                        </div>
                        <div className="text-[11px] text-stone-300">
                          Khung điểm: <strong>230 – 234.9 điểm/tháng</strong> (Cả năm <strong>2070 – 2099 điểm</strong>)
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Đạt mức chuẩn cơ sở
                    </span>
                  </div>

                  <div className="text-[11px] text-emerald-200/90 pl-13 space-y-1">
                    <div>• Hoàn thành đầy đủ các nhiệm vụ giảng dạy và công tác kiêm nhiệm theo đúng kế hoạch.</div>
                    <div>• Thực hiện nghiêm túc ngày giờ công, nề nếp kỷ luật lao động, hồ sơ sổ sách CSDL đúng hạn.</div>
                    <div>• Điểm tổng kết đạt từ mức chuẩn 230 điểm trở lên.</div>
                  </div>
                </div>

                {/* Hoàn thành */}
                <div className="p-4 bg-gradient-to-r from-blue-950/40 via-[#05211b] to-[#041d17] rounded-2xl border border-blue-500/50 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500 text-white font-black text-lg flex items-center justify-center shadow">
                        C
                      </div>
                      <div>
                        <div className="font-bold text-blue-300 text-sm">
                          Hoàn Thành Nhiệm Vụ
                        </div>
                        <div className="text-[11px] text-stone-300">
                          Khung điểm: <strong>200 – 229.9 điểm/tháng</strong> (Cả năm <strong>1800 – 2069 điểm</strong>)
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      Cần nỗ lực khắc phục
                    </span>
                  </div>

                  <div className="text-[11px] text-emerald-200/90 pl-13 space-y-1">
                    <div>• Hoàn thành các nhiệm vụ được giao nhưng còn một số thiếu sót trong hồ sơ hoặc nề nếp.</div>
                    <div>• Có một số mục vi phạm bị trừ điểm (như muộn điểm CSDL, đi họp muộn, sai sót báo cáo).</div>
                    <div>• Điểm tổng kết dưới mức chuẩn nhưng từ 200 điểm trở lên.</div>
                  </div>
                </div>

                {/* Không hoàn thành */}
                <div className="p-4 bg-gradient-to-r from-rose-950/40 via-[#05211b] to-[#041d17] rounded-2xl border border-rose-500/50 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500 text-white font-black text-lg flex items-center justify-center shadow">
                        D
                      </div>
                      <div>
                        <div className="font-bold text-rose-300 text-sm">
                          Không Hoàn Thành Nhiệm Vụ
                        </div>
                        <div className="text-[11px] text-stone-300">
                          Khung điểm: <strong>&lt; 200 điểm/tháng</strong> (Cả năm <strong>&lt; 1800 điểm</strong>)
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      Vi phạm quy chế
                    </span>
                  </div>

                  <div className="text-[11px] text-rose-200/90 pl-13 space-y-1">
                    <div>• Tổng điểm đạt dưới 200 điểm trong tháng (hoặc dưới 1800 điểm trong cả năm học).</div>
                    <div>• Hoặc có một trong các vi phạm nghiêm trọng: bỏ tiết không lý do, từ chối nhiệm vụ do BGH phân công, vi phạm pháp luật hoặc đạo đức nhà giáo bị xử lý kỷ luật.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#041d17] border-t border-[#0e4438] flex items-center justify-between">
          <div className="text-[11px] text-emerald-400/80 hidden sm:block">
            Mọi thắc mắc về minh chứng và quy chế, cán bộ giáo viên liên hệ Ban Thi Đua & BGH Nhà trường.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold transition-colors shadow-sm cursor-pointer"
          >
            Đã hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
