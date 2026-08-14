from fastapi import FastAPI
import requests

app = FastAPI()


@app.get("/users/{user_id}")
def get_user(user_id: str):
    profile_state = requests.get("http://platform-service:8080/platform/users/42/profile-state")
    return {"id": user_id, "name": "Demo User", "profile_state": profile_state.status_code}


@app.get("/users/{user_id}/preferences")
def get_preferences(user_id: str):
    return {"id": user_id, "preferences": ["email", "sms"]}


@app.get("/users/{user_id}/addresses")
def get_addresses(user_id: str):
    return {"id": user_id, "addresses": ["Colombo", "Kandy"]}
