package com.yourfin.api.dto;

import com.yourfin.api.model.asset.AssetType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class CreateAssetRequest {

    @NotNull(message = "Asset type is required")
    private AssetType type;

    @NotBlank(message = "Symbol is required")
    private String symbol;

    @NotBlank(message = "Name is required")
    private String name;

    @NotNull(message = "Quantity is required")
    @Positive(message = "Quantity must be positive")
    private Double quantity;

    @NotNull(message = "Average buy price is required")
    @Positive(message = "Average buy price must be positive")
    private Double avgBuyPrice;
}
