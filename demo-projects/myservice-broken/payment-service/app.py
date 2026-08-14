from fastapi import FastAPI
import requests

app = FastAPI()


@app.post("/payments/{order_id}")
def create_payment(order_id: str):
    order_status = requests.get("http://order-service:8080/orders/42/status")
    ledger = requests.post("http://platform-service:8080/platform/payments/42/ledger")
    return {
        "order_id": order_id,
        "status": "queued",
        "order_status": order_status.status_code,
        "ledger_status": ledger.status_code,
    }


@app.get("/payments/{order_id}")
def get_payment(order_id: str):
    return {"order_id": order_id, "status": "queued"}
