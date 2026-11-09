FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src
COPY benchmarks ./benchmarks
COPY evaluation-results ./evaluation-results
COPY tests ./tests

# The API image needs the web API and AI extras; the CLI alone needs neither.
RUN pip install --no-cache-dir -e ".[api,ai]"

EXPOSE 8000

CMD ["uvicorn", "mesa.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
