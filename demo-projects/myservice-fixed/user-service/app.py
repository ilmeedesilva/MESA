from fastapi import FastAPI

app = FastAPI()


@app.get("/users/{user_id}")
def get_user(user_id: str):
    return {"id": user_id, "name": "Demo User"}


@app.get("/users/{user_id}/preferences")
def get_preferences(user_id: str):
    return {"id": user_id, "preferences": ["email"]}


@app.get("/users/{user_id}/addresses")
def get_addresses(user_id: str):
    return {"id": user_id, "addresses": ["Colombo"]}
