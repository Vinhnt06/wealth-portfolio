package com.yourfin.api.controller;

import com.yourfin.api.dto.MarketDataResponse;
import com.yourfin.api.service.BinanceClient;
import com.yourfin.api.service.YahooFinanceClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/market")
public class MarketController {

    private final BinanceClient binanceClient;
    private final YahooFinanceClient yahooFinanceClient;

    public MarketController(BinanceClient binanceClient, YahooFinanceClient yahooFinanceClient) {
        this.binanceClient = binanceClient;
        this.yahooFinanceClient = yahooFinanceClient;
    }

    @GetMapping("/crypto")
    public ResponseEntity<Map<String, Object>> getCryptoPrice(@RequestParam String symbols) {
        try {
            MarketDataResponse data = binanceClient.get24hrTicker(symbols);

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
        try {
            String symbol;
            if (gold) {
                symbol = "GC=F"; // Gold Futures
            } else if (silver) {
                symbol = "SI=F"; // Silver Futures
            } else {
                symbol = symbols;
            }

            MarketDataResponse data = yahooFinanceClient.getQuote(symbol);

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
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.ok(errorResponse);
        }
    }
}
