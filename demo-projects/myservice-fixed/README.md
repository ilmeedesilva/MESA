# MyService Fixed

This demo repository is the improved version of `myservice-broken`.

Use it for the second MESA scan in a demo, after showing the initial issues.

Expected outcome:

- fewer findings
- higher health score
- simpler architecture graph
- no shared database coupling
- no synchronous cycle between services

Recommended scan root:

`demo-projects/myservice-fixed`

Services:

- `order-service`
- `payment-service`
- `user-service`
- `platform-service`

The `.env` files in this demo are intentional: they hold a fake shared database URL so that MESA has a shared database to detect. They contain no real credentials.
