/**
 * Tiện ích kiểm tra phiên giao dịch thị trường chứng khoán Việt Nam (HOSE, HNX, UPCoM)
 * Khung giờ giao dịch chuẩn múi giờ Việt Nam (UTC+7):
 * - Thứ 2 đến Thứ 6
 *   + Phiên sáng: 09:00 - 11:30 (09:00 - 09:15 ATO)
 *   + Nghỉ trưa: 11:30 - 13:00
 *   + Phiên chiều: 13:00 - 14:45 (14:30 - 14:45 ATC, 14:45 - 15:00 PLO)
 * - Thứ 7 & Chủ Nhật: Đóng cửa cuối tuần
 */

export interface MarketSessionInfo {
  isOpen: boolean;
  isWeekend: boolean;
  isLunchBreak: boolean;
  sessionName: string;
  sessionBadge: string;
  nextSessionText: string;
}

export function getMarketSessionInfo(): MarketSessionInfo {
  const now = new Date();
  // Chuyển sang múi giờ Việt Nam UTC+7
  const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(vnTimeStr);
  const day = vnDate.getDay(); // 0: Chủ Nhật, 6: Thứ Bảy
  const hours = vnDate.getHours();
  const minutes = vnDate.getMinutes();
  const timeVal = hours * 60 + minutes;

  // Cuối tuần
  if (day === 0 || day === 6) {
    return {
      isOpen: false,
      isWeekend: true,
      isLunchBreak: false,
      sessionName: 'Thị trường đóng cửa (Nghỉ cuối tuần)',
      sessionBadge: 'KẾT THÚC PHIÊN (Cuối tuần)',
      nextSessionText: 'Mở phiên tiếp theo: 09:00 sáng Thứ Hai',
    };
  }

  // Thứ 2 đến Thứ 6
  if (timeVal < 9 * 60) {
    return {
      isOpen: false,
      isWeekend: false,
      isLunchBreak: false,
      sessionName: 'Chưa vào phiên giao dịch',
      sessionBadge: 'CHƯA MỞ PHIÊN',
      nextSessionText: 'Mở phiên ATO lúc 09:00 hôm nay',
    };
  } else if (timeVal >= 9 * 60 && timeVal < 11 * 60 + 30) {
    return {
      isOpen: true,
      isWeekend: false,
      isLunchBreak: false,
      sessionName: 'Phiên Sáng (Đang giao dịch trực tiếp)',
      sessionBadge: 'ĐANG GIAO DỊCH (Phiên Sáng)',
      nextSessionText: 'Nghỉ trưa lúc 11:30',
    };
  } else if (timeVal >= 11 * 60 + 30 && timeVal < 13 * 60) {
    return {
      isOpen: false,
      isWeekend: false,
      isLunchBreak: true,
      sessionName: 'Nghỉ trưa giữa hai phiên (11:30 - 13:00)',
      sessionBadge: 'NGHỈ TRƯA',
      nextSessionText: 'Mở phiên chiều lúc 13:00',
    };
  } else if (timeVal >= 13 * 60 && timeVal < 14 * 60 + 45) {
    return {
      isOpen: true,
      isWeekend: false,
      isLunchBreak: false,
      sessionName: timeVal >= 14 * 60 + 30 ? 'Phiên ATC Đóng Cửa' : 'Phiên Chiều (Đang giao dịch trực tiếp)',
      sessionBadge: timeVal >= 14 * 60 + 30 ? 'PHIÊN ATC' : 'ĐANG GIAO DỊCH (Phiên Chiều)',
      nextSessionText: 'Đóng cửa phiên lúc 14:45',
    };
  } else {
    return {
      isOpen: false,
      isWeekend: false,
      isLunchBreak: false,
      sessionName: 'Đã kết thúc phiên hôm nay',
      sessionBadge: 'KẾT THÚC PHIÊN',
      nextSessionText: 'Mở phiên tiếp theo: 09:00 sáng ngày làm việc tới',
    };
  }
}
