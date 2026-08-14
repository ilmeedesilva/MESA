from fastapi import FastAPI

app = FastAPI()


@app.get("/platform/status")
def platform_status():
    return {"status": "healthy"}


@app.get("/platform/insights")
def platform_insights():
    return {"mode": "read-only-dashboard"}
