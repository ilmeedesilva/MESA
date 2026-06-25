import requests


def load_order(order_id):
    return requests.get("http://order-service/orders/1")

