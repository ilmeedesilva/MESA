from fastapi import FastAPI
import requests

app = FastAPI()

@app.get("/checkout")
def get_checkout():
    return requests.get("http://checkout-service/status").json()

@app.get("/billing")
def get_billing():
    return requests.get("http://billing-gateway-service/status").json()

@app.get("/fulfillment")
def get_fulfillment():
    return requests.get("http://fulfillment-service/status").json()

@app.get("/alerts")
def get_alerts():
    return requests.get("http://alert-service/status").json()

@app.get("/profiles")
def get_profiles():
    return requests.get("http://profile-service/status").json()

@app.get("/ledger")
def get_ledger():
    return requests.get("http://ledger-service/status").json()

@app.get("/legacy")
def get_legacy():
    return requests.get("http://legacy-bridge-service/status").json()

@app.get("/checkout-summary")
def get_checkout_summary():
    return requests.get("http://checkout-service/summary").json()

@app.get("/billing-summary")
def get_billing_summary():
    return requests.get("http://billing-gateway-service/summary").json()

@app.get("/fulfillment-summary")
def get_fulfillment_summary():
    return requests.get("http://fulfillment-service/summary").json()
