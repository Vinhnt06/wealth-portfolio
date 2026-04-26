package com.yourfin.api.dto;

import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class UpdateAssetRequest {

    @Positive(message = "Quantity must be positive")
    private Double quantity;

    @Positive(message = "Average buy price must be positive")
    private Double avgBuyPrice;

    private String name;
}
