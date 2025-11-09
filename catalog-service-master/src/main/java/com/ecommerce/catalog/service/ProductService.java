package com.ecommerce.catalog.service;

import com.ecommerce.catalog.dto.PagedResponse;
import com.ecommerce.catalog.dto.PriceUpdateRequest;
import com.ecommerce.catalog.dto.ProductRequest;
import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.entity.Product;
import com.ecommerce.catalog.exception.DuplicateResourceException;
import com.ecommerce.catalog.exception.ResourceNotFoundException;
import com.ecommerce.catalog.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductService {

    private final ProductRepository productRepository;

    @Transactional
    public ProductResponse createProduct(ProductRequest request) {
        log.info("Creating product with SKU: {}", request.getSku());

        if (productRepository.existsBySku(request.getSku())) {
            throw new DuplicateResourceException("Product with SKU " + request.getSku() + " already exists");
        }

        Product product = new Product();
        product.setSku(request.getSku());
        product.setName(request.getName());
        product.setCategory(request.getCategory());
        product.setPrice(request.getPrice());
        product.setIsActive(request.getIsActive() != null ? request.getIsActive() : true);

        Product savedProduct = productRepository.save(product);
        log.info("Product created successfully with ID: {}", savedProduct.getProductId());

        return ProductResponse.fromEntity(savedProduct);
    }

    @Transactional(readOnly = true)
    public ProductResponse getProductById(Long productId) {
        log.info("Fetching product with ID: {}", productId);
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with ID: " + productId));
        return ProductResponse.fromEntity(product);
    }

    @Transactional(readOnly = true)
    public ProductResponse getProductBySku(String sku) {
        log.info("Fetching product with SKU: {}", sku);
        Product product = productRepository.findBySku(sku)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with SKU: " + sku));
        return ProductResponse.fromEntity(product);
    }

    @Transactional(readOnly = true)
    public PagedResponse<ProductResponse> getAllProducts(int page, int size, String sortBy, String sortDir) {
        log.info("Fetching all products - page: {}, size: {}, sortBy: {}, sortDir: {}", page, size, sortBy, sortDir);

        Sort sort = sortDir.equalsIgnoreCase("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<ProductResponse> productPage = productRepository.findAll(pageable)
                .map(ProductResponse::fromEntity);

        return PagedResponse.of(productPage);
    }

    @Transactional(readOnly = true)
    public PagedResponse<ProductResponse> searchProducts(String keyword, int page, int size) {
        log.info("Searching products with keyword: {}", keyword);

        Pageable pageable = PageRequest.of(page, size, Sort.by("name").ascending());
        Page<ProductResponse> productPage = productRepository.searchProducts(keyword, pageable)
                .map(ProductResponse::fromEntity);

        return PagedResponse.of(productPage);
    }

    @Transactional(readOnly = true)
    public PagedResponse<ProductResponse> filterProducts(String category, Boolean isActive, int page, int size) {
        log.info("Filtering products - category: {}, isActive: {}", category, isActive);

        Pageable pageable = PageRequest.of(page, size, Sort.by("name").ascending());
        Page<ProductResponse> productPage = productRepository.findByFilters(category, isActive, pageable)
                .map(ProductResponse::fromEntity);

        return PagedResponse.of(productPage);
    }

    @Transactional
    public ProductResponse updateProduct(Long productId, ProductRequest request) {
        log.info("Updating product with ID: {}", productId);

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with ID: " + productId));

        if (!product.getSku().equals(request.getSku()) && productRepository.existsBySku(request.getSku())) {
            throw new DuplicateResourceException("Product with SKU " + request.getSku() + " already exists");
        }

        product.setSku(request.getSku());
        product.setName(request.getName());
        product.setCategory(request.getCategory());
        product.setPrice(request.getPrice());
        product.setIsActive(request.getIsActive());

        Product updatedProduct = productRepository.save(product);
        log.info("Product updated successfully with ID: {}", updatedProduct.getProductId());

        return ProductResponse.fromEntity(updatedProduct);
    }

    @Transactional
    public ProductResponse updatePrice(Long productId, PriceUpdateRequest request) {
        log.info("Updating price for product with ID: {} to {}", productId, request.getPrice());

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with ID: " + productId));

        product.setPrice(request.getPrice());
        Product updatedProduct = productRepository.save(product);

        log.info("Price updated successfully for product ID: {}", productId);
        return ProductResponse.fromEntity(updatedProduct);
    }

    @Transactional
    public void activateProduct(Long productId) {
        log.info("Activating product with ID: {}", productId);

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with ID: " + productId));

        product.setIsActive(true);
        productRepository.save(product);

        log.info("Product activated successfully with ID: {}", productId);
    }

    @Transactional
    public void deactivateProduct(Long productId) {
        log.info("Deactivating product with ID: {}", productId);

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with ID: " + productId));

        product.setIsActive(false);
        productRepository.save(product);

        log.info("Product deactivated successfully with ID: {}", productId);
    }

    @Transactional
    public void deleteProduct(Long productId) {
        log.info("Deleting product with ID: {}", productId);

        if (!productRepository.existsById(productId)) {
            throw new ResourceNotFoundException("Product not found with ID: " + productId);
        }

        productRepository.deleteById(productId);
        log.info("Product deleted successfully with ID: {}", productId);
    }

    @Transactional(readOnly = true)
    public BigDecimal getProductPrice(Long productId) {
        log.info("Fetching price for product with ID: {}", productId);
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with ID: " + productId));
        return product.getPrice();
    }

    @Transactional
    public Map<Long, BigDecimal> getProductPrices(List<Long> productIds) {
        return productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(Product::getProductId, Product::getPrice));
    }

}
