import requests


def pay(order_id):
    return requests.post("http://payment-service/payments")

