/*package com.eci.paymentservice.dto;

import lombok.*;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentRequest {
    private String orderId;
    private BigDecimal amount;
    private String currency;
    private String paymentMethod;
    private String idempotencyKey;
}
*/


package com.eci.paymentservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.*;
import java.time.OffsetDateTime;

/**
 * DTO used when Orders service requests a payment to be processed.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentRequest {
    private Long orderId;
    private String orderIdRaw;   // when upstream uses string ids
    private Double amount;
    private String method;
    private String currency;
    private OffsetDateTime requestedAt;
    private Map<String,String> metadata; // optional
}

