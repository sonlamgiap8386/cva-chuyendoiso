import { r as a, j as e, ad as X, ac as K, Z as P, X as Y, a4 as q } from "./react-vendor-DBuJbkU2.js";
import { l as B, d as W, g as Z, b as J, e as ee } from "./App-BqaH__2c.js";

const ie = ({ isOpen: A, onClose: N, scores: j, period: u, departments: p, currentUser: te }) => {
  const [d, I] = a.useState("all");
  const [v, D] = a.useState(true);
  const [k, G] = a.useState(true);
  const [f, y] = a.useState("normal");
  const m = a.useMemo(() => {
    const t = new Date();
    return { day: t.getDate(), month: t.getMonth() + 1, year: t.getFullYear() };
  }, []);
  const [R, oe] = a.useState("Bắc Ninh, ngày " + (m.day < 10 ? "0" + m.day : m.day) + " tháng " + (m.month < 10 ? "0" + m.month : m.month) + " năm " + m.year);

  const h = W(u);
  const V = ee(u);
  const g = J(u);

  const l = a.useMemo(() => {
    let t = j || [];
    if (d !== "all") {
      t = t.filter(r => r.departmentId === d);
    }
    return [...t].sort((r, c) => {
      const i = r.bghApprovedScore ?? r.totalScore;
      return (c.bghApprovedScore ?? c.totalScore) - i || (r.staffCode || "").localeCompare(c.staffCode || "");
    });
  }, [j, d]);

  const s = a.useMemo(() => {
    const t = l.length;
    const r = l.filter(o => o.status === "approved" || o.status === "locked").length;
    const c = l.reduce((o, x) => o + (x.bghApprovedScore ?? x.totalScore), 0);
    const i = t > 0 ? (c / t).toFixed(1) : String(h);
    const n = Z(t);
    let T = 0, C = 0, S = 0;
    l.forEach((o, x) => {
      const Q = x + 1;
      const z = o.bghApprovedScore ?? o.totalScore;
      const H = B(z, Q, t, h);
      if (H.type === "xuat_sac") T++;
      else if (H.type === "tot") C++;
      else S++;
    });
    const E = l.reduce((o, x) => o + (x.totalBonus || 0), 0);
    const $ = l.reduce((o, x) => o + (x.totalPenalty || 0), 0);
    return {
      totalStaff: t,
      totalApproved: r,
      avgScore: i,
      top20Quota: n,
      excellentCount: T,
      goodCount: C,
      passCount: S,
      totalBonus: E,
      totalPenalty: $
    };
  }, [l, h]);

  const b = a.useMemo(() => {
    return d === "all" ? null : p.find(t => t.id === d) || null;
  }, [p, d]);

  const w = () => {
    document.body.classList.add("printing-pdf");
    const t = () => {
      document.body.classList.remove("printing-pdf");
      window.removeEventListener("afterprint", t);
    };
    window.addEventListener("afterprint", t);
    setTimeout(() => {
      window.print();
      setTimeout(t, 2000);
    }, 100);
  };

  const F = () => {
    const t = document.getElementById("pdf-document-paper");
    if (!t) return;
    const r = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Bien_Ban_Thi_Dua_${g}_THPT_Chu_Van_An</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 10mm 10mm 10mm;
    }
    *, html, body, table, th, td, div, span, p, h1, h2, h3 {
      font-family: "Times New Roman", Times, "TimesNewRoman", Georgia, serif !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      background: #ffffff;
      color: #000000;
      margin: 0;
      padding: 15px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    th, td {
      border: 1px solid #000000;
      padding: 5px 6px;
      font-size: 11px;
    }
    th {
      background-color: #f0f9ff;
      font-weight: bold;
      text-align: center;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .no-print { display: none !important; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  ${t.outerHTML}
  <script>
    window.addEventListener("load", function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`;
    const c = new Blob([r], { type: "text/html;charset=utf-8" });
    const i = URL.createObjectURL(c);
    const n = document.createElement("a");
    n.href = i;
    n.download = `Bien_Ban_Thi_Dua_${g}_THPT_Chu_Van_An.html`;
    document.body.appendChild(n);
    n.click();
    document.body.removeChild(n);
    URL.revokeObjectURL(i);
  };

  const getEvidence = (t, r) => {
    if (t.bghNotes) return t.bghNotes;
    const notes = [];
    if (t.bonusItems && t.bonusItems.length > 0) {
      t.bonusItems.forEach(item => {
        if (item.note) notes.push(item.note);
        else if (item.title) notes.push(item.title);
      });
    }
    if (t.penaltyItems && t.penaltyItems.length > 0) {
      t.penaltyItems.forEach(item => {
        if (item.note) notes.push(item.note);
        else if (item.title) notes.push("Trừ: " + item.title);
      });
    }
    if (notes.length > 0) return notes.join("; ");
    if (r === 1) return "SKKN cấp ngành; hoàn thành xuất sắc nhiệm vụ.";
    if (r === 2) return "Được phân công dạy thay cho người đi công tác, nghỉ ốm nằm viện, nghỉ theo luật lao động, Tổ chuyên môn có sổ theo dõi.";
    if (r === 3) return "Được đăng bài cho Website nhà trường (bài viết về hoạt động của trường, gương người tốt việc tốt, ký sự... được BGH phê duyệt, nộp lên cấp trên)";
    if (t.isHomeroomTeacher) return "GVCN lớp " + (t.homeroomClass || "") + " nề nếp tốt, dẫn đầu thi đua tuần.";
    return "Hoàn thành tốt nhiệm vụ chuyên môn và ngày giờ công.";
  };

  if (!A) return null;

  return e.jsx("div", {
    id: "pdf-export-modal-backdrop",
    className: "fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-start justify-center p-2 sm:p-4 md:p-6",
    style: { fontFamily: "'Times New Roman', Times, serif" },
    children: e.jsxs("div", {
      id: "pdf-export-modal-panel",
      className: "relative w-full max-w-6xl bg-[#031713] border border-[#0e4438] rounded-2xl shadow-2xl flex flex-col my-auto max-h-[96vh] overflow-hidden",
      style: { fontFamily: "'Times New Roman', Times, serif" },
      children: [
        /* Modal Header (no-print) */
        e.jsxs("div", {
          className: "no-print bg-[#05211b] border-b border-[#0e4438] px-4 py-3 sm:px-6 flex items-center justify-between gap-4 shrink-0",
          style: { fontFamily: "'Times New Roman', Times, serif" },
          children: [
            e.jsxs("div", {
              className: "flex items-center gap-3",
              children: [
                e.jsx("div", {
                  className: "w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/40 flex items-center justify-center font-bold shrink-0",
                  children: e.jsx(X, { className: "w-5 h-5" })
                }),
                e.jsxs("div", {
                  children: [
                    e.jsxs("h2", {
                      className: "text-base sm:text-lg font-bold text-white flex items-center gap-2",
                      style: { fontFamily: "'Times New Roman', Times, serif" },
                      children: [
                        e.jsx("span", { children: "Xuất Biên Bản Thi Đua CBVC (Chuẩn Times New Roman)" }),
                        e.jsx("span", { className: "text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40", children: g })
                      ]
                    }),
                    e.jsx("p", {
                      className: "text-xs text-emerald-300/70",
                      style: { fontFamily: "'Times New Roman', Times, serif" },
                      children: "Mẫu chuẩn 3 phần: Phần đầu (Ảnh 1), Bảng 12 cột (Ảnh 2), Chữ ký mộc đỏ (Ảnh 3)"
                    })
                  ]
                })
              ]
            }),
            e.jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                e.jsxs("button", {
                  type: "button",
                  onClick: F,
                  className: "hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#072a23] hover:bg-[#0a382e] text-emerald-300 hover:text-white border border-[#0e4438] text-xs font-bold transition-all cursor-pointer",
                  title: "Tải file HTML / PDF để lưu trữ hoặc in offline",
                  children: [e.jsx(K, { className: "w-4 h-4 text-emerald-400" }), e.jsx("span", { children: "Tải file in PDF" })]
                }),
                e.jsxs("button", {
                  type: "button",
                  onClick: w,
                  className: "flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-[#031713] text-xs font-black shadow-md transition-all cursor-pointer",
                  title: "Mở hộp thoại in và chọn Lưu dưới dạng PDF",
                  children: [e.jsx(P, { className: "w-4 h-4" }), e.jsx("span", { children: "Lưu PDF / In Ngay (A4)" })]
                }),
                e.jsx("button", {
                  type: "button",
                  onClick: N,
                  className: "p-2 rounded-xl bg-[#041d17] hover:bg-rose-950/40 text-emerald-400 hover:text-rose-300 border border-[#0e4438] transition-colors cursor-pointer",
                  title: "Đóng cửa sổ",
                  children: e.jsx(Y, { className: "w-5 h-5" })
                })
              ]
            })
          ]
        }),

        /* Toolbar Controls (no-print) */
        e.jsxs("div", {
          className: "no-print bg-[#041d17] border-b border-[#0e4438] px-4 py-2.5 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0",
          style: { fontFamily: "'Times New Roman', Times, serif" },
          children: [
            e.jsxs("div", {
              className: "flex items-center gap-2 flex-wrap",
              children: [
                e.jsx("span", { className: "text-emerald-300/80 font-medium", children: "Phạm vi xuất:" }),
                e.jsxs("select", {
                  value: d,
                  onChange: e => I(e.target.value),
                  className: "bg-[#062921] border border-[#0e4438] text-white rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-amber-400 cursor-pointer",
                  children: [
                    e.jsxs("option", { value: "all", children: ["Toàn trường (", j ? j.length : 0, " CBGV)"] }),
                    p.map(t => e.jsx("option", { value: t.id, children: t.name }, t.id))
                  ]
                })
              ]
            }),
            e.jsxs("div", {
              className: "flex items-center gap-4 flex-wrap",
              children: [
                e.jsxs("label", {
                  className: "flex items-center gap-1.5 cursor-pointer text-emerald-200",
                  children: [
                    e.jsx("input", {
                      type: "checkbox",
                      checked: v,
                      onChange: e => D(e.target.checked),
                      className: "accent-amber-400 rounded cursor-pointer"
                    }),
                    e.jsx("span", { className: "font-semibold text-amber-300", children: "Đóng dấu mộc đỏ" })
                  ]
                }),
                e.jsxs("label", {
                  className: "flex items-center gap-1.5 cursor-pointer text-emerald-200",
                  children: [
                    e.jsx("input", {
                      type: "checkbox",
                      checked: k,
                      onChange: e => G(e.target.checked),
                      className: "accent-teal-400 rounded cursor-pointer"
                    }),
                    e.jsx("span", { className: "font-semibold text-teal-300", children: "Chữ ký điện tử BGH" })
                  ]
                }),
                e.jsxs("div", {
                  className: "flex items-center gap-1 bg-[#062921] p-0.5 rounded-lg border border-[#0e4438]",
                  children: [
                    e.jsx("button", {
                      type: "button",
                      onClick: () => y("normal"),
                      className: `px-2 py-0.5 rounded text-[11px] font-bold ${f === "normal" ? "bg-amber-400 text-[#031713]" : "text-emerald-300 hover:text-white"}`,
                      children: "Cỡ chữ chuẩn"
                    }),
                    e.jsx("button", {
                      type: "button",
                      onClick: () => y("compact"),
                      className: `px-2 py-0.5 rounded text-[11px] font-bold ${f === "compact" ? "bg-amber-400 text-[#031713]" : "text-emerald-300 hover:text-white"}`,
                      children: "Cỡ chữ gọn"
                    })
                  ]
                })
              ]
            })
          ]
        }),

        /* Document Paper Body */
        e.jsx("div", {
          className: "flex-1 overflow-y-auto p-4 sm:p-6 bg-[#020f0c] flex justify-center",
          children: e.jsxs("div", {
            id: "pdf-document-paper",
            className: `w-full max-w-[1060px] bg-white text-black shadow-2xl p-6 sm:p-10 transition-all ${f === "compact" ? "text-[11px]" : "text-[12px]"}`,
            style: { fontFamily: "'Times New Roman', Times, serif", color: "#000000", lineHeight: 1.45 },
            children: [
              /* PHẦN ĐẦU CỦA BÁO CÁO (ẢNH 1) */
              e.jsxs("div", {
                className: "pb-4",
                style: { fontFamily: "'Times New Roman', Times, serif" },
                children: [
                  e.jsxs("div", {
                    className: "flex justify-between items-start pb-2",
                    children: [
                      e.jsxs("div", {
                        className: "text-center w-[45%]",
                        children: [
                          e.jsx("div", { className: "text-[12px] uppercase font-bold tracking-tight", children: "SỞ GIÁO DỤC VÀ ĐÀO TẠO TP BẮC NINH" }),
                          e.jsx("div", { className: "text-[13px] uppercase font-bold tracking-normal mt-0.5", children: "TRƯỜNG THPT CHU VĂN AN" }),
                          e.jsx("div", { className: "w-28 h-[1px] bg-black mx-auto mt-1 mb-1.5" }),
                          e.jsx("div", { className: "text-[11px]", children: "Số: 128/BB-HĐTĐKT" })
                        ]
                      }),
                      e.jsxs("div", {
                        className: "text-center w-[52%]",
                        children: [
                          e.jsx("div", { className: "text-[12px] uppercase font-bold tracking-normal", children: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" }),
                          e.jsx("div", { className: "text-[13px] font-bold tracking-tight", children: "Độc lập - Tự do - Hạnh phúc" }),
                          e.jsx("div", { className: "w-36 h-[1px] bg-black mx-auto mt-1 mb-1.5" }),
                          e.jsx("div", { className: "text-[11px] italic", children: R })
                        ]
                      })
                    ]
                  }),
                  e.jsx("div", { className: "w-full h-[1px] bg-stone-300 my-3" }),
                  e.jsxs("div", {
                    className: "text-center my-5",
                    children: [
                      e.jsx("h1", { className: "text-[17px] sm:text-[19px] font-bold uppercase tracking-wide", children: "BIÊN BẢN HỌP HỘI ĐỒNG THI ĐUA KHEN THƯỞNG" }),
                      e.jsxs("div", { className: "text-[13px] sm:text-[14px] font-bold uppercase mt-1", children: ["Về việc đánh giá, xếp loại thi đua CBVC ", (V || "THÁNG 1").toUpperCase()] }),
                      e.jsx("div", { className: "text-[11.5px] italic text-stone-600 mt-0.5", children: "Năm học 2026 - 2027" }),
                      b && e.jsxs("div", { className: "inline-block mt-2 px-3 py-0.5 rounded border border-black font-bold text-[11px] uppercase bg-slate-100", children: ["Phạm vi: ", b.name, " (", l.length, " cán bộ giáo viên)"] })
                    ]
                  }),
                  e.jsxs("div", {
                    className: "space-y-3 text-[11.5px] leading-relaxed text-justify",
                    children: [
                      e.jsxs("p", { children: ["Vào hồi 14 giờ 00 phút, ngày 28/10/2026, tại Văn phòng Hội đồng Trường THPT Chu Văn An, Hội đồng Thi đua - Khen thưởng nhà trường đã tiến hành phiên họp toàn thể định kỳ nhằm tổng hợp, đánh giá và công bố kết quả chấm điểm thi đua cán bộ, giáo viên, nhân viên ", (V || "tháng 1").toLowerCase(), "."] }),
                      e.jsxs("div", {
                        children: [
                          e.jsx("div", { className: "font-bold uppercase text-[11.5px]", children: "I. THÀNH PHẦN THAM DỰ:" }),
                          e.jsxs("ul", {
                            className: "list-none pl-2 mt-1 space-y-0.5",
                            children: [
                              e.jsxs("li", { children: ["• Đ/c ", e.jsx("strong", { children: "Trần Văn Thi" }), " – Hiệu trưởng, Chủ tịch Hội đồng Thi đua Khen thưởng."] }),
                              e.jsxs("li", { children: ["• Đ/c ", e.jsx("strong", { children: "Nguyễn Đăng Tấn" }), " – Phó Hiệu trưởng, Phó Chủ tịch HĐTĐKT."] }),
                              e.jsxs("li", { children: ["• Đ/c ", e.jsx("strong", { children: "Đặng Vũ Hải" }), " – Phó Hiệu trưởng,  Phó Chủ tịch Thường trực HĐTĐKT."] }),
                              e.jsxs("li", { children: ["• Đ/c ", e.jsx("strong", { children: "Nguyễn Thị Diệu Thiên" }), " – Thư ký Hội đồng."] }),
                              e.jsx("li", { children: "• Cùng toàn thể 10 đồng chí Tổ trưởng chuyên môn và Trưởng các bộ phận đoàn thể trong nhà trường." })
                            ]
                          })
                        ]
                      }),
                      e.jsxs("div", {
                        children: [
                          e.jsx("div", { className: "font-bold uppercase text-[11.5px]", children: "II. TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ THI ĐUA:" }),
                          e.jsxs("p", { className: "mt-1", children: ["Căn cứ Quy chế Thi đua ban hành theo Quyết định số 45/QĐ-THPTCVA và thang điểm chuẩn định mức ", e.jsxs("strong", { children: [h, " điểm"] }), ", Hội đồng đã tiến hành thẩm tra hồ sơ, đối chiếu minh chứng và thống nhất kết quả đánh giá như sau:"] })
                        ]
                      })
                    ]
                  })
                ]
              }),

              /* PHẦN THÂN CỦA BÁO CÁO (ẢNH 2 - BẢNG 12 CỘT CHI TIẾT) */
              e.jsx("div", {
                className: "overflow-x-auto my-3",
                children: e.jsxs("table", {
                  className: "w-full border-collapse border border-black text-black",
                  style: { fontFamily: "'Times New Roman', Times, serif" },
                  children: [
                    e.jsx("thead", {
                      children: e.jsxs("tr", {
                        className: "bg-[#f0f9ff] text-center font-bold text-[11px]",
                        children: [
                          e.jsx("th", { className: "border border-black p-1.5 w-8", children: "STT" }),
                          e.jsx("th", { className: "border border-black p-1.5 w-16", children: "Mã CB" }),
                          e.jsx("th", { className: "border border-black p-1.5 min-w-[140px] text-left", children: "Họ và tên" }),
                          e.jsx("th", { className: "border border-black p-1.5 min-w-[110px] text-left", children: "Tổ chuyên môn" }),
                          e.jsx("th", { className: "border border-black p-1.5 min-w-[110px] text-left", children: "Chức vụ" }),
                          e.jsx("th", { className: "border border-black p-1.5 w-14", children: "Điểm chuẩn" }),
                          e.jsx("th", { className: "border border-black p-1.5 w-12 text-teal-800", children: "Cộng (+)" }),
                          e.jsx("th", { className: "border border-black p-1.5 w-12 text-rose-800", children: "Trừ (-)" }),
                          e.jsx("th", { className: "border border-black p-1.5 w-14", children: "Tự chấm" }),
                          e.jsx("th", { className: "border border-black p-1.5 w-16 bg-amber-50 font-bold", children: "BGH duyệt" }),
                          e.jsx("th", { className: "border border-black p-1.5 min-w-[130px]", children: "Xếp loại thi đua" }),
                          e.jsx("th", { className: "border border-black p-1.5 min-w-[180px] text-left", children: "Ghi chú / Minh chứng" })
                        ]
                      })
                    }),
                    e.jsx("tbody", {
                      children: l.map((t, r) => {
                        const c = t.bghApprovedScore ?? t.totalScore;
                        const selfScore = t.baseScore + (t.totalBonus || 0) - (t.totalPenalty || 0);
                        const i = r + 1;
                        const n = B(c, i, l.length, h);
                        const evidenceText = getEvidence(t, i);

                        return e.jsxs("tr", {
                          className: r % 2 === 1 ? "bg-slate-50/40" : "bg-white",
                          children: [
                            e.jsx("td", { className: "border border-black p-1.5 text-center font-bold", children: i }),
                            e.jsx("td", { className: "border border-black p-1.5 text-center text-[10px]", children: t.staffCode }),
                            e.jsx("td", { className: "border border-black p-1.5 font-bold whitespace-nowrap", children: t.staffName }),
                            e.jsx("td", { className: "border border-black p-1.5 text-[11px] whitespace-nowrap", children: t.departmentName }),
                            e.jsx("td", { className: "border border-black p-1.5 text-[10.5px]", children: t.position }),
                            e.jsx("td", { className: "border border-black p-1.5 text-center text-[11px]", children: t.baseScore || h }),
                            e.jsx("td", { className: "border border-black p-1.5 text-center font-bold text-teal-800", children: (t.totalBonus || 0) > 0 ? "+" + t.totalBonus : "0" }),
                            e.jsx("td", { className: "border border-black p-1.5 text-center font-bold text-rose-800", children: (t.totalPenalty || 0) > 0 ? "-" + t.totalPenalty : "0" }),
                            e.jsx("td", { className: "border border-black p-1.5 text-center", children: selfScore }),
                            e.jsx("td", { className: "border border-black p-1.5 text-center font-bold text-[12px] bg-amber-50/50", children: c }),
                            e.jsx("td", {
                              className: "border border-black p-1.5 text-center whitespace-nowrap",
                              children: n.isTop20 ? e.jsx("span", {
                                className: "inline-block px-1.5 py-0.5 rounded border border-amber-500 bg-amber-50 text-amber-900 font-bold text-[10px]",
                                children: "HT Xuất sắc (Top 20%)"
                              }) : n.type === "tot" ? e.jsx("span", {
                                className: "inline-block px-1.5 py-0.5 rounded border border-emerald-600 bg-emerald-50 text-emerald-900 font-bold text-[10px]",
                                children: "HT Tốt nhiệm vụ"
                              }) : n.type === "hoan_thanh" ? e.jsx("span", {
                                className: "inline-block px-1.5 py-0.5 rounded border border-sky-600 bg-sky-50 text-sky-900 font-bold text-[10px]",
                                children: "Hoàn thành"
                              }) : e.jsx("span", {
                                className: "inline-block px-1.5 py-0.5 rounded border border-rose-600 bg-rose-50 text-rose-900 font-bold text-[10px]",
                                children: "Chưa hoàn thành"
                              })
                            }),
                            e.jsx("td", { className: "border border-black p-1.5 text-[10.5px] italic text-justify leading-snug", children: evidenceText })
                          ]
                        }, t.id || t.staffId || r);
                      })
                    }),
                    e.jsx("tfoot", {
                      children: e.jsxs("tr", {
                        className: "bg-slate-100 font-bold border-t-2 border-black text-[11px]",
                        children: [
                          e.jsxs("td", { colSpan: 5, className: "border border-black p-1.5 text-center uppercase", children: ["Tổng Cộng (", l.length, " CBGV)"] }),
                          e.jsx("td", { className: "border border-black p-1.5 text-center", children: h }),
                          e.jsxs("td", { className: "border border-black p-1.5 text-center text-teal-800", children: ["+", s.totalBonus] }),
                          e.jsxs("td", { className: "border border-black p-1.5 text-center text-rose-800", children: ["-", s.totalPenalty] }),
                          e.jsxs("td", { className: "border border-black p-1.5 text-center", children: ["TB: ", s.avgScore] }),
                          e.jsxs("td", { className: "border border-black p-1.5 text-center font-bold text-[12px] bg-amber-100", children: [s.avgScore, "đ"] }),
                          e.jsxs("td", { colSpan: 2, className: "border border-black p-1.5 text-center text-[10.5px]", children: ["Top 20% Xuất sắc: ", s.excellentCount, "/", s.top20Quota, " · Tốt: ", s.goodCount, " · Hoàn thành: ", s.passCount] })
                        ]
                      })
                    })
                  ]
                })
              }),

              /* PHẦN CUỐI CỦA BÁO CÁO (ẢNH 3 - HAI CỘT CHỮ KÝ, CON DẤU MỘC ĐỎ) */
              e.jsxs("div", {
                className: "grid grid-cols-2 gap-8 mt-10 pt-4 text-center text-[12px] break-inside-avoid",
                style: { fontFamily: "'Times New Roman', Times, serif" },
                children: [
                  /* Cột trái: Thư ký Hội đồng */
                  e.jsxs("div", {
                    className: "flex flex-col justify-between items-center h-40",
                    children: [
                      e.jsxs("div", {
                        children: [
                          e.jsx("div", { className: "font-bold uppercase text-[12px] tracking-wide", children: "THƯ KÝ HỘI ĐỒNG" }),
                          e.jsx("div", { className: "text-[10.5px] italic text-stone-600 mt-0.5", children: "(Ký và ghi rõ họ tên)" })
                        ]
                      }),
                      e.jsx("div", { className: "font-bold text-[13px] text-black", children: "Nguyễn Thị Diệu Thiên" })
                    ]
                  }),

                  /* Cột phải: Hiệu trưởng - Chủ tịch Hội đồng */
                  e.jsxs("div", {
                    className: "flex flex-col justify-between items-center h-40 relative",
                    children: [
                      e.jsxs("div", {
                        children: [
                          e.jsx("div", { className: "font-bold uppercase text-[12px] tracking-wide", children: "HIỆU TRƯỞNG - CHỦ TỊCH HỘI ĐỒNG" }),
                          e.jsx("div", { className: "text-[10.5px] italic text-stone-600 mt-0.5", children: "(Ký tên, đóng dấu)" })
                        ]
                      }),
                      /* Con dấu và chữ ký */
                      e.jsxs("div", {
                        className: "relative w-36 h-20 flex items-center justify-center my-0.5",
                        children: [
                          v && e.jsx("img", {
                            src: "./assets/con_dau.png",
                            alt: "Con dấu Trường THPT Chu Văn An",
                            className: "absolute w-28 h-28 object-contain pointer-events-none -top-4 right-1 opacity-90",
                            onError: e => {
                              e.target.src = "./con_dau.png";
                            }
                          }),
                          k && e.jsx("img", {
                            src: "./assets/chu_ky.png",
                            alt: "Chữ ký Hiệu trưởng Trần Văn Thi",
                            className: "relative z-10 w-28 object-contain mix-blend-multiply -left-4 -top-2 transform -rotate-2",
                            onError: e => {
                              e.target.src = "./chu_ky.png";
                            }
                          })
                        ]
                      }),
                      e.jsx("div", { className: "font-bold text-[13px] text-black", children: "Trần Văn Thi" })
                    ]
                  })
                ]
              })
            ]
          })
        }),

        /* Footer Close Button (no-print) */
        e.jsxs("div", {
          className: "no-print bg-[#05211b] border-t border-[#0e4438] px-4 py-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0",
          style: { fontFamily: "'Times New Roman', Times, serif" },
          children: [
            e.jsxs("div", {
              className: "flex items-center gap-2 text-emerald-300/80",
              children: [
                e.jsx(q, { className: "w-4 h-4 text-amber-400 shrink-0" }),
                e.jsx("span", { children: "Khuyến nghị khi In/Lưu PDF: Chọn Khổ giấy A4, Hướng ngang (Landscape), Bật 'Đồ họa nền' (Background graphics)." })
              ]
            }),
            e.jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                e.jsx("button", {
                  type: "button",
                  onClick: N,
                  className: "px-4 py-1.5 rounded-xl bg-[#062921] hover:bg-[#093a2f] text-emerald-300 hover:text-white border border-[#0e4438] font-bold transition-all cursor-pointer",
                  children: "Đóng"
                }),
                e.jsxs("button", {
                  type: "button",
                  onClick: w,
                  className: "px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-[#031713] font-black shadow-md cursor-pointer transition-all",
                  children: [e.jsx(P, { className: "w-4 h-4 inline mr-1" }), e.jsx("span", { children: "Lưu PDF / In Ngay" })]
                })
              ]
            })
          ]
        })
      ]
    })
  });
};

export { ie as E };
