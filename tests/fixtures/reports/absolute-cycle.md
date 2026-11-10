<!-- mesa-report -->
## ❌ MESA architecture check: FAILED (3 findings)

**Health score:** 63.7 (minimum 75.0)

**Why it failed:**

- System health score is below the minimum 75.0.
- Critical finding count is 1; maximum allowed is 0.
- Detected 1 cyclic dependency finding(s).

### Problems found

#### 🔴 CRITICAL Cyclic dependency: order-service → payment-service → order-service

- [`order-service/app.py:5`](https://github.com/octo/shop/blob/abc123/order-service/app.py#L5) calls `http://payment-service/payments`
- [`payment-service/app.py:5`](https://github.com/octo/shop/blob/abc123/payment-service/app.py#L5) calls `http://order-service/orders/1`

**Why it matters:** The cycle blocks independent deployment, increases change coordination, and can turn microservices into a distributed monolith.

**How to fix:** Identify the dependency edge in the cycle with the weakest ownership justification. Reverse that dependency, replace it with an event, or introduce an orchestration/application service.

#### 🟡 MEDIUM Hard-coded service dependency: order-service uses `http://payment-service/payments`

- [`order-service/app.py:5`](https://github.com/octo/shop/blob/abc123/order-service/app.py#L5) uses `http://payment-service/payments`

**Why it matters:** Deployments become environment-specific, endpoint changes require code/config edits, and resilience patterns are harder to centralize.

**How to fix:** Move the endpoint value into environment-specific configuration or secrets. Centralize client creation behind a typed adapter or service discovery abstraction.

#### 🟡 MEDIUM Hard-coded service dependency: payment-service uses `http://order-service/orders/1`

- [`payment-service/app.py:5`](https://github.com/octo/shop/blob/abc123/payment-service/app.py#L5) uses `http://order-service/orders/1`

**Why it matters:** Deployments become environment-specific, endpoint changes require code/config edits, and resilience patterns are harder to centralize.

**How to fix:** Move the endpoint value into environment-specific configuration or secrets. Centralize client creation behind a typed adapter or service discovery abstraction.

---
<sub>Ran in 1.0s · MESA TEST · Static analysis only: no code was executed.</sub>
