import requests

DB_URL = "postgresql://user:pass@db-host:5432/platform_ledger_db"


def process_checkout():
    return requests.post("http://billing-gateway-service/charge")
