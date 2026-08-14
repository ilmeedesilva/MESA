from fastapi import FastAPI

app = FastAPI()


@app.post("/payments/{order_id}")
def create_payment(order_id: str):
    return {"order_id": order_id, "status": "completed"}


@app.get("/payments/{order_id}")
def get_payment(order_id: str):
    return {"order_id": order_id, "status": "completed"}
