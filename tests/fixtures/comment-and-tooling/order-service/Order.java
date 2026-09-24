package com.example;

public class Order {
    // Example usage: curl http://localhost:9999/orders/123
    public void placeOrder() {
        String paymentUrl = "http://payment-service:8082/api";
        callPayment(paymentUrl);
    }

    private void callPayment(String url) {
    }
}
