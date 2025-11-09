package com.ecommerce.catalog.controller;

import com.ecommerce.catalog.dto.PagedResponse;
import com.ecommerce.catalog.dto.PriceUpdateRequest;
import com.ecommerce.catalog.dto.ProductRequest;
import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.service.ProductService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/v1/products")
@RequiredArgsConstructor
@Tag(name = "Catalog Service", description = "Product catalog management APIs")
public class ProductController {

    private final ProductService productService;

    @Operation(summary = "Create a new product")
    @PostMapping
    public ResponseEntity<ProductResponse> createProduct(@Valid @RequestBody ProductRequest request) {
        ProductResponse response = productService.createProduct(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "Get product by ID")
    @GetMapping("/{productId}")
    public ResponseEntity<ProductResponse> getProductById(@PathVariable Long productId) {
        ProductResponse response = productService.getProductById(productId);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get product by SKU")
    @GetMapping("/sku/{sku}")
    public ResponseEntity<ProductResponse> getProductBySku(@PathVariable String sku) {
        ProductResponse response = productService.getProductBySku(sku);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get all products")
    @GetMapping
    public ResponseEntity<PagedResponse<ProductResponse>> getAllProducts(
            @RequestParam(defaultValue = "0" +
                    "") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        PagedResponse<ProductResponse> response = productService.getAllProducts(page, size, sortBy, sortDir);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Search products")
    @GetMapping("/search")
    public ResponseEntity<PagedResponse<ProductResponse>> searchProducts(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PagedResponse<ProductResponse> response = productService.searchProducts(keyword, page, size);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Filter products")
    @GetMapping("/filter")
    public ResponseEntity<PagedResponse<ProductResponse>> filterProducts(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PagedResponse<ProductResponse> response = productService.filterProducts(category, isActive, page, size);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Update product")
    @PutMapping("/{productId}")
    public ResponseEntity<ProductResponse> updateProduct(
            @PathVariable Long productId,
            @Valid @RequestBody ProductRequest request) {
        ProductResponse response = productService.updateProduct(productId, request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Update product price")
    @PatchMapping("/{productId}/price")
    public ResponseEntity<ProductResponse> updatePrice(
            @PathVariable Long productId,
            @Valid @RequestBody PriceUpdateRequest request) {
        ProductResponse response = productService.updatePrice(productId, request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get product price")
    @GetMapping("/{productId}/price")
    public ResponseEntity<BigDecimal> getProductPrice(@PathVariable Long productId) {
        BigDecimal price = productService.getProductPrice(productId);
        return ResponseEntity.ok(price);
    }

    @Operation(summary = "Get prices for multiple products")
    @GetMapping("/prices")
    public ResponseEntity<Map<Long, BigDecimal>> getProductPrices(@RequestParam List<Long> productIds) {
        Map<Long, BigDecimal> prices = productService.getProductPrices(productIds);
        return ResponseEntity.ok(prices);
    }

    @Operation(summary = "Activate product")
    @PatchMapping("/{productId}/activate")
    public ResponseEntity<Void> activateProduct(@PathVariable Long productId) {
        productService.activateProduct(productId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Deactivate product")
    @PatchMapping("/{productId}/deactivate")
    public ResponseEntity<Void> deactivateProduct(@PathVariable Long productId) {
        productService.deactivateProduct(productId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Delete product")
    @DeleteMapping("/{productId}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long productId) {
        productService.deleteProduct(productId);
        return ResponseEntity.noContent().build();
    }
}
