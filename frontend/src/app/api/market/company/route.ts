import { NextResponse } from 'next/server';
import companyProfiles from '../../../../features/market/data/companyProfiles.json';
import stockDatabase from '../../../../features/market/data/stockDatabase.json';

export const runtime = 'nodejs';

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

interface Shareholder {
  name: string;
  shares_owned: number;
  ownership_percentage: number;
  update_date?: string;
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase().trim();

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

    const [vciShareholdersRes, vciDetailsRes, finfoProfileRes, vciFinancialsRes] = await Promise.allSettled([
      fetch(`https://iq.vietcap.com.vn/api/iq-insight-service/v1/company/${symbol}/shareholder`, {
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

    let rawVciShareholders: any[] = [];
    if (vciShareholdersRes.status === 'fulfilled' && vciShareholdersRes.value.ok) {
      const json = await vciShareholdersRes.value.json();
      if (json.successful && Array.isArray(json.data)) {
        rawVciShareholders = json.data;
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
        // Find latest record with valid PE or PB
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

      // Major shareholder or meaningful stake
      if (ownershipPct >= 0.1 || shares > 100000) {
        shareholders.push({
          name,
          shares_owned: shares,
          ownership_percentage: ownershipPct,
          update_date: item.publicDate || undefined,
        });
      }

      // Officer / Board member
      if (item.positionName && item.positionName.trim() !== '') {
        officers.push({
          name,
          owner_code: item.positionName,
          position: item.positionName,
          from_date: item.publicDate ? String(item.publicDate).slice(0, 4) : undefined,
        });
      }
    });

    // Fallback: If Vietcap had no shareholders, try Finfo shareholders endpoint
    if (shareholders.length === 0) {
      try {
        const finfoShareRes = await fetch(`https://api-finfo.vndirect.com.vn/v4/shareholders?q=code:${symbol}`);
        if (finfoShareRes.ok) {
          const sJson = await finfoShareRes.json();
          if (Array.isArray(sJson.data)) {
            sJson.data.forEach((s: any) => {
              if (s.shareholderName) {
                const pct = Number(s.ownershipPct || 0);
                shareholders.push({
                  name: s.shareholderName,
                  shares_owned: Number(s.numberOfShares || 0),
                  ownership_percentage: Number(pct.toFixed(2)),
                  update_date: s.effectiveDate || undefined,
                });
              }
            });
          }
        }
      } catch {
        // Ignore fallback error
      }
    }

    // If snapshot has pre-curated full officers and live API returned empty officers, use snapshot officers
    const curatedProfile = profilesMap[symbol];
    if (officers.length === 0 && curatedProfile?.officers && curatedProfile.officers.length > 0) {
      officers.push(...curatedProfile.officers);
    }
    if (shareholders.length === 0 && curatedProfile?.shareholders && curatedProfile.shareholders.length > 0) {
      shareholders.push(...curatedProfile.shareholders);
    }

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
      shareholders: shareholders.slice(0, 15),
      officers: officers.slice(0, 15),
      financials,
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
    };

    return NextResponse.json({
      success: true,
      source: 'unverified_clean_fallback',
      data: emptyFallback,
    });
  }
}
