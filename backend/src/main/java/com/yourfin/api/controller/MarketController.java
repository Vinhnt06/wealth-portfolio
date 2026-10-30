package com.yourfin.api.controller;

import com.yourfin.api.dto.MarketDataResponse;
import com.yourfin.api.service.BinanceClient;
import com.yourfin.api.service.YahooFinanceClient;
import com.yourfin.api.validation.ValidSymbol;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/market")
public class MarketController {

    private static final Logger logger = LoggerFactory.getLogger(MarketController.class);

    private final BinanceClient binanceClient;
    private final YahooFinanceClient yahooFinanceClient;
    private final com.yourfin.api.service.StockRsRatingService stockRsRatingService;

    public MarketController(BinanceClient binanceClient,
                            YahooFinanceClient yahooFinanceClient,
                            com.yourfin.api.service.StockRsRatingService stockRsRatingService) {
        this.binanceClient = binanceClient;
        this.yahooFinanceClient = yahooFinanceClient;
        this.stockRsRatingService = stockRsRatingService;
        logger.info("MarketController initialized");
    }

    @GetMapping("/crypto")
    public ResponseEntity<Map<String, Object>> getCryptoPrice(
            @RequestParam @ValidSymbol String symbols) {
        logger.info("Received crypto price request for symbol: {}", symbols);
        try {
            MarketDataResponse data = binanceClient.get24hrTicker(symbols);
            logger.info("Successfully fetched crypto data for {}: price=${}", symbols, data.getPrice());

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", Map.of(
                    "symbol", data.getSymbol(),
                    "price", data.getPrice(),
                    "change24h", data.getChange24h(),
                    "changePercent", data.getChangePercent(),
                    "volume", data.getVolume24h()));

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error fetching crypto data for {}: {}", symbols, e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.ok(errorResponse);
        }
    }

    @GetMapping("/stocks")
    public ResponseEntity<Map<String, Object>> getStockPrice(
            @RequestParam(required = false) String symbols,
            @RequestParam(required = false) boolean gold,
            @RequestParam(required = false) boolean silver) {
        logger.info("Received stock price request - symbols: {}, gold: {}, silver: {}", symbols, gold, silver);
        try {
            String symbol;
            if (gold) {
                symbol = "GC=F"; // Gold Futures
            } else if (silver) {
                symbol = "SI=F"; // Silver Futures
            } else {
                symbol = symbols;
            }

            logger.info("Fetching stock data for symbol: {}", symbol);
            MarketDataResponse data = yahooFinanceClient.getQuote(symbol);
            logger.info("Successfully fetched stock data for {}: price=${}", symbol, data.getPrice());

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", Map.of(
                    "symbol", data.getSymbol(),
                    "price", data.getPrice(),
                    "regularMarketPrice", data.getPrice(),
                    "change", data.getChange24h(),
                    "regularMarketChange", data.getChange24h(),
                    "changePercent", data.getChangePercent(),
                    "regularMarketChangePercent", data.getChangePercent()));

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error fetching stock data: {}", e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.ok(errorResponse);
        }
    }

    /**
     * Lấy điểm RS Rating chuẩn Percentile 1-99 toàn thị trường của 1 cổ phiếu
     */
    @GetMapping("/rs-rating/{symbol}")
    public ResponseEntity<Map<String, Object>> getStockRsRating(@PathVariable String symbol) {
        return stockRsRatingService.getRsRating(symbol)
                .map(dto -> {
                    Map<String, Object> res = new HashMap<>();
                    res.put("success", true);
                    res.put("data", dto);
                    return ResponseEntity.ok(res);
                })
                .orElseGet(() -> {
                    Map<String, Object> res = new HashMap<>();
                    res.put("success", false);
                    res.put("message", "Chưa có dữ liệu RS Rating cho mã " + symbol);
                    return ResponseEntity.ok(res);
                });
    }

    /**
     * Lấy danh sách Top cổ phiếu có RS Rating cao nhất thị trường (Bảng Vàng Minervini)
     */
    @GetMapping("/rs-rating/top")
    public ResponseEntity<Map<String, Object>> getTopRsStocks(@RequestParam(defaultValue = "30") int limit) {
        List<com.yourfin.api.dto.StockRsDto> topList = stockRsRatingService.getTopRsStocks(limit);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("count", topList.size());
        res.put("data", topList);
        return ResponseEntity.ok(res);
    }

    /**
     * Yêu cầu tính toán lại toàn bộ điểm RS Rating thị trường ngay lập tức
     */
    @PostMapping("/rs-rating/refresh")
    public ResponseEntity<Map<String, Object>> refreshRsRatings() {
        new Thread(stockRsRatingService::calculateAndSaveAllRsRatings, "rs-rating-manual-refresh").start();
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Đã kích hoạt tác vụ tính toán RS Rating ngầm");
        return ResponseEntity.ok(res);
    }
}
