import requests

def call_platform():
    return requests.get("http://platform-service/api").json()
