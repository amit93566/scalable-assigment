package com.ecommerce.catalog.dto;

import com.ecommerce.catalog.entity.Product;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductResponse {

    private Long productId;
    private String sku;
    private String name;
    private String category;
    private BigDecimal price;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ProductResponse fromEntity(Product product) {
        return ProductResponse.builder()
                .productId(product.getProductId())
                .sku(product.getSku())
                .name(product.getName())
                .category(product.getCategory())
                .price(product.getPrice())
                .isActive(product.getIsActive())
                .createdAt(product.getCreatedAt())
                .updatedAt(product.getUpdatedAt())
                .build();
    }
}
