from fastapi import FastAPI

app = FastAPI()


@app.get("/orders/{order_id}")
def get_order(order_id: str):
    return {
        "order_id": order_id,
        "status": "confirmed",
        "customer_summary": "served from local projection",
    }


@app.post("/orders/{order_id}/pay")
def pay_order(order_id: str):
    return {"order_id": order_id, "payment_command": "published"}


@app.get("/orders/{order_id}/status")
def order_status(order_id: str):
    return {"order_id": order_id, "status": "paid"}
