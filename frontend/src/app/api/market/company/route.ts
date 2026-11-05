import { NextResponse } from 'next/server';
import companyProfiles from '../../../../features/market/data/companyProfiles.json';
import stockDatabase from '../../../../features/market/data/stockDatabase.json';
import totalShareholdersHistoryData from '../../../../features/market/data/totalShareholdersHistory.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'sin1';

interface CompanyInfo {
  business_model?: string;
  symbol: string;
  founded_date?: string;
  charter_capital?: number;
  number_of_employees?: number;
  listing_date?: string;
  exchange?: string;
  ceo_name?: string | null;
  ceo_position?: string | null;
  tax_id?: string | null;
  auditor?: string | null;
  address?: string | null;
  website?: string | null;
  history?: string | null;
  outstanding_shares?: number;
  unverified?: boolean;
}

export interface Shareholder {
  name: string;
  shares_owned: number;
  ownership_percentage: number;
  update_date?: string;
  owner_type?: 'INDIVIDUAL' | 'CORPORATE';
  position?: string;
  is_major?: boolean;
  is_insider?: boolean;
}

export interface TotalShareholdersSnapshot {
  year: string;
  period: string;
  totalShareholders: number;
  changeFromPrev: number;
  changePercent: number;
}

export interface ShareholderStructure {
  totalShares: number;
  statePercentage: number;
  stateVolume: number;
  foreignPercentage: number;
  foreignerVolume: number;
  maximumForeignPercentage: number;
  bodPercentage: number;
  institutionPercentage: number;
  otherPercentage: number;
  otherVolume: number;
  freeFloat: number;
  freeFloatPercentage: number;
  concentrationLevel: 'CÔ ĐẶC CAO' | 'CƠ CẤU CÂN BẰNG' | 'ĐA SỞ HỮU';
  breakdown: Array<{
    id: string;
    label: string;
    percentage: number;
    volume: number;
    color: string;
  }>;
  historicalSnapshots?: Array<{
    date: string;
    majorHoldersPct: number;
    freeFloatPct: number;
    shareholderRecorded: number;
  }>;
  totalShareholdersHistory?: TotalShareholdersSnapshot[];
  totalShareholdersCurrent?: number;
}

interface Officer {
  name: string;
  owner_code: string;
  from_date?: string;
  position?: string;
}

interface FinancialRatios {
  pe?: number | null;
  pb?: number | null;
  roe?: number | null;
  roa?: number | null;
  year?: string | null;
  quarter?: number | null;
}

const STOCK_META_MAP = new Map<string, any>();
(stockDatabase as any[]).forEach((s) => {
  STOCK_META_MAP.set(s.symbol.toUpperCase().trim(), s);
});

// Cache for live fetched company data (10 minutes)
const liveCompanyCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

import { isMarketIndex, getMarketIndexMeta } from '../../../../features/market/constants/marketIndexes';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase().trim();

  // If queried symbol is a market index, return index overview metadata instead of company data
  if (isMarketIndex(symbol)) {
    const idxMeta = getMarketIndexMeta(symbol) || {
      symbol,
      name: `Chỉ số ${symbol}`,
      exchange: symbol.includes('HNX') ? 'HNX' : symbol === 'UPCOM' ? 'UPCOM' : 'HOSE',
      sector: 'Chỉ số thị trường',
    };
    return NextResponse.json({
      success: true,
      source: 'market_index',
      data: {
        symbol,
        info: {
          symbol,
          business_model: `${idxMeta.name} là chỉ số phản ánh biến động thị trường của rổ cổ phiếu niêm yết trên sàn ${idxMeta.exchange}.`,
          exchange: idxMeta.exchange,
          isIndex: true,
        },
        shareholders: [],
        officers: [],
        financials: {},
      },
    });
  }

  // 1. Check verified curated snapshot in companyProfiles.json
  const profilesMap = (companyProfiles as unknown) as Record<
    string,
    { symbol: string; info: CompanyInfo; shareholders: Shareholder[]; officers: Officer[]; financials?: FinancialRatios }
  >;

  // 2. Check in-memory live cache
  const cached = liveCompanyCache.get(symbol);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({
      success: true,
      source: 'live_cache',
      data: cached.data,
    });
  }

  // 3. Fetch from REAL official APIs (Vietcap IQ & VNDirect Finfo)
  try {
    const meta = STOCK_META_MAP.get(symbol) || {
      symbol,
      name: `Công ty ${symbol}`,
      exchange: 'HOSE',
      sector: 'Doanh nghiệp niêm yết',
    };

    const [vciShareholdersRes, vciStructureRes, vciDetailsRes, finfoProfileRes, vciFinancialsRes, finfoShareholdersRes] = await Promise.allSettled([
      fetch(`https://iq.vietcap.com.vn/api/iq-insight-service/v1/company/${symbol}/shareholder`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://iq.vietcap.com.vn',
          'Referer': 'https://iq.vietcap.com.vn/',
        },
        next: { revalidate: 600 },
      }),
      fetch(`https://iq.vietcap.com.vn/api/iq-insight-service/v1/company/${symbol}/shareholder-structure`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://iq.vietcap.com.vn',
          'Referer': 'https://iq.vietcap.com.vn/',
        },
        next: { revalidate: 600 },
      }),
      fetch(`https://iq.vietcap.com.vn/api/iq-insight-service/v1/company/details?ticker=${symbol}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://iq.vietcap.com.vn',
          'Referer': 'https://iq.vietcap.com.vn/',
        },
        next: { revalidate: 600 },
      }),
      fetch(`https://api-finfo.vndirect.com.vn/v4/company_profiles?q=code:${symbol}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        next: { revalidate: 600 },
      }),
      fetch(`https://iq.vietcap.com.vn/api/iq-insight-service/v1/company/${symbol}/statistics-financial`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://iq.vietcap.com.vn',
          'Referer': 'https://iq.vietcap.com.vn/',
        },
        next: { revalidate: 600 },
      }),
      fetch(`https://api-finfo.vndirect.com.vn/v4/shareholders?q=code:${symbol}&size=100`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        next: { revalidate: 600 },
      }),
    ]);

    let finfoData: any = null;
    if (finfoProfileRes.status === 'fulfilled' && finfoProfileRes.value.ok) {
      const json = await finfoProfileRes.value.json();
      if (Array.isArray(json.data) && json.data.length > 0) {
        finfoData = json.data[0];
      }
    }

    let vciDetails: any = null;
    if (vciDetailsRes.status === 'fulfilled' && vciDetailsRes.value.ok) {
      const json = await vciDetailsRes.value.json();
      if (json.successful && json.data) {
        vciDetails = json.data;
      }
    }

    let rawVciStructure: any = null;
    if (vciStructureRes.status === 'fulfilled' && vciStructureRes.value.ok) {
      const json = await vciStructureRes.value.json();
      if (json.successful && json.data) {
        rawVciStructure = json.data;
      }
    }

    let rawVciShareholders: any[] = [];
    if (vciShareholdersRes.status === 'fulfilled' && vciShareholdersRes.value.ok) {
      const json = await vciShareholdersRes.value.json();
      if (json.successful && Array.isArray(json.data)) {
        rawVciShareholders = json.data;
      }
    }

    let rawFinfoShareholders: any[] = [];
    if (finfoShareholdersRes.status === 'fulfilled' && finfoShareholdersRes.value.ok) {
      const json = await finfoShareholdersRes.value.json();
      if (Array.isArray(json.data)) {
        rawFinfoShareholders = json.data;
      }
    }

    // Parse real financial ratios
    let financials: FinancialRatios = {
      pe: null,
      pb: null,
      roe: null,
      roa: null,
      year: null,
      quarter: null,
    };

    if (vciFinancialsRes.status === 'fulfilled' && vciFinancialsRes.value.ok) {
      const json = await vciFinancialsRes.value.json();
      if (json.successful && Array.isArray(json.data) && json.data.length > 0) {
        const validList = json.data.filter((d: any) => typeof d.pe === 'number' || typeof d.pb === 'number');
        const latest = validList.length > 0 ? validList[validList.length - 1] : json.data[json.data.length - 1];
        if (latest) {
          financials = {
            pe: typeof latest.pe === 'number' ? Number(latest.pe.toFixed(2)) : null,
            pb: typeof latest.pb === 'number' ? Number(latest.pb.toFixed(2)) : null,
            roe: typeof latest.roe === 'number' ? Number((latest.roe * 100).toFixed(2)) : null,
            roa: typeof latest.roa === 'number' ? Number((latest.roa * 100).toFixed(2)) : null,
            year: latest.year ? String(latest.year) : null,
            quarter: typeof latest.quarter === 'number' ? latest.quarter : null,
          };
        }
      }
    }

    // Extract real major shareholders
    const shareholders: Shareholder[] = [];
    const officers: Officer[] = [];

    rawVciShareholders.forEach((item) => {
      const name = item.ownerName || item.ownerNameEn || '';
      if (!name) return;

      const rawPct = Number(item.percentage || 0);
      const ownershipPct = rawPct <= 1 && rawPct > 0 ? Number((rawPct * 100).toFixed(2)) : Number(rawPct.toFixed(2));
      const shares = Number(item.quantity || 0);
      const pos = item.positionName && item.positionName.trim() !== '' ? item.positionName.trim() : undefined;
      const ownerType = item.ownerType === 'CORPORATE' ? 'CORPORATE' : 'INDIVIDUAL';

      // Major shareholder or meaningful stake
      if (ownershipPct >= 0.05 || shares > 50000) {
        shareholders.push({
          name,
          shares_owned: shares,
          ownership_percentage: ownershipPct,
          owner_type: ownerType,
          position: pos,
          is_major: ownershipPct >= 5.0,
          is_insider: Boolean(pos),
          update_date: item.publicDate || (item.updateDate ? item.updateDate.split('T')[0] : undefined),
        });
      }

      // Officer / Board member
      if (pos) {
        officers.push({
          name,
          owner_code: pos,
          position: pos,
          from_date: item.publicDate ? String(item.publicDate).slice(0, 4) : undefined,
        });
      }
    });

    // Fallback: If Vietcap had no shareholders, use Finfo
    if (shareholders.length === 0 && rawFinfoShareholders.length > 0) {
      rawFinfoShareholders.forEach((s: any) => {
        if (s.shareholderName) {
          const pct = Number(s.ownershipPct || 0);
          shareholders.push({
            name: s.shareholderName,
            shares_owned: Number(s.numberOfShares || 0),
            ownership_percentage: Number(pct.toFixed(2)),
            owner_type: s.shareholderType === 'COMPANY' ? 'CORPORATE' : 'INDIVIDUAL',
            position: s.roleType || undefined,
            is_major: pct >= 5.0,
            is_insider: Boolean(s.roleType),
            update_date: s.effectiveDate || undefined,
          });
        }
      });
    }

    // Build timeline snapshots of historical ownership from real filings (Finfo + Vietcap)
    const byPeriod: Record<string, { totalPct: number; count: number; totalShares: number }> = {};

    // 1. Ingest historical filings from VNDirect Finfo
    rawFinfoShareholders.forEach((s: any) => {
      const rawDate = s.effectiveDate || '';
      if (!rawDate) return;
      const periodKey = rawDate.slice(0, 7); // YYYY-MM
      if (!byPeriod[periodKey]) {
        byPeriod[periodKey] = { totalPct: 0, count: 0, totalShares: 0 };
      }
      const pct = Number(s.ownershipPct || 0);
      const sh = Number(s.numberOfShares || 0);
      byPeriod[periodKey].totalPct += pct;
      byPeriod[periodKey].totalShares += sh;
      byPeriod[periodKey].count += 1;
    });

    // 2. Ingest latest filing from Vietcap if available
    if (rawVciShareholders.length > 0) {
      const vciDates = rawVciShareholders
        .map((x) => (x.publicDate || x.updateDate || '').slice(0, 7))
        .filter(Boolean);
      const latestVciDate = vciDates.sort().reverse()[0] || 'Hiện Tại';

      let vciTotalPct = 0;
      let vciTotalShares = 0;
      rawVciShareholders.forEach((item) => {
        const rawPct = Number(item.percentage || 0);
        const ownershipPct = rawPct <= 1 && rawPct > 0 ? rawPct * 100 : rawPct;
        vciTotalPct += ownershipPct;
        vciTotalShares += Number(item.quantity || 0);
      });

      // Update or add latest period from Vietcap verified data
      byPeriod[latestVciDate] = {
        totalPct: vciTotalPct,
        count: rawVciShareholders.length,
        totalShares: vciTotalShares,
      };
    }

    // Sort chronologically and format
    const historicalSnapshots = Object.keys(byPeriod)
      .sort()
      .map((d) => ({
        date: d,
        majorHoldersPct: Number(Math.min(100, byPeriod[d].totalPct).toFixed(2)),
        freeFloatPct: Number(Math.max(0, 100 - byPeriod[d].totalPct).toFixed(2)),
        shareholderRecorded: byPeriod[d].count,
      }));

    // Calculate Comprehensive Shareholder Structure
    const totalShares = Number(rawVciStructure?.totalShares || vciDetails?.issueShare || 0);
    const statePct = Number(rawVciStructure?.statePercentage ?? vciDetails?.statePercentage ?? 0) * 100;
    const foreignPct = Number(rawVciStructure?.foreignPercentage ?? vciDetails?.foreignerPercentage ?? 0) * 100;
    const maxForeignPct = Number(vciDetails?.maximumForeignPercentage ?? 0.49) * 100;
    const bodPct = Number(rawVciStructure?.bodPercentage ?? 0) * 100;
    const instPct = Number(rawVciStructure?.institutionPercentage ?? 0) * 100;
    const freeFloatPct = Number(vciDetails?.freeFloatPercentage ? vciDetails.freeFloatPercentage * 100 : (rawVciStructure?.otherPercentage ? rawVciStructure.otherPercentage * 100 : 50));
    const freeFloatShares = Number(vciDetails?.freeFloat || rawVciStructure?.otherVolume || Math.round((totalShares * freeFloatPct) / 100));

    let concentrationLevel: 'CÔ ĐẶC CAO' | 'CƠ CẤU CÂN BẰNG' | 'ĐA SỞ HỮU' = 'CƠ CẤU CÂN BẰNG';
    if (freeFloatPct <= 25 || (statePct + bodPct + foreignPct) >= 75) {
      concentrationLevel = 'CÔ ĐẶC CAO';
    } else if (freeFloatPct >= 60) {
      concentrationLevel = 'ĐA SỞ HỮU';
    }

    const structureBreakdown = [
      { id: 'state', label: 'Nhà nước', percentage: Number(statePct.toFixed(2)), volume: Number(rawVciStructure?.stateVolume || Math.round((totalShares * statePct) / 100)), color: '#38bdf8' },
      { id: 'foreign', label: 'Khối ngoại', percentage: Number(foreignPct.toFixed(2)), volume: Number(rawVciStructure?.foreignerVolume || Math.round((totalShares * foreignPct) / 100)), color: '#10b981' },
      { id: 'bod', label: 'Ban Lãnh Đạo & HĐQT', percentage: Number(bodPct.toFixed(2)), volume: Math.round((totalShares * bodPct) / 100), color: '#f59e0b' },
      { id: 'institution', label: 'Tổ chức trong nước', percentage: Number(instPct.toFixed(2)), volume: Math.round((totalShares * instPct) / 100), color: '#2563eb' },
      { id: 'freefloat', label: 'Cổ đông nhỏ lẻ (Trôi nổi)', percentage: Number(freeFloatPct.toFixed(2)), volume: freeFloatShares, color: '#71717a' },
    ].filter((b) => b.percentage > 0 || b.volume > 0);

    // Extract real total shareholders history from verified ĐHĐCĐ & VSD filings
    const totalShareholdersHistoryList: TotalShareholdersSnapshot[] = (totalShareholdersHistoryData as Record<string, TotalShareholdersSnapshot[]>)[symbol] || [];
    const latestTotalShareholders = totalShareholdersHistoryList.length > 0
      ? totalShareholdersHistoryList[totalShareholdersHistoryList.length - 1].totalShareholders
      : undefined;

    const shareholderStructure: ShareholderStructure = {
      totalShares,
      statePercentage: Number(statePct.toFixed(2)),
      stateVolume: Number(rawVciStructure?.stateVolume || Math.round((totalShares * statePct) / 100)),
      foreignPercentage: Number(foreignPct.toFixed(2)),
      foreignerVolume: Number(rawVciStructure?.foreignerVolume || Math.round((totalShares * foreignPct) / 100)),
      maximumForeignPercentage: Number(maxForeignPct.toFixed(2)),
      bodPercentage: Number(bodPct.toFixed(2)),
      institutionPercentage: Number(instPct.toFixed(2)),
      otherPercentage: Number(freeFloatPct.toFixed(2)),
      otherVolume: freeFloatShares,
      freeFloat: freeFloatShares,
      freeFloatPercentage: Number(freeFloatPct.toFixed(2)),
      concentrationLevel,
      breakdown: structureBreakdown,
      historicalSnapshots,
      totalShareholdersHistory: totalShareholdersHistoryList,
      totalShareholdersCurrent: latestTotalShareholders,
    };


    // If snapshot has pre-curated full officers and live API returned empty officers, use snapshot officers
    const curatedProfile = profilesMap[symbol];
    if (officers.length === 0 && curatedProfile?.officers && curatedProfile.officers.length > 0) {
      officers.push(...curatedProfile.officers);
    }
    if (shareholders.length === 0 && curatedProfile?.shareholders && curatedProfile.shareholders.length > 0) {
      shareholders.push(...curatedProfile.shareholders);
    }

    // Sort shareholders by ownership percentage descending
    shareholders.sort((a, b) => (b.ownership_percentage || 0) - (a.ownership_percentage || 0));

    // CEO discovery from officers
    const ceoOfficer = officers.find((o) =>
      o.owner_code.toLowerCase().includes('tổng giám đốc') ||
      o.owner_code.toLowerCase().includes('giám đốc điều hành') ||
      o.owner_code.toLowerCase().includes('ceo')
    );

    const outstandingShares = vciDetails?.issueShare || finfoData?.shares || curatedProfile?.info?.outstanding_shares || undefined;
    const charterCap = outstandingShares ? Math.round((outstandingShares * 10) / 1000000) : (curatedProfile?.info?.charter_capital || undefined);

    const companyInfo: CompanyInfo = {
      symbol,
      business_model: finfoData?.vnSummary || curatedProfile?.info?.business_model || vciDetails?.overview || `Công ty niêm yết thuộc nhóm ${meta.sector} trên sàn ${meta.exchange}.`,
      founded_date: finfoData?.foundDate || curatedProfile?.info?.founded_date || undefined,
      charter_capital: charterCap,
      number_of_employees: finfoData?.employees || curatedProfile?.info?.number_of_employees || undefined,
      listing_date: finfoData?.listingDate || curatedProfile?.info?.listing_date || undefined,
      exchange: finfoData?.floor || curatedProfile?.info?.exchange || meta.exchange,
      ceo_name: ceoOfficer ? ceoOfficer.name : (curatedProfile?.info?.ceo_name || null),
      ceo_position: ceoOfficer ? ceoOfficer.owner_code : (curatedProfile?.info?.ceo_position || null),
      tax_id: finfoData?.taxCode || curatedProfile?.info?.tax_id || null,
      address: finfoData?.vnAddress || curatedProfile?.info?.address || null,
      website: finfoData?.website || curatedProfile?.info?.website || null,
      history: finfoData?.vnSummary || curatedProfile?.info?.history || null,
      outstanding_shares: outstandingShares,
      unverified: !finfoData && !vciDetails && shareholders.length === 0,
    };

    const finalData = {
      symbol,
      info: companyInfo,
      shareholders, // full list of verified real shareholders
      officers: officers.slice(0, 20),
      financials,
      shareholderStructure,
    };

    // Cache valid responses
    liveCompanyCache.set(symbol, {
      data: finalData,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json({
      success: true,
      source: 'live_vietcap_finfo',
      data: finalData,
    });
  } catch (error) {
    // STRICT ZERO MOCK DATA RULE:
    // If all real sources fail, return empty list with clear unverified message.
    const meta = STOCK_META_MAP.get(symbol) || {
      symbol,
      name: `Công ty ${symbol}`,
      exchange: 'HOSE',
      sector: 'Doanh nghiệp niêm yết',
    };

    const emptyFallback = {
      symbol,
      info: {
        symbol,
        business_model: `Dữ liệu hồ sơ doanh nghiệp ${symbol} đang được cập nhật từ cổng thông tin chứng khoán.`,
        exchange: meta.exchange,
        unverified: true,
      },
      shareholders: [],
      officers: [],
      financials: { pe: null, pb: null, roe: null, roa: null, year: null, quarter: null },
      shareholderStructure: null,
    };

    return NextResponse.json({
      success: true,
      source: 'unverified_clean_fallback',
      data: emptyFallback,
    });
  }
}

