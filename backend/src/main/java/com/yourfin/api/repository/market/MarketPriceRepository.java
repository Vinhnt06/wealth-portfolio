package com.yourfin.api.repository.market;

import com.yourfin.api.model.asset.AssetType;
import com.yourfin.api.model.market.MarketPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MarketPriceRepository extends JpaRepository<MarketPrice, UUID> {

    Optional<MarketPrice> findTopBySymbolOrderByTimestampDesc(String symbol);

    List<MarketPrice> findBySymbolAndTimestampAfter(String symbol, LocalDateTime after);

    List<MarketPrice> findByTypeAndTimestampAfter(AssetType type, LocalDateTime after);

    void deleteByTimestampBefore(LocalDateTime before);
}
