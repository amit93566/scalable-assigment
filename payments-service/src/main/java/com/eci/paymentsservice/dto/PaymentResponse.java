package com.eci.paymentservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentResponse {
    private Long paymentId;
    private String orderId;   // ✅ FIXED: was Long earlier
    private Double amount;
    private String method;
    private String currency;
    private String status;
    private OffsetDateTime processedAt;
}

