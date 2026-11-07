'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowsClockwise,
  WarningCircle,
  CheckCircle,
  UploadSimple,
} from '@phosphor-icons/react';

interface PdfDocItem {
  title: string;
  url: string;
  year?: string;
  isPriority?: boolean;
}

interface SubPageItem {
  title: string;
  url: string;
  year?: string;
}

interface DiscoveredPortal {
  title: string;
  url: string;
  type: 'AGM_PAGE' | 'IR_PORTAL' | 'ARCHIVE';
  priority: number;
}

interface ExtractedData {
  symbol: string;
  year: string;
  period: string;
  totalShareholders: number;
  recordDate?: string;
  attendeesCount?: number;
  sourceDoc: string;
  snippet?: string;
  isScanned?: boolean;
}

interface AgmIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSymbol: string;
  onDataSaved?: () => void;
}

export const AgmIngestionModal: React.FC<AgmIngestionModalProps> = ({
  isOpen,
  onClose,
  currentSymbol,
  onDataSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'upload' | 'settings'>('url');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto portal search
  const [discoveredPortals, setDiscoveredPortals] = useState<DiscoveredPortal[]>([]);
  const [companyWebsite, setCompanyWebsite] = useState<string | null>(null);
  const [isSearchingPortals, setIsSearchingPortals] = useState(false);

  // Crawled items
  const [foundPdfs, setFoundPdfs] = useState<PdfDocItem[]>([]);
  const [foundSubPages, setFoundSubPages] = useState<SubPageItem[]>([]);

  // Extracted confirmation form
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);

  // Gemini API Key (stored in localStorage)
  const [geminiApiKey, setGeminiApiKey] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('YOURFIN_GEMINI_API_KEY') || '';
      setGeminiApiKey(savedKey);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setGeminiApiKey(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem('YOURFIN_GEMINI_API_KEY', key);
    }
  };

  const handleAutoSearchPortals = async (symbol = currentSymbol) => {
    if (!symbol) return;
    setIsSearchingPortals(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/market/agm/search-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.toUpperCase() }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.portals) && data.portals.length > 0) {
        setDiscoveredPortals(data.portals);
        setCompanyWebsite(data.website || null);
        setCrawlUrl(data.portals[0].url);
      }
    } catch (err: any) {
      console.warn('Auto search portal error:', err);
    } finally {
      setIsSearchingPortals(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentSymbol) {
      setDiscoveredPortals([]);
      setFoundPdfs([]);
      setFoundSubPages([]);
      setExtracted(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      handleAutoSearchPortals(currentSymbol);
    }
  }, [isOpen, currentSymbol]);

  if (!isOpen) return null;

  // 1. Crawl URL
  const handleCrawl = async (urlToCrawl = crawlUrl) => {
    if (!urlToCrawl.trim()) {
      setErrorMsg('Vui lòng nhập đường link trang web quan hệ cổ đông');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsCrawling(true);
    setFoundPdfs([]);
    setFoundSubPages([]);

    try {
      const res = await fetch('/api/market/agm/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToCrawl.trim() }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Không thể quét liên kết từ trang web');
      }

      setFoundPdfs(data.documents || []);
      setFoundSubPages(data.subPages || []);

      if ((data.documents || []).length === 0 && (data.subPages || []).length === 0) {
        setErrorMsg('Không tìm thấy tệp PDF hoặc mục ĐHĐCĐ nào trên trang này. Bạn có thể thử dán link chi tiết của kỳ đại hội.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi quét liên kết');
    } finally {
      setIsCrawling(false);
    }
  };

  // 2. Extract PDF by URL
  const handleExtractFromPdfUrl = async (pdfUrl: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsExtracting(true);

    try {
      const res = await fetch('/api/market/agm/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfUrl,
          symbol: currentSymbol,
          geminiApiKey: geminiApiKey || undefined,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi khi đọc tệp PDF');
      }

      const d = json.data;
      setExtracted({
        symbol: currentSymbol.toUpperCase(),
        year: d.year || new Date().getFullYear().toString(),
        period: d.period || `ĐHĐCĐ ${d.year || new Date().getFullYear()}`,
        totalShareholders: d.totalShareholders || 0,
        recordDate: d.recordDate || '',
        attendeesCount: d.attendeesCount || undefined,
        sourceDoc: d.sourceDoc || pdfUrl.split('/').pop() || 'Tài liệu ĐHĐCĐ',
        snippet: d.snippet || '',
        isScanned: json.isScanned,
      });

      if (json.isScanned && !geminiApiKey) {
        setErrorMsg('Tệp này là bản scan ảnh mộc đỏ. Bạn có thể nhập Gemini API Key ở tab Cài đặt để AI đọc tự động, hoặc xem tài liệu và nhập số lượng để lưu.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi trích xuất dữ liệu');
    } finally {
      setIsExtracting(false);
    }
  };

  // 3. Extract Direct Upload File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsExtracting(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('symbol', currentSymbol);
    if (geminiApiKey) formData.append('geminiApiKey', geminiApiKey);

    try {
      const res = await fetch('/api/market/agm/extract', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi khi phân tích tệp');
      }

      const d = json.data;
      setExtracted({
        symbol: currentSymbol.toUpperCase(),
        year: d.year || new Date().getFullYear().toString(),
        period: d.period || `ĐHĐCĐ ${d.year || new Date().getFullYear()}`,
        totalShareholders: d.totalShareholders || 0,
        recordDate: d.recordDate || '',
        attendeesCount: d.attendeesCount || undefined,
        sourceDoc: file.name,
        snippet: d.snippet || '',
        isScanned: json.isScanned,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi tải lên tệp');
    } finally {
      setIsExtracting(false);
    }
  };

  // 4. Save confirmed record
  const handleSaveConfirmed = async () => {
    if (!extracted) return;
    if (!extracted.totalShareholders || extracted.totalShareholders <= 0) {
      setErrorMsg('Vui lòng nhập số lượng cổ đông hợp lệ (> 0)');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/market/agm/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: extracted.symbol,
          year: extracted.year,
          period: extracted.period,
          totalShareholders: extracted.totalShareholders,
          recordDate: extracted.recordDate || undefined,
          sourceDoc: extracted.sourceDoc,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi khi lưu dữ liệu');
      }

      setSuccessMsg(`Đã cập nhật thành công dữ liệu ĐHĐCĐ ${extracted.year} cho mã ${extracted.symbol}!`);
      setExtracted(null);
      if (onDataSaved) {
        onDataSaved();
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu dữ liệu');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-950/95 backdrop-blur-md z-10">
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              Bóc Tách Dữ Liệu ĐHĐCĐ
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[11px]">
                {currentSymbol}
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Thu thập và đối soát số lượng cổ đông chính xác từ Biên bản họp ĐHĐCĐ &amp; Báo cáo thường niên
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 flex-1">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2">
            <button
              onClick={() => setActiveTab('url')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'url'
                  ? 'bg-emerald-500 text-zinc-950 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              Quét Link Web
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'upload'
                  ? 'bg-emerald-500 text-zinc-950 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              Tải Lên Tệp PDF
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-emerald-500 text-zinc-950 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              Cấu Hình Gemini AI
            </button>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-start gap-2">
              <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{successMsg}</div>
            </div>
          )}

          {/* TAB 1: CRAWL URL */}
          {activeTab === 'url' && !extracted && (
            <div className="space-y-4">
              {/* AUTO-DISCOVERED PORTAL CARD */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-zinc-100">
                        Cổng QHCĐ / ĐHĐCĐ phát hiện ({currentSymbol})
                      </span>
                      {isSearchingPortals && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
                          Đang tìm...
                        </span>
                      )}
                    </div>
                    {companyWebsite && (
                      <span className="text-[11px] font-mono text-zinc-500 block mt-0.5">
                        Website chính thức: <span className="text-zinc-400">{companyWebsite}</span>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAutoSearchPortals(currentSymbol)}
                    disabled={isSearchingPortals}
                    className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <ArrowsClockwise className={`w-3.5 h-3.5 ${isSearchingPortals ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>Tìm lại</span>
                  </button>
                </div>

                {/* Discovered Portal Items */}
                {isSearchingPortals ? (
                  <div className="py-4 text-center space-y-1">
                    <div className="text-xs font-mono text-emerald-400/90 animate-pulse">
                      Đang phân tích cấu trúc menu trang chủ {companyWebsite || currentSymbol}...
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500">
                      Tự động lọc các đường dẫn: Đại hội đồng cổ đông, Quan hệ nhà đầu tư, Công bố thông tin
                    </div>
                  </div>
                ) : discoveredPortals.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono text-zinc-400">
                      Đã phát hiện <span className="text-emerald-400 font-bold">{discoveredPortals.length}</span> cổng thông tin ĐHĐCĐ &amp; QHCĐ:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {discoveredPortals.map((p, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border transition-all flex flex-col justify-between gap-2 ${
                            p.type === 'AGM_PAGE'
                              ? 'bg-zinc-900 border-emerald-500/40'
                              : 'bg-zinc-950 border-zinc-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              {p.type === 'AGM_PAGE' ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  ĐHĐCĐ CHÍNH THỨC
                                </span>
                              ) : p.type === 'IR_PORTAL' ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-zinc-800 text-zinc-300">
                                  QHCĐ / IR
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-zinc-800 text-zinc-400">
                                  LƯU TRỮ VIETSTOCK
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-semibold text-zinc-200 block truncate" title={p.title}>
                              {p.title}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500 truncate block mt-0.5" title={p.url}>
                              {p.url}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setCrawlUrl(p.url);
                              handleCrawl(p.url);
                            }}
                            disabled={isCrawling}
                            className={`w-full py-1.5 rounded text-xs font-mono font-bold transition-all cursor-pointer disabled:opacity-50 ${
                              p.type === 'AGM_PAGE'
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                            }`}
                          >
                            Quét Tự Động
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between py-2">
                    <span>Không tìm thấy cổng tự động từ website doanh nghiệp.</span>
                    <button
                      type="button"
                      onClick={() => handleAutoSearchPortals(currentSymbol)}
                      className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-emerald-500 hover:text-zinc-950 text-zinc-300 text-xs font-mono font-medium transition-all cursor-pointer"
                    >
                      Thử quét lại
                    </button>
                  </div>
                )}
              </div>

              {/* MANUAL LINK INPUT FALLBACK */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-mono text-zinc-400 block">
                  Hoặc nhập/chỉnh sửa đường link bất kỳ:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={crawlUrl}
                    onChange={(e) => setCrawlUrl(e.target.value)}
                    placeholder="https://tasecoland.vn/dai-hoi-dong-co-dong-252367"
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 font-sans"
                  />
                  <button
                    onClick={() => handleCrawl()}
                    disabled={isCrawling}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-mono font-bold transition-all cursor-pointer shrink-0"
                  >
                    {isCrawling ? 'Đang quét...' : 'Quét Tệp'}
                  </button>
                </div>
              </div>

              {/* Found Sub Pages */}
              {foundSubPages.length > 0 && (
                <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-2">
                  <span className="text-[11px] font-mono font-bold text-zinc-300 block">
                    Các kỳ ĐHĐCĐ phát hiện trên trang web:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {foundSubPages.map((sub, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setCrawlUrl(sub.url);
                          handleCrawl(sub.url);
                        }}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-emerald-500 hover:text-zinc-950 text-zinc-200 text-xs font-mono transition-all cursor-pointer"
                      >
                        {sub.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Found PDF Documents List */}
              {foundPdfs.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span>Đã tìm thấy {foundPdfs.length} tài liệu PDF:</span>
                    <span className="text-zinc-500 text-[11px]">Bấm trích xuất để phân tích số lượng cổ đông</span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {foundPdfs.map((pdf, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                          pdf.isPriority
                            ? 'bg-zinc-900 border-emerald-500/30'
                            : 'bg-zinc-950 border-zinc-800'
                        }`}
                      >
                        <div className="truncate flex-1">
                          <span className="text-xs font-medium text-zinc-200 truncate block">
                            {pdf.title}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 truncate block">
                            {pdf.year ? `Kỳ họp ${pdf.year} • ` : ''}{pdf.url}
                          </span>
                        </div>

                        <button
                          onClick={() => handleExtractFromPdfUrl(pdf.url)}
                          disabled={isExtracting}
                          className="px-3 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-zinc-950 border border-emerald-500/30 text-xs font-mono font-bold transition-all shrink-0 cursor-pointer"
                        >
                          {isExtracting ? 'Đang đọc...' : 'Trích Xuất AI'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DIRECT UPLOAD */}
          {activeTab === 'upload' && !extracted && (
            <div className="space-y-4">
              <label className="text-xs font-mono text-zinc-400 block">
                Tải lên tệp Biên bản họp ĐHĐCĐ hoặc Báo cáo thường niên (PDF):
              </label>

              <div className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3 bg-zinc-900/20 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
                  <UploadSimple className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-200">
                    Kéo thả tệp PDF vào đây hoặc bấm để chọn tệp
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">
                    Hỗ trợ tệp PDF số văn bản và bản scan ảnh mộc đỏ (tối đa 20MB)
                  </p>
                </div>
                {isExtracting && (
                  <div className="text-xs font-mono text-emerald-400 animate-pulse pt-2">
                    AI đang tải và phân tích cấu trúc tài liệu...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GEMINI SETTINGS */}
          {activeTab === 'settings' && (
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-zinc-200">
                  Cấu hình Google Gemini AI Key (Đọc bản scan mộc đỏ)
                </h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Khi gặp các tệp PDF scan ảnh chụp mộc đỏ (không có lớp text máy tính), hệ thống sẽ dùng Gemini Multimodal Vision để đọc nhận diện chữ tiếng Việt. API Key được lưu trực tiếp an toàn trên trình duyệt của bạn.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-mono text-zinc-400 block">
                  Gemini API Key (Tạo miễn phí tại aistudio.google.com):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => handleSaveApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-300 shrink-0"
                  >
                    Lấy Key Free
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* REVIEW & CONFIRM FORM (HUMAN-IN-THE-LOOP VERIFICATION) */}
          {extracted && (
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-emerald-500/40 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                    Kết Quả AI Trích Xuất (Kiểm Tra Trước Khi Lưu)
                  </span>
                </div>
                <button
                  onClick={() => setExtracted(null)}
                  className="text-xs font-mono text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  Quét lại
                </button>
              </div>

              {/* Editable Fields */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">Mã Cổ Phiếu</label>
                  <input
                    type="text"
                    value={extracted.symbol}
                    onChange={(e) => setExtracted({ ...extracted, symbol: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">Kỳ Đại Hội (Năm)</label>
                  <input
                    type="text"
                    value={extracted.year}
                    onChange={(e) =>
                      setExtracted({
                        ...extracted,
                        year: e.target.value,
                        period: `ĐHĐCĐ ${e.target.value}`,
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-emerald-400 block mb-1 font-bold">
                    Tổng Số Cổ Đông Chốt VSDC (CĐ)
                  </label>
                  <input
                    type="number"
                    value={extracted.totalShareholders || ''}
                    onChange={(e) =>
                      setExtracted({ ...extracted, totalShareholders: parseInt(e.target.value, 10) || 0 })
                    }
                    placeholder="Nhập con số cổ đông..."
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-emerald-500/50 text-emerald-400 font-bold text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">Ngày Chốt Danh Sách VSDC</label>
                  <input
                    type="text"
                    value={extracted.recordDate || ''}
                    onChange={(e) => setExtracted({ ...extracted, recordDate: e.target.value })}
                    placeholder="YYYY-MM-DD"
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] text-zinc-500 block mb-1">Tên Văn Bản Gốc / Báo Cáo Đối Chứng</label>
                  <input
                    type="text"
                    value={extracted.sourceDoc}
                    onChange={(e) => setExtracted({ ...extracted, sourceDoc: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 font-sans text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Citation Snippet Quote */}
              {extracted.snippet && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 block">
                    Trích dẫn nguyên văn bằng chứng:
                  </span>
                  <p className="text-[11px] text-zinc-300 italic font-sans leading-relaxed">
                    &quot;{extracted.snippet}&quot;
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setExtracted(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono font-medium cursor-pointer transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfirmed}
                  disabled={isSaving || !extracted.totalShareholders}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-mono font-bold transition-all shadow-md cursor-pointer"
                >
                  {isSaving ? 'Đang lưu...' : 'Xác Nhận & Cập Nhật Biểu Đồ'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
