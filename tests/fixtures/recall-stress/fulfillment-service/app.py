import requests


def confirm_checkout():
    return requests.post("http://checkout-service/confirm")
