package com.yourfin.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockRsDto {
    private String symbol;
    private Integer rsRating;      // 1 - 99 true market percentile
    private Integer rank;          // 1 .. totalStocks
    private Integer totalStocks;
    private Double rawScore;
    private Double q1Perf;         // Last 63 sessions
    private Double q2Perf;         // 63 - 126 sessions
    private Double q3Perf;         // 126 - 189 sessions
    private Double q4Perf;         // 189 - 252 sessions
    private Double currentPrice;
    private LocalDate calculatedDate;
}
