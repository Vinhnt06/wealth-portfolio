package com.yourfin.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourfin.api.dto.StockRsDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ForkJoinPool;
import java.util.stream.Collectors;

/**
 * Service tính toán và lưu trữ Sức mạnh giá RS Rating (1-99 Percentile) 
 * chuẩn IBD / Mark Minervini toàn thị trường chứng khoán Việt Nam.
 * 
 * Công thức trọng số William O'Neil / CANSLIM:
 * Raw RS = 40% * Q1 (63 phiên) + 20% * Q2 (126 phiên) + 20% * Q3 (189 phiên) + 20% * Q4 (252 phiên)
 * Xếp hạng toàn bộ rổ cổ phiếu và chuẩn hóa thành Percentile 1 - 99.
 */
@Service
public class StockRsRatingService {

    private static final Logger logger = LoggerFactory.getLogger(StockRsRatingService.class);

    // Rổ ~90 cổ phiếu thanh khoản cao nhất đại diện cho TTCK Việt Nam (VN30 + Top Midcaps)
    public static final List<String> UNIVERSE = List.of(
            // Ngân hàng
            "VCB", "BID", "CTG", "TCB", "MBB", "ACB", "VPB", "HDB", "STB", "SHB", "LPB", "TPB", "VIB", "MSB", "OCB", "EIB",
            // Chứng khoán
            "SSI", "VND", "VCI", "HCM", "MBS", "SHS", "FTS", "BSI", "CTS", "AGR",
            // Bất động sản & KCN
            "VHM", "VIC", "VRE", "KDH", "NLG", "PDR", "DXG", "DIG", "NVL", "CEO", "BCM", "KBC", "IDC", "SZC", "VGC",
            // Thép & Kim loại
            "HPG", "HSG", "NKG", "VGS", "TLH",
            // Dầu khí & Hóa chất
            "GAS", "PVD", "PVS", "BSR", "PLX", "PVT", "DGC", "DPM", "DCM", "BFC",
            // Bán lẻ & Tiêu dùng
            "MWG", "PNJ", "FRT", "DGW", "PET", "MSN", "VNM", "SAB", "KDC",
            // Công nghệ & Viễn thông
            "FPT", "CMG", "CTR", "ELC", "VGI",
            // Xây dựng, Hạ tầng & Năng lượng
            "VCG", "HHV", "CII", "FCN", "CTD", "POW", "REE", "PC1", "GEG", "HDG",
            // Thủy sản, Nông nghiệp, Cảng biển, Cao su
            "VHC", "ANV", "IDI", "DBC", "BAF", "HAG", "PAN", "GMD", "HAH", "VSC", "GVR", "DRC", "DPR", "PHR", "BMP"
    );

    private final Map<String, StockRsDto> rsCache = new ConcurrentHashMap<>();
    private final WebClient webClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final File cacheFile = new File("data/stock_rs_ratings.json");

    public StockRsRatingService() {
        this.webClient = WebClient.builder()
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(4 * 1024 * 1024))
                .build();
    }

    @PostConstruct
    public void init() {
        // Tải từ file cache đã lưu trước (nếu có) để phục vụ ngay
        loadFromFile();

        // Chạy ngầm tính toán cập nhật mới nếu cache trống hoặc đã sang ngày mới
        new Thread(() -> {
            try {
                Thread.sleep(3000); // Đợi hệ thống khởi động ổn định
                if (rsCache.isEmpty()) {
                    logger.info("RS Cache trống, tiến hành tính toán điểm RS Rating toàn thị trường...");
                    calculateAndSaveAllRsRatings();
                }
            } catch (Exception e) {
                logger.error("Lỗi khi chạy cập nhật RS Rating ban đầu: {}", e.getMessage());
            }
        }, "rs-rating-initializer").start();
    }

    /**
     * Lấy điểm RS Rating và thứ hạng của một cổ phiếu
     */
    public Optional<StockRsDto> getRsRating(String symbol) {
        if (symbol == null) return Optional.empty();
        return Optional.ofNullable(rsCache.get(symbol.toUpperCase().trim()));
    }

    /**
     * Lấy Top N cổ phiếu có RS Rating cao nhất thị trường (Bảng Vàng Minervini)
     */
    public List<StockRsDto> getTopRsStocks(int limit) {
        return rsCache.values().stream()
                .sorted(Comparator.comparingInt(StockRsDto::getRank))
                .limit(Math.max(1, Math.min(limit, 100)))
                .collect(Collectors.toList());
    }

    /**
     * Tự động chạy mỗi ngày sau phiên giao dịch (15h15 thứ 2 - thứ 6)
     */
    @Scheduled(cron = "0 15 15 * * MON-FRI", zone = "Asia/Ho_Chi_Minh")
    public void scheduledUpdate() {
        logger.info("Bắt đầu tác vụ tính toán RS Rating toàn thị trường sau phiên...");
        calculateAndSaveAllRsRatings();
    }

    /**
     * Tính toán toàn bộ Universe và ánh xạ thành Percentile chuẩn 1 - 99
     */
    public synchronized void calculateAndSaveAllRsRatings() {
        long startTime = System.currentTimeMillis();
        long nowSec = Instant.now().getEpochSecond();
        long fromSec = nowSec - 730 * 24 * 3600; // 2 năm dữ liệu

        List<RawStockPerf> rawList = Collections.synchronizedList(new ArrayList<>());
        ForkJoinPool customPool = new ForkJoinPool(8);

        try {
            customPool.submit(() -> UNIVERSE.parallelStream().forEach(sym -> {
                try {
                    String url = "https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from="
                            + fromSec + "&to=" + nowSec + "&symbol=" + sym + "&resolution=1D";

                    String response = webClient.get()
                            .uri(url)
                            .header("User-Agent", "Mozilla/5.0")
                            .retrieve()
                            .bodyToMono(String.class)
                            .timeout(Duration.ofSeconds(5))
                            .block();

                    if (response == null) return;
                    JsonNode root = objectMapper.readTree(response);
                    JsonNode closesNode = root.get("c");

                    if (closesNode != null && closesNode.isArray() && closesNode.size() >= 63) {
                        int count = closesNode.size();
                        double currentPrice = closesNode.get(count - 1).asDouble();

                        double q1 = getPerf(closesNode, count, 63, currentPrice);
                        double q2 = getPerf(closesNode, count, 126, currentPrice);
                        double q3 = getPerf(closesNode, count, 189, currentPrice);
                        double q4 = getPerf(closesNode, count, Math.min(252, count), currentPrice);

                        // Trọng số IBD Minervini chuẩn: 40% Q1 + 20% Q2 + 20% Q3 + 20% Q4
                        double rawScore = 0.4 * q1 + 0.2 * q2 + 0.2 * q3 + 0.2 * q4;

                        rawList.add(new RawStockPerf(sym, currentPrice, q1, q2, q3, q4, rawScore));
                    }
                } catch (Exception e) {
                    logger.debug("Lỗi khi tải nến cho {}: {}", sym, e.getMessage());
                }
            })).get();
        } catch (Exception e) {
            logger.error("Lỗi song song khi tính toán RS: {}", e.getMessage(), e);
        } finally {
            customPool.shutdown();
        }

        if (rawList.isEmpty()) {
            logger.warn("Không tải được dữ liệu cổ phiếu nào để xếp hạng RS.");
            return;
        }

        // Sắp xếp giảm dần theo điểm Raw Score (hiệu suất thực)
        rawList.sort((a, b) -> Double.compare(b.rawScore, a.rawScore));

        int total = rawList.size();
        LocalDate today = LocalDate.now();
        Map<String, StockRsDto> newCache = new HashMap<>();

        for (int i = 0; i < total; i++) {
            RawStockPerf item = rawList.get(i);
            int rank = i + 1; // 1-indexed (Rank 1 là mạnh nhất thị trường)

            // Ánh xạ thành Percentile chuẩn 1 - 99:
            // Rank 1 -> 99 điểm
            // Median -> ~50 điểm
            // Rank cuối -> 1 điểm
            int percentile;
            if (total == 1) {
                percentile = 50;
            } else {
                percentile = (int) Math.round(99.0 - ((double) (rank - 1) / (total - 1)) * 98.0);
            }
            percentile = Math.max(1, Math.min(99, percentile));

            StockRsDto dto = StockRsDto.builder()
                    .symbol(item.symbol)
                    .rsRating(percentile)
                    .rank(rank)
                    .totalStocks(total)
                    .rawScore(Math.round(item.rawScore * 1000.0) / 1000.0)
                    .q1Perf(Math.round(item.q1 * 1000.0) / 10.0)
                    .q2Perf(Math.round(item.q2 * 1000.0) / 10.0)
                    .q3Perf(Math.round(item.q3 * 1000.0) / 10.0)
                    .q4Perf(Math.round(item.q4 * 1000.0) / 10.0)
                    .currentPrice(item.currentPrice)
                    .calculatedDate(today)
                    .build();

            newCache.put(item.symbol, dto);
        }

        this.rsCache.clear();
        this.rsCache.putAll(newCache);
        saveToFile();

        logger.info("Hoàn thành tính toán RS Rating cho {} mã trong {} ms. Top 1: {} (RS 99)",
                total, (System.currentTimeMillis() - startTime),
                rawList.isEmpty() ? "N/A" : rawList.get(0).symbol);
    }

    private double getPerf(JsonNode closes, int count, int barsAgo, double currentPrice) {
        if (count <= barsAgo) return 0.0;
        double pastPrice = closes.get(count - barsAgo).asDouble();
        return pastPrice > 0 ? (currentPrice - pastPrice) / pastPrice : 0.0;
    }

    private void saveToFile() {
        try {
            if (!cacheFile.getParentFile().exists()) {
                cacheFile.getParentFile().mkdirs();
            }
            objectMapper.writeValue(cacheFile, rsCache);
        } catch (Exception e) {
            logger.warn("Không thể lưu cache RS ra file: {}", e.getMessage());
        }
    }

    private void loadFromFile() {
        try {
            if (cacheFile.exists()) {
                Map<String, StockRsDto> loaded = objectMapper.readValue(cacheFile,
                        objectMapper.getTypeFactory().constructMapType(HashMap.class, String.class, StockRsDto.class));
                if (loaded != null && !loaded.isEmpty()) {
                    this.rsCache.putAll(loaded);
                    logger.info("Đã tải {} mã RS Rating từ cache file {}", loaded.size(), cacheFile.getPath());
                }
            }
        } catch (Exception e) {
            logger.warn("Không thể đọc cache RS từ file: {}", e.getMessage());
        }
    }

    private static class RawStockPerf {
        final String symbol;
        final double currentPrice;
        final double q1;
        final double q2;
        final double q3;
        final double q4;
        final double rawScore;

        RawStockPerf(String symbol, double currentPrice, double q1, double q2, double q3, double q4, double rawScore) {
            this.symbol = symbol;
            this.currentPrice = currentPrice;
            this.q1 = q1;
            this.q2 = q2;
            this.q3 = q3;
            this.q4 = q4;
            this.rawScore = rawScore;
        }
    }
}
