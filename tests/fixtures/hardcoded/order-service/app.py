import requests

USER_URL = "http://user-service:8080/users"

def build_order():
    return requests.get(USER_URL)
