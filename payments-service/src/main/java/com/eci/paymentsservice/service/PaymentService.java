/*package com.eci.paymentservice.service;

import com.eci.paymentservice.dto.PaymentRequest;
import com.eci.paymentservice.dto.PaymentResponse;

import java.util.List;

public interface PaymentService {

    PaymentResponse createPayment(PaymentRequest paymentRequest);
    List<PaymentResponse> getAllPayments();
    List<PaymentResponse> getPaymentByOrderId(String orderId);
}*/

package com.eci.paymentservice.service;

import com.eci.paymentservice.dto.PaymentRequest;
import com.eci.paymentservice.dto.PaymentResponse;

import java.util.List;

public interface PaymentService {

    PaymentResponse createPayment(PaymentRequest paymentRequest);

    List<PaymentResponse> getPaymentByOrderId(String orderId);

    List<PaymentResponse> getAllPayments();
}


