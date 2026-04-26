package com.yourfin.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MarketDataResponse {
    private String symbol;
    private Double price;
    private Double change24h;
    private Double changePercent;
    private Double volume24h;
    private Long timestamp;
}
