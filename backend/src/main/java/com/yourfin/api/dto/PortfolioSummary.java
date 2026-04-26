package com.yourfin.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PortfolioSummary {
    private Double totalValue;
    private Double totalCost;
    private Double totalProfitLoss;
    private Double totalProfitLossPercent;
    private Integer assetCount;
    private List<AssetWithPrice> assets;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssetWithPrice {
        private String id;
        private String symbol;
        private String name;
        private String type;
        private Double quantity;
        private Double avgBuyPrice;
        private Double currentPrice;
        private Double currentValue;
        private Double profitLoss;
        private Double profitLossPercent;
    }
}
