import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL không hợp lệ. Vui lòng cung cấp link trang quan hệ cổ đông.' },
        { status: 400 }
      );
    }

    const parsedUrl = new URL(url);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    // Fetch HTML page with realistic browser User-Agent
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Không thể truy cập trang web (Mã phản hồi: ${res.status})` },
        { status: 400 }
      );
    }

    const html = await res.text();

    // 1. Extract all <a> tags with href
    const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    const rawPdfDocs: PdfDocItem[] = [];
    const subPages: SubPageItem[] = [];
    const seenUrls = new Set<string>();

    const priorityKeywords = [
      'biên bản',
      'bien ban',
      'nghị quyết',
      'nghi quyet',
      'tư cách',
      'tu cach',
      'đại hội',
      'dhdcd',
      'báo cáo thường niên',
      'bao cao thuong nien',
    ];

    while ((match = linkRegex.exec(html)) !== null) {
      const rawHref = match[1].trim();
      const rawText = match[2].replace(/<[^>]+>/g, '').trim();

      if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('#')) {
        continue;
      }

      // Resolve relative URL
      let fullUrl = rawHref;
      if (rawHref.startsWith('//')) {
        fullUrl = `${parsedUrl.protocol}${rawHref}`;
      } else if (rawHref.startsWith('/')) {
        fullUrl = `${baseUrl}${rawHref}`;
      } else if (!rawHref.startsWith('http')) {
        fullUrl = `${baseUrl}/${rawHref}`;
      }

      if (seenUrls.has(fullUrl)) continue;
      seenUrls.add(fullUrl);

      const lowerUrl = fullUrl.toLowerCase();
      const lowerText = rawText.toLowerCase();

      // Check if it is a PDF file
      if (lowerUrl.includes('.pdf')) {
        const title = rawText || fullUrl.split('/').pop() || 'Tài liệu ĐHĐCĐ PDF';
        const isPriority = priorityKeywords.some(
          (k) => lowerText.includes(k) || lowerUrl.includes(k.replace(/\s+/g, '-'))
        );

        // Try extracting year (2020 - 2026)
        const yearMatch = `${rawText} ${fullUrl}`.match(/\b(202[0-6])\b/);
        const year = yearMatch ? yearMatch[1] : undefined;

        rawPdfDocs.push({
          title,
          url: fullUrl,
          year,
          isPriority,
        });
      } else if (
        // Sub-pages like /dai-hoi-dong-co-dong-nam-2024-...
        priorityKeywords.some((k) => lowerText.includes(k) || lowerUrl.includes(k.replace(/\s+/g, '-')))
      ) {
        const yearMatch = `${rawText} ${fullUrl}`.match(/\b(202[0-6])\b/);
        const year = yearMatch ? yearMatch[1] : undefined;
        subPages.push({
          title: rawText || 'Kỳ ĐHĐCĐ',
          url: fullUrl,
          year,
        });
      }
    }

    // Sort PDF docs: priority files (Biên bản / Nghị quyết) first, then by year desc
    rawPdfDocs.sort((a, b) => {
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;
      const yA = parseInt(a.year || '0', 10);
      const yB = parseInt(b.year || '0', 10);
      return yB - yA;
    });

    return NextResponse.json({
      success: true,
      url,
      foundPdfsCount: rawPdfDocs.length,
      documents: rawPdfDocs,
      subPages: subPages.slice(0, 10),
    });
  } catch (error: any) {
    console.error('Crawl Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi khi quét liên kết từ trang web.' },
      { status: 500 }
    );
  }
}
