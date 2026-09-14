import requests


def notify_user():
    requests.get("http://profile-service/users/1")
    requests.get("http://profile-service/users/1/email")
    requests.get("http://profile-service/users/1/phone")
    requests.get("http://profile-service/users/1/preferences")
