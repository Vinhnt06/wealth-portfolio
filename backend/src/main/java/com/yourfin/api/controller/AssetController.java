package com.yourfin.api.controller;

import com.yourfin.api.dto.CreateAssetRequest;
import com.yourfin.api.dto.PortfolioSummary;
import com.yourfin.api.dto.UpdateAssetRequest;
import com.yourfin.api.model.asset.Asset;
import com.yourfin.api.model.user.User;
import com.yourfin.api.service.AssetService;
import com.yourfin.api.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/assets")
public class AssetController {

    private final AssetService assetService;
    private final UserService userService;

    public AssetController(AssetService assetService, UserService userService) {
        this.assetService = assetService;
        this.userService = userService;
    }

    /**
     * Get all assets for current user
     */
    @GetMapping
    public ResponseEntity<List<Asset>> getUserAssets() {
        User currentUser = userService.getCurrentUser();
        List<Asset> assets = assetService.getUserAssets(currentUser.getId());
        return ResponseEntity.ok(assets);
    }

    /**
     * Get portfolio summary with P/L calculations
     */
    @GetMapping("/portfolio")
    public ResponseEntity<PortfolioSummary> getPortfolioSummary() {
        User currentUser = userService.getCurrentUser();
        PortfolioSummary summary = assetService.getPortfolioSummary(currentUser.getId());
        return ResponseEntity.ok(summary);
    }

    /**
     * Get single asset
     */
    @GetMapping("/{id}")
    public ResponseEntity<Asset> getAsset(@PathVariable UUID id) {
        Asset asset = assetService.getAsset(id);
        return ResponseEntity.ok(asset);
    }

    /**
     * Create new asset
     */
    @PostMapping
    public ResponseEntity<Asset> createAsset(@Valid @RequestBody CreateAssetRequest request) {
        User currentUser = userService.getCurrentUser();

        Asset asset = Asset.builder()
                .type(request.getType())
                .symbol(request.getSymbol())
                .name(request.getName())
                .quantity(request.getQuantity())
                .avgBuyPrice(request.getAvgBuyPrice())
                .build();

        Asset created = assetService.createAsset(currentUser.getId(), asset);
        return ResponseEntity.ok(created);
    }

    /**
     * Update asset
     */
    @PutMapping("/{id}")
    public ResponseEntity<Asset> updateAsset(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAssetRequest request) {

        Asset updates = Asset.builder()
                .quantity(request.getQuantity())
                .avgBuyPrice(request.getAvgBuyPrice())
                .name(request.getName())
                .build();

        Asset updated = assetService.updateAsset(id, updates);
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete asset
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAsset(@PathVariable UUID id) {
        assetService.deleteAsset(id);
        return ResponseEntity.noContent().build();
    }
}
