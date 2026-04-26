package com.yourfin.api.repository.asset;

import com.yourfin.api.model.asset.Asset;
import com.yourfin.api.model.asset.AssetType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AssetRepository extends JpaRepository<Asset, UUID> {

    List<Asset> findByUserId(UUID userId);

    List<Asset> findByUserIdAndType(UUID userId, AssetType type);

    Optional<Asset> findByUserIdAndSymbol(UUID userId, String symbol);

    boolean existsByUserIdAndSymbol(UUID userId, String symbol);
}
