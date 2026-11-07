import { NextRequest, NextResponse } from 'next/server';

interface PortalItem {
  title: string;
  url: string;
  type: 'AGM_PAGE' | 'IR_PORTAL' | 'ARCHIVE';
  priority: number;
}

export async function POST(req: NextRequest) {
  try {
    const { symbol } = await req.json();

    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Mã cổ phiếu không hợp lệ' },
        { status: 400 }
      );
    }

    const cleanSymbol = symbol.toUpperCase().trim();

    // 1. Fetch real company profile from Finfo VNDirect API
    let companyName = `Công ty ${cleanSymbol}`;
    let website = '';

    try {
      const finfoRes = await fetch(
        `https://api-finfo.vndirect.com.vn/v4/company_profiles?q=code:${cleanSymbol}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
          next: { revalidate: 3600 },
        }
      );

      if (finfoRes.ok) {
        const json = await finfoRes.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          companyName = json.data[0].companyName || companyName;
          website = json.data[0].website || '';
        }
      }
    } catch (e: any) {
      console.warn(`[search-portal] Warning fetching Finfo for ${cleanSymbol}:`, e?.message);
    }

    // Fallback: Check local company endpoint if website is still missing
    if (!website) {
      try {
        const localRes = await fetch(
          `http://localhost:3000/api/market/company?symbol=${cleanSymbol}`,
          { next: { revalidate: 3600 } }
        );
        if (localRes.ok) {
          const localJson = await localRes.json();
          website = localJson.data?.info?.website || '';
          companyName = localJson.data?.info?.business_model || companyName;
        }
      } catch (e: any) {
        // local fallback failure non-fatal
      }
    }

    if (website && !website.startsWith('http://') && !website.startsWith('https://')) {
      website = `http://${website}`;
    }

    const portals: PortalItem[] = [];
    const seenUrls = new Set<string>();

    // 2. If company has official website, crawl homepage navigation for IR/AGM links
    if (website) {
      try {
        const res = await fetch(website, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
          },
          signal: AbortSignal.timeout(6500),
        });

        if (res.ok) {
          const finalUrl = res.url || website;
          const parsedUrl = new URL(finalUrl);
          const baseUrl = parsedUrl.origin;
          const html = await res.text();

          const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
          let match;

          while ((match = linkRegex.exec(html)) !== null) {
            const rawHref = match[1].trim();
            const rawText = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

            if (
              !rawHref ||
              rawHref.startsWith('#') ||
              rawHref.startsWith('javascript:') ||
              rawHref.startsWith('mailto:') ||
              rawHref.startsWith('tel:')
            ) {
              continue;
            }

            // Exclude overly long promo texts or paragraphs
            if (rawText.length > 50) continue;

            let fullUrl = rawHref;
            if (rawHref.startsWith('//')) {
              fullUrl = `${parsedUrl.protocol}${rawHref}`;
            } else if (rawHref.startsWith('/')) {
              fullUrl = `${baseUrl}${rawHref}`;
            } else if (!rawHref.startsWith('http')) {
              fullUrl = `${baseUrl}/${rawHref}`;
            }

            const cleanUrl = fullUrl.split('#')[0].replace(/\/+$/, '');
            if (seenUrls.has(cleanUrl)) continue;

            const lowerText = rawText.toLowerCase();
            const lowerUrl = cleanUrl.toLowerCase();

            // Ignore image files or assets
            if (/\.(png|jpg|jpeg|gif|svg|css|js)$/i.test(lowerUrl)) continue;

            const isAgm =
              /đại hội|dai-hoi|dhdcd|agm/i.test(lowerText) ||
              /dai-hoi|dhdcd|agm/i.test(lowerUrl);

            const isIr =
              /quan hệ cổ đông|quan-he-co-dong|quan hệ nhà đầu tư|quan-he-nha-dau-tu|công bố thông tin|cong-bo-thong-tin|báo cáo thường niên|bao-cao-thuong-nien|quan hệ|quan-he|cổ đông|co-dong|nhà đầu tư|nha-dau-tu|investor/i.test(
                lowerText
              ) || /quan-he|co-dong|nha-dau-tu|investor-relations|ir/i.test(lowerUrl);

            if (isAgm) {
              seenUrls.add(cleanUrl);
              portals.push({
                title: rawText || 'Trang Đại hội đồng cổ đông',
                url: cleanUrl,
                type: 'AGM_PAGE',
                priority: 1,
              });
            } else if (isIr && rawText.length >= 3) {
              seenUrls.add(cleanUrl);
              portals.push({
                title: rawText || 'Quan hệ cổ đông (IR)',
                url: cleanUrl,
                type: 'IR_PORTAL',
                priority: 2,
              });
            }
          }
        }
      } catch (err: any) {
        console.warn(`[search-portal] Crawling homepage failed for ${cleanSymbol}:`, err?.message);
      }
    }

    // 3. Fallback / Universal Archival Source (Vietstock AGM repository)
    const vietstockUrl = `https://finance.vietstock.vn/${cleanSymbol}/tai-lieu-hop-dhdcd.htm`;
    if (!seenUrls.has(vietstockUrl)) {
      portals.push({
        title: `Lưu trữ tài liệu ĐHĐCĐ Vietstock (${cleanSymbol})`,
        url: vietstockUrl,
        type: 'ARCHIVE',
        priority: 3,
      });
    }

    // Sort by priority (AGM_PAGE first, then IR_PORTAL, then ARCHIVE)
    portals.sort((a, b) => a.priority - b.priority);

    return NextResponse.json({
      success: true,
      symbol: cleanSymbol,
      companyName,
      website: website || null,
      portals: portals.slice(0, 6),
    });
  } catch (error: any) {
    console.error('[search-portal] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi khi tìm kiếm cổng thông tin QHCĐ' },
      { status: 500 }
    );
  }
}
