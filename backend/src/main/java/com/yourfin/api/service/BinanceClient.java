package com.yourfin.api.service;

import com.yourfin.api.dto.MarketDataResponse;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Service
public class BinanceClient {

    private final WebClient webClient;

    public BinanceClient(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder
                .baseUrl("https://api.binance.com")
                .build();
    }

    /**
     * Get 24hr ticker data from Binance
     * Cached for 15 seconds
     */
    @Cacheable(value = "cryptoPrices", key = "#symbol")
    public MarketDataResponse get24hrTicker(String symbol) {
        try {
            BinanceTickerResponse response = webClient.get()
                    .uri("/api/v3/ticker/24hr?symbol={symbol}", symbol)
                    .retrieve()
                    .bodyToMono(BinanceTickerResponse.class)
                    .block();

            if (response == null) {
                throw new RuntimeException("Failed to fetch data from Binance");
            }

            return new MarketDataResponse(
                    response.getSymbol(),
                    Double.parseDouble(response.getLastPrice()),
                    Double.parseDouble(response.getPriceChange()),
                    Double.parseDouble(response.getPriceChangePercent()),
                    Double.parseDouble(response.getVolume()),
                    System.currentTimeMillis());
        } catch (Exception e) {
            throw new RuntimeException("Error fetching Binance data for " + symbol + ": " + e.getMessage());
        }
    }

    // Inner class for Binance API response
    @lombok.Data
    private static class BinanceTickerResponse {
        private String symbol;
        private String lastPrice;
        private String priceChange;
        private String priceChangePercent;
        private String volume;
    }
}
