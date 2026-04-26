package com.yourfin.api.service;

import com.yourfin.api.dto.PortfolioSummary;
import com.yourfin.api.model.asset.Asset;
import com.yourfin.api.model.asset.AssetType;
import com.yourfin.api.model.user.User;
import com.yourfin.api.repository.asset.AssetRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AssetService {

    private final AssetRepository assetRepository;
    private final UserService userService;

    public AssetService(AssetRepository assetRepository, UserService userService) {
        this.assetRepository = assetRepository;
        this.userService = userService;
    }

    /**
     * Get all assets for a user
     */
    public List<Asset> getUserAssets(UUID userId) {
        return assetRepository.findByUserId(userId);
    }

    /**
     * Get assets by type
     */
    public List<Asset> getUserAssetsByType(UUID userId, AssetType type) {
        return assetRepository.findByUserIdAndType(userId, type);
    }

    /**
     * Get single asset
     */
    public Asset getAsset(UUID assetId) {
        return assetRepository.findById(assetId)
                .orElseThrow(() -> new RuntimeException("Asset not found"));
    }

    /**
     * Create new asset
     */
    @Transactional
    public Asset createAsset(UUID userId, Asset asset) {
        User user = userService.getUserById(userId);

        // Check if asset already exists
        if (assetRepository.existsByUserIdAndSymbol(userId, asset.getSymbol())) {
            throw new RuntimeException("Asset with symbol " + asset.getSymbol() + " already exists");
        }

        asset.setUser(user);
        return assetRepository.save(asset);
    }

    /**
     * Update asset
     */
    @Transactional
    public Asset updateAsset(UUID assetId, Asset updates) {
        Asset asset = getAsset(assetId);

        // Update allowed fields
        if (updates.getQuantity() != null) {
            asset.setQuantity(updates.getQuantity());
        }
        if (updates.getAvgBuyPrice() != null) {
            asset.setAvgBuyPrice(updates.getAvgBuyPrice());
        }
        if (updates.getName() != null) {
            asset.setName(updates.getName());
        }

        return assetRepository.save(asset);
    }

    /**
     * Delete asset
     */
    @Transactional
    public void deleteAsset(UUID assetId) {
        Asset asset = getAsset(assetId);
        assetRepository.delete(asset);
    }

    /**
     * Calculate portfolio summary with current prices
     * Note: This is a placeholder. In Phase 4, we'll integrate real market data.
     */
    public PortfolioSummary getPortfolioSummary(UUID userId) {
        List<Asset> assets = getUserAssets(userId);

        // For now, use mock prices (will be replaced with real API calls in Phase 4)
        List<PortfolioSummary.AssetWithPrice> assetsWithPrices = assets.stream()
                .map(asset -> {
                    // TODO: Fetch real price from market data service
                    Double currentPrice = asset.getAvgBuyPrice() * 1.05; // Mock 5% gain

                    return new PortfolioSummary.AssetWithPrice(
                            asset.getId().toString(),
                            asset.getSymbol(),
                            asset.getName(),
                            asset.getType().toString(),
                            asset.getQuantity(),
                            asset.getAvgBuyPrice(),
                            currentPrice,
                            asset.calculateValue(currentPrice),
                            asset.calculateProfitLoss(currentPrice),
                            asset.calculateProfitLossPercent(currentPrice));
                })
                .collect(Collectors.toList());

        // Calculate totals
        Double totalValue = assetsWithPrices.stream()
                .mapToDouble(PortfolioSummary.AssetWithPrice::getCurrentValue)
                .sum();

        Double totalCost = assetsWithPrices.stream()
                .mapToDouble(a -> a.getQuantity() * a.getAvgBuyPrice())
                .sum();

        Double totalProfitLoss = totalValue - totalCost;
        Double totalProfitLossPercent = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0.0;

        return new PortfolioSummary(
                totalValue,
                totalCost,
                totalProfitLoss,
                totalProfitLossPercent,
                assets.size(),
                assetsWithPrices);
    }
}
