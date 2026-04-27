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

    List<Asset> findByUserId(String userId);

    List<Asset> findByUserIdAndType(String userId, AssetType type);

    Optional<Asset> findByUserIdAndSymbol(String userId, String symbol);

    boolean existsByUserIdAndSymbol(String userId, String symbol);
}
