package com.yourfin.api.model.asset;

import com.yourfin.api.model.user.User;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "assets", indexes = {
        @Index(name = "idx_user_id", columnList = "user_id"),
        @Index(name = "idx_symbol", columnList = "symbol")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Asset {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AssetType type;

    @Column(nullable = false, length = 50)
    private String symbol;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private Double quantity;

    @Column(nullable = false)
    private Double avgBuyPrice;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    // Helper method to calculate current value (requires current price)
    public Double calculateValue(Double currentPrice) {
        return quantity * currentPrice;
    }

    // Helper method to calculate profit/loss
    public Double calculateProfitLoss(Double currentPrice) {
        return (currentPrice - avgBuyPrice) * quantity;
    }

    // Helper method to calculate profit/loss percentage
    public Double calculateProfitLossPercent(Double currentPrice) {
        if (avgBuyPrice == 0)
            return 0.0;
        return ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
    }
}
