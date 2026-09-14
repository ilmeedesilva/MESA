import requests

LEGACY_INVENTORY_HOST = "http://10.0.0.15:9000/legacy-inventory"
LEGACY_CRM_HOST = "http://192.168.2.40:7100/legacy-crm"


def sync_inventory():
    return requests.get(LEGACY_INVENTORY_HOST)


def sync_crm():
    return requests.get(LEGACY_CRM_HOST)
