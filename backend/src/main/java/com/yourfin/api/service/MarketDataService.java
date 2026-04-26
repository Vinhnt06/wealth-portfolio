package com.yourfin.api.service;

import com.yourfin.api.dto.MarketDataResponse;
import com.yourfin.api.model.asset.AssetType;
import com.yourfin.api.model.market.MarketPrice;
import com.yourfin.api.repository.market.MarketPriceRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
public class MarketDataService {

    private final BinanceClient binanceClient;
    private final YahooFinanceClient yahooFinanceClient;
    private final MarketPriceRepository marketPriceRepository;

    public MarketDataService(BinanceClient binanceClient,
            YahooFinanceClient yahooFinanceClient,
            MarketPriceRepository marketPriceRepository) {
        this.binanceClient = binanceClient;
        this.yahooFinanceClient = yahooFinanceClient;
        this.marketPriceRepository = marketPriceRepository;
    }

    /**
     * Get current price for any symbol
     * Automatically routes to correct API based on asset type
     */
    public Double getCurrentPrice(String symbol, AssetType type) {
        try {
            MarketDataResponse data = getMarketData(symbol, type);

            // Save to cache
            saveToCache(symbol, type, data);

            return data.getPrice();
        } catch (Exception e) {
            // Fallback to database cache
            return getPriceFromCache(symbol);
        }
    }

    /**
     * Get full market data for a symbol
     */
    public MarketDataResponse getMarketData(String symbol, AssetType type) {
        switch (type) {
            case CRYPTO:
                return binanceClient.get24hrTicker(symbol);

            case STOCK_US:
            case STOCK_VN:
            case GOLD:
            case SILVER:
                return yahooFinanceClient.getQuote(symbol);

            default:
                throw new RuntimeException("Unsupported asset type: " + type);
        }
    }

    /**
     * Get multiple prices at once
     */
    public Map<String, Double> getBatchPrices(Map<String, AssetType> symbolsWithTypes) {
        Map<String, Double> prices = new HashMap<>();

        symbolsWithTypes.forEach((symbol, type) -> {
            try {
                prices.put(symbol, getCurrentPrice(symbol, type));
            } catch (Exception e) {
                // Use cached price or 0
                prices.put(symbol, getPriceFromCache(symbol));
            }
        });

        return prices;
    }

    /**
     * Save market data to database cache
     */
    private void saveToCache(String symbol, AssetType type, MarketDataResponse data) {
        MarketPrice marketPrice = MarketPrice.builder()
                .symbol(symbol)
                .type(type)
                .price(data.getPrice())
                .change24h(data.getChange24h())
                .changePercent(data.getChangePercent())
                .volume24h(data.getVolume24h())
                .build();

        marketPriceRepository.save(marketPrice);
    }

    /**
     * Get price from database cache (fallback)
     */
    private Double getPriceFromCache(String symbol) {
        return marketPriceRepository.findTopBySymbolOrderByTimestampDesc(symbol)
                .map(MarketPrice::getPrice)
                .orElse(0.0);
    }

    /**
     * Clean old cache entries (older than 24 hours)
     */
    public void cleanOldCache() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(24);
        marketPriceRepository.deleteByTimestampBefore(cutoff);
    }
}
