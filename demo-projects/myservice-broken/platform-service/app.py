from fastapi import FastAPI
import requests

app = FastAPI()


@app.get("/platform/orders/{order_id}/snapshot")
def order_snapshot(order_id: str):
    order_status = requests.get("http://order-service:8080/orders/42/status")
    return {"order_id": order_id, "snapshot": "stale", "order_status": order_status.status_code}


@app.post("/platform/payments/{order_id}/ledger")
def payment_ledger(order_id: str):
    payment_status = requests.get("http://payment-service:8080/payments/42")
    return {"order_id": order_id, "ledger": "written", "payment_status": payment_status.status_code}


@app.get("/platform/users/{user_id}/profile-state")
def profile_state(user_id: str):
    user = requests.get("http://user-service:8080/users/42")
    return {"user_id": user_id, "state": "partial", "user_status": user.status_code}


@app.get("/platform/orders/{order_id}/pricing")
def pricing(order_id: str):
    return {"order_id": order_id, "pricing": "dynamic"}


@app.get("/platform/orders/{order_id}/inventory")
def inventory(order_id: str):
    return {"order_id": order_id, "inventory": "low"}


@app.get("/platform/orders/{order_id}/shipping")
def shipping(order_id: str):
    return {"order_id": order_id, "shipping": "queued"}


@app.get("/platform/orders/{order_id}/returns")
def returns(order_id: str):
    return {"order_id": order_id, "returns": "open"}


@app.get("/platform/orders/{order_id}/analytics")
def analytics(order_id: str):
    return {"order_id": order_id, "analytics": "available"}


@app.get("/platform/orders/{order_id}/discounts")
def discounts(order_id: str):
    return {"order_id": order_id, "discounts": "manual"}


@app.get("/platform/orders/{order_id}/notifications")
def notifications(order_id: str):
    return {"order_id": order_id, "notifications": "pending"}
