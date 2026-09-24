ARG TARGETPLATFORM=linux/arm64
FROM --platform=$TARGETPLATFORM python:3.12-slim

WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src
COPY benchmarks ./benchmarks
COPY evaluation-results ./evaluation-results
COPY tests ./tests

RUN pip install --no-cache-dir -e .

EXPOSE 8000

CMD ["uvicorn", "mesa.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
