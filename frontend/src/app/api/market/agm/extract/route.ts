import { NextRequest, NextResponse } from 'next/server';

interface ExtractedAgmData {
  symbol?: string;
  year?: string;
  period?: string;
  totalShareholders?: number;
  recordDate?: string;
  attendeesCount?: number;
  sourceDoc: string;
  snippet?: string;
  isScanned?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    let pdfBuffer: Buffer | null = null;
    let sourceDoc = 'Tài liệu ĐHĐCĐ';
    let symbol = 'CP';
    let geminiApiKey: string | undefined = undefined;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      symbol = (formData.get('symbol') as string) || symbol;
      geminiApiKey = (formData.get('geminiApiKey') as string) || process.env.GEMINI_API_KEY;

      if (!file) {
        return NextResponse.json({ success: false, error: 'Chưa tải lên tệp PDF' }, { status: 400 });
      }

      sourceDoc = file.name;
      pdfBuffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await req.json();
      const { pdfUrl, symbol: sym, geminiApiKey: key } = body;
      symbol = sym || symbol;
      geminiApiKey = key || process.env.GEMINI_API_KEY;

      if (!pdfUrl) {
        return NextResponse.json({ success: false, error: 'Thiếu đường dẫn tệp PDF (pdfUrl)' }, { status: 400 });
      }

      sourceDoc = decodeURIComponent(pdfUrl.split('/').pop() || 'Tài liệu ĐHĐCĐ.pdf');

      // Fetch PDF
      const pdfRes = await fetch(pdfUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      });

      if (!pdfRes.ok) {
        return NextResponse.json(
          { success: false, error: `Không thể tải tệp PDF (Mã lỗi: ${pdfRes.status})` },
          { status: 400 }
        );
      }

      pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      return NextResponse.json({ success: false, error: 'Tệp PDF rỗng' }, { status: 400 });
    }

    // 1. Try parsing text layer using pdf-parse
    let rawText = '';
    try {
      const { PDFParse } = await import('pdf-parse');
      const parser: any = new PDFParse({ data: pdfBuffer });
      if (typeof parser.load === 'function') {
        await parser.load();
      }
      const res = await parser.getText();
      rawText = typeof res === 'string' ? res : res.text || '';
    } catch (parseErr: any) {
      console.warn('PDFParse warning:', parseErr.message);
    }

    // Clean text
    const cleanText = rawText.replace(/\r/g, ' ').replace(/\t/g, ' ');
    const isTextReadable = cleanText.replace(/-- \d+ of \d+ --/g, '').trim().length > 120;

    // Detect Year from text or filename
    const yearMatch = `${sourceDoc} ${cleanText.slice(0, 3000)}`.match(/\b(202[0-6])\b/);
    const detectedYear = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

    // CASE A: Digital PDF with selectable text
    if (isTextReadable) {
      const extracted = extractFromText(cleanText, detectedYear, sourceDoc, symbol);
      return NextResponse.json({
        success: true,
        method: 'digital_text_heuristic',
        data: extracted,
      });
    }

    // CASE B: Scanned Image PDF (Pure scan like Taseco Land)
    // If user provided a Gemini API Key or env variable exists, call Gemini Multimodal Vision!
    if (geminiApiKey && geminiApiKey.trim().length > 10) {
      try {
        const geminiResult = await extractWithGemini(pdfBuffer, geminiApiKey.trim(), detectedYear, sourceDoc, symbol);
        return NextResponse.json({
          success: true,
          method: 'gemini_multimodal_vision',
          data: geminiResult,
        });
      } catch (geminiErr: any) {
        console.error('Gemini Vision error:', geminiErr);
        return NextResponse.json({
          success: true,
          isScanned: true,
          method: 'scanned_fallback',
          data: {
            symbol,
            year: detectedYear,
            period: `ĐHĐCĐ ${detectedYear}`,
            sourceDoc,
            snippet: `Lỗi gọi Gemini Vision: ${geminiErr.message}. Bạn có thể đối soát số lượng và nhập xác nhận trực tiếp.`,
          },
        });
      }
    }

    // Scanned document without Gemini key: return structured metadata so user can confirm
    return NextResponse.json({
      success: true,
      isScanned: true,
      method: 'scanned_prompt_key',
      data: {
        symbol,
        year: detectedYear,
        period: `ĐHĐCĐ ${detectedYear}`,
        sourceDoc,
        snippet:
          'Tài liệu này là bản scan hình ảnh có mộc đỏ. Bạn có thể nhập Gemini API Key để AI đọc tự động, hoặc mở xem file và nhập con số tổng cổ đông để lưu vào hệ thống.',
      },
    });
  } catch (error: any) {
    console.error('Extract Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi khi trích xuất tài liệu.' }, { status: 500 });
  }
}

// Regex & heuristic patterns for Vietnamese AGM documents
function extractFromText(text: string, year: string, sourceDoc: string, defaultSymbol: string): ExtractedAgmData {
  let totalShareholders: number | undefined;
  let attendeesCount: number | undefined;
  let recordDate: string | undefined;
  let snippet: string | undefined;

  // Patterns for Record Date (Ngày chốt danh sách)
  const dateRegex =
    /(?:chốt ngày|danh sách ngày|đăng ký cuối cùng ngày|tính đến ngày)\s+([0-3]?\d[\/\-\.][0-1]?\d[\/\-\.]202[0-6])/i;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    recordDate = dateMatch[1].replace(/[\/\.]/g, '-');
  }

  // Patterns for Total Shareholders (Tổng số cổ đông được triệu tập / theo danh sách VSDC)
  const totalPatterns = [
    /(?:tổng số cổ đông(?: được triệu tập| theo danh sách| có quyền biểu quyết)?|danh sách chốt[^:\n]{0,30})[:\s]+([\d\.,]+)/i,
    /(?:gồm|có)\s+([\d\.,]+)\s+cổ đông(?: có quyền biểu quyết| được triệu tập| chốt)/i,
    /tổng số người sở hữu chứng khoán[:\s]+([\d\.,]+)/i,
  ];

  for (const pat of totalPatterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const cleanNum = parseInt(m[1].replace(/[\.,\s]/g, ''), 10);
      if (cleanNum > 100 && cleanNum < 10_000_000) {
        totalShareholders = cleanNum;
        const idx = m.index || 0;
        snippet = text.slice(Math.max(0, idx - 40), Math.min(text.length, idx + 160)).trim();
        break;
      }
    }
  }

  // Patterns for Attendees (Số lượng cổ đông thực tế tham dự)
  const attendPatterns = [
    /(?:số cổ đông|cổ đông trực tiếp và ủy quyền|cổ đông tham dự|đại biểu tham dự)[:\s]+([\d\.,]+)/i,
  ];
  for (const pat of attendPatterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const cleanNum = parseInt(m[1].replace(/[\.,\s]/g, ''), 10);
      if (cleanNum > 0 && cleanNum < (totalShareholders || 1_000_000)) {
        attendeesCount = cleanNum;
        break;
      }
    }
  }

  return {
    symbol: defaultSymbol,
    year,
    period: `ĐHĐCĐ ${year}`,
    totalShareholders,
    attendeesCount,
    recordDate,
    sourceDoc,
    snippet: snippet || text.slice(0, 300),
  };
}

// Gemini Vision Extraction for Scanned PDFs
async function extractWithGemini(
  pdfBuffer: Buffer,
  apiKey: string,
  year: string,
  sourceDoc: string,
  symbol: string
): Promise<ExtractedAgmData> {
  // If file is very large (> 18MB), take first 15MB to avoid Gemini inline base64 limit
  const bufferToSend = pdfBuffer.length > 18 * 1024 * 1024 ? pdfBuffer.subarray(0, 15 * 1024 * 1024) : pdfBuffer;
  const base64Data = bufferToSend.toString('base64');

  const prompt = `
Bạn là chuyên viên kiểm toán tài chính phân tích biên bản Đại hội đồng cổ đông (ĐHĐCĐ) của công ty niêm yết tại Việt Nam.
Hãy đọc kỹ tệp tài liệu PDF đính kèm (có thể là bản scan ảnh mộc đỏ) và trích xuất đúng các thông tin pháp lý sau dưới định dạng JSON duy nhất (không bọc code block markdown thừa):
{
  "symbol": "${symbol}",
  "year": "${year}",
  "period": "ĐHĐCĐ ${year}",
  "totalShareholders": [Tổng số lượng cổ đông được triệu tập theo danh sách chốt sổ VSDC, dạng số nguyên. CỰC KỲ QUAN TRỌNG: Phân biệt rõ ràng với số lượng cổ đông thực tế có mặt tham dự họp],
  "attendeesCount": [Số lượng cổ đông thực tế có mặt tham dự trực tiếp hoặc ủy quyền, dạng số nguyên],
  "recordDate": [Ngày VSDC chốt danh sách cổ đông thực hiện quyền tham dự ĐHĐCĐ, định dạng YYYY-MM-DD],
  "sourceDoc": "${sourceDoc}",
  "citationSnippet": [Trích dẫn nguyên văn 1 hoặc 2 câu trong biên bản chứng minh cho con số tổng số cổ đông trên]
}
Chỉ trả về JSON thuần túy.
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'application/pdf',
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const json = await response.json();
  const textOutput = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new Error('Không nhận được phản hồi từ Gemini Vision.');
  }

  const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanJson);

  return {
    symbol: parsed.symbol || symbol,
    year: parsed.year || year,
    period: parsed.period || `ĐHĐCĐ ${year}`,
    totalShareholders: Number(parsed.totalShareholders) || undefined,
    attendeesCount: Number(parsed.attendeesCount) || undefined,
    recordDate: parsed.recordDate || undefined,
    sourceDoc: parsed.sourceDoc || sourceDoc,
    snippet: parsed.citationSnippet || undefined,
  };
}
