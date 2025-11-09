package com.eci.paymentservice.service.impl;

import com.eci.paymentservice.dto.PaymentRequest;
import com.eci.paymentservice.dto.PaymentResponse;
import com.eci.paymentservice.model.Payment;
import com.eci.paymentservice.repository.PaymentRepository;
import com.eci.paymentservice.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentServiceImpl implements PaymentService {

    private final PaymentRepository paymentRepository;

    @Override
    public PaymentResponse createPayment(PaymentRequest paymentRequest) {
        log.info("Creating payment for order {}", paymentRequest.getOrderId());

        // ✅ Ensure types match model: orderId as String, amount as BigDecimal
        String orderIdStr = String.valueOf(paymentRequest.getOrderId());
        BigDecimal amount = BigDecimal.valueOf(paymentRequest.getAmount());

        Payment payment = Payment.builder()
                .orderId(orderIdStr)
                .amount(amount)
                .currency(paymentRequest.getCurrency())
                .paymentMethod(paymentRequest.getMethod())
                .status("SUCCESS")
                .createdAt(OffsetDateTime.now())
                .build();

        Payment saved = paymentRepository.save(payment);

        // ✅ Return PaymentResponse with String orderId (not Long)
        return PaymentResponse.builder()
                .paymentId(saved.getPaymentId())
                .orderId(saved.getOrderId()) // ✅ String now matches
                .amount(saved.getAmount().doubleValue())
                .currency(saved.getCurrency())
                .method(saved.getPaymentMethod())
                .status(saved.getStatus())
                .processedAt(saved.getCreatedAt())
                .build();
    }

    @Override
    public List<PaymentResponse> getPaymentByOrderId(String orderId) {
        // ✅ Repository lookup uses String orderId
        return paymentRepository.findByOrderId(orderId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public List<PaymentResponse> getAllPayments() {
        return paymentRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private PaymentResponse mapToResponse(Payment p) {
        return PaymentResponse.builder()
                .paymentId(p.getPaymentId())
                .orderId(p.getOrderId()) // ✅ String → String
                .amount(p.getAmount() != null ? p.getAmount().doubleValue() : 0.0)
                .currency(p.getCurrency())
                .method(p.getPaymentMethod())
                .status(p.getStatus())
                .processedAt(p.getCreatedAt())
                .build();
    }
}

