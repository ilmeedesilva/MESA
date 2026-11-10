<!-- mesa-report -->
## ❌ MESA architecture check: FAILED (3 new problems, 0 fixed)

**Health score:** 98.7 → 79.7 (-19.0, allowed drop is 5.0)
Compared with `main`.

**Why it failed:**

- 3 new finding(s); 1 at HIGH or above.
- Health score 98.7 → 79.7 (-19.0); allowed drop is 5.0.
- Detected 1 new cyclic dependency finding(s).

### New problems

#### 🔴 CRITICAL Cyclic dependency: order-service → user-service → order-service

- [`order-service/app.py:30`](https://github.com/octo/shop/blob/abc123/order-service/app.py#L30) calls `http://user-service:8080/users/1`
- [`user-service/app.py:26`](https://github.com/octo/shop/blob/abc123/user-service/app.py#L26) calls `http://order-service:8080/orders/1`

**Why it matters:** The cycle blocks independent deployment, increases change coordination, and can turn microservices into a distributed monolith.

**How to fix:** Identify the dependency edge in the cycle with the weakest ownership justification. Reverse that dependency, replace it with an event, or introduce an orchestration/application service.

#### 🟡 MEDIUM Hard-coded service dependency: order-service uses `http://user-service:8080/users/1` (below the blocking level)

- [`order-service/app.py:30`](https://github.com/octo/shop/blob/abc123/order-service/app.py#L30) uses `http://user-service:8080/users/1`

**Why it matters:** Deployments become environment-specific, endpoint changes require code/config edits, and resilience patterns are harder to centralize.

**How to fix:** Move the endpoint value into environment-specific configuration or secrets. Centralize client creation behind a typed adapter or service discovery abstraction.

#### 🟡 MEDIUM Hard-coded service dependency: user-service uses `http://order-service:8080/orders/1` (below the blocking level)

- [`user-service/app.py:26`](https://github.com/octo/shop/blob/abc123/user-service/app.py#L26) uses `http://order-service:8080/orders/1`

**Why it matters:** Deployments become environment-specific, endpoint changes require code/config edits, and resilience patterns are harder to centralize.

**How to fix:** Move the endpoint value into environment-specific configuration or secrets. Centralize client creation behind a typed adapter or service discovery abstraction.

---
<sub>Ran in 1.0s · MESA TEST · Static analysis only: no code was executed.</sub>
