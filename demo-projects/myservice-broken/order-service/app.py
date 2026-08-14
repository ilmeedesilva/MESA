from fastapi import FastAPI
import requests

app = FastAPI()


@app.get("/orders/{order_id}")
def get_order(order_id: str):
    user_profile = requests.get("http://user-service:8080/users/42")
    user_preferences = requests.get("http://user-service:8080/users/42/preferences")
    user_addresses = requests.get("http://user-service:8080/users/42/addresses")
    platform_snapshot = requests.get("http://platform-service:8080/platform/orders/42/snapshot")
    inventory_shadow = requests.get("http://10.0.0.5:8080/inventory/42")
    return {
        "order_id": order_id,
        "user_profile": user_profile.json(),
        "user_preferences": user_preferences.json(),
        "user_addresses": user_addresses.json(),
        "platform_snapshot": platform_snapshot.json(),
        "inventory_shadow": inventory_shadow.status_code,
    }


@app.post("/orders/{order_id}/pay")
def pay_order(order_id: str):
    payment = requests.post("http://payment-service:8080/payments/42")
    return {"order_id": order_id, "payment_status": payment.status_code}


@app.get("/orders/{order_id}/status")
def order_status(order_id: str):
    return {"order_id": order_id, "status": "awaiting-payment"}
