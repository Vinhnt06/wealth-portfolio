package com.yourfin.api.service;

import com.yourfin.api.dto.MarketDataResponse;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

@Service
public class YahooFinanceClient {

    private final WebClient webClient;

    public YahooFinanceClient(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder
                .baseUrl("https://query1.finance.yahoo.com")
                .build();
    }

    /**
     * Get quote data from Yahoo Finance
     * Cached for 15 seconds
     */
    @Cacheable(value = "stockPrices", key = "#symbol")
    public MarketDataResponse getQuote(String symbol) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = webClient.get()
                    .uri("/v8/finance/chart/{symbol}?interval=1d&range=1d", symbol)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null || !response.containsKey("chart")) {
                throw new RuntimeException("Invalid response from Yahoo Finance");
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> chart = (Map<String, Object>) response.get("chart");
            @SuppressWarnings("unchecked")
            List<?> results = (List<?>) chart.get("result");
            @SuppressWarnings("unchecked")
            Map<String, Object> result = (Map<String, Object>) results.get(0);
            @SuppressWarnings("unchecked")
            Map<String, Object> meta = (Map<String, Object>) result.get("meta");

            double price = ((Number) meta.get("regularMarketPrice")).doubleValue();
            double prevClose = meta.containsKey("chartPreviousClose")
                    ? ((Number) meta.get("chartPreviousClose")).doubleValue()
                    : meta.containsKey("previousClose")
                            ? ((Number) meta.get("previousClose")).doubleValue()
                            : price;

            double change = price - prevClose;
            double changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

            // Override with API values if available
            if (meta.containsKey("regularMarketChange")) {
                change = ((Number) meta.get("regularMarketChange")).doubleValue();
            }
            if (meta.containsKey("regularMarketChangePercent")) {
                changePercent = ((Number) meta.get("regularMarketChangePercent")).doubleValue();
            }

            return new MarketDataResponse(
                    symbol,
                    price,
                    change,
                    changePercent,
                    meta.containsKey("regularMarketVolume") ? ((Number) meta.get("regularMarketVolume")).doubleValue()
                            : 0.0,
                    System.currentTimeMillis());
        } catch (Exception e) {
            throw new RuntimeException("Error fetching Yahoo Finance data for " + symbol + ": " + e.getMessage());
        }
    }
}
