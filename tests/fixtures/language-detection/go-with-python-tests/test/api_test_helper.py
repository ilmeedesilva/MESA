"""BDD-style acceptance test helper, matching the pattern found in the real
Sock Shop repositories (each Go/Java service ships a Python test/ directory)
that originally exposed the detect_language() priority bug."""

import requests


def check_catalogue_endpoint(base_url):
    response = requests.get(f"{base_url}/catalogue")
    assert response.status_code == 200
