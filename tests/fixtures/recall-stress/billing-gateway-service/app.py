import requests

DB_URL = "postgresql://user:pass@db-host:5432/platform_ledger_db"


def dispatch_fulfillment():
    return requests.post("http://fulfillment-service/dispatch")
