from fastapi import FastAPI
import requests

app = FastAPI()

@app.get("/orders")
def get_orders():
    return requests.get("http://order-service/orders").json()

@app.get("/payments")
def get_payments():
    return requests.get("http://payment-service/payments").json()

@app.get("/users")
def get_users():
    return requests.get("http://user-service/users").json()

@app.get("/inventory")
def get_inventory():
    return requests.get("http://inventory-service/inventory").json()

@app.get("/shipments")
def get_shipments():
    return requests.get("http://notification-service/shipments").json()

@app.get("/invoices")
def get_invoices():
    return requests.get("http://billing-service/invoices").json()

@app.get("/catalog")
def get_catalog():
    return requests.get("http://inventory-service/catalog").json()

@app.get("/discounts")
def get_discounts():
    return requests.get("http://order-service/discounts").json()

@app.get("/returns")
def get_returns():
    return requests.get("http://payment-service/returns").json()

@app.get("/analytics")
def get_analytics():
    return requests.get("http://user-service/analytics").json()
