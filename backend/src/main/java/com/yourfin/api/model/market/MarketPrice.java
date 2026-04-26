package com.yourfin.api.model.market;

import com.yourfin.api.model.asset.AssetType;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "market_prices", indexes = {
        @Index(name = "idx_symbol_timestamp", columnList = "symbol, timestamp")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MarketPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 50)
    private String symbol;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private AssetType type;

    private Double price;

    private Double change24h;

    private Double changePercent;

    private Double volume24h;

    private Double marketCap;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime timestamp;
}
