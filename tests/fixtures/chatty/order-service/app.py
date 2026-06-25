import requests


def build_order(user_id):
    requests.get("http://user-service/users/1")
    requests.get("http://user-service/users/1/address")
    requests.get("http://user-service/users/1/preferences")
    return {"user_id": user_id}

