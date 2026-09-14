import requests

OTEL_COLLECTOR_URL = "http://localhost:4317"


def export_span(span):
    return requests.post(OTEL_COLLECTOR_URL, json=span)
