FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WADDLE_API_HOST=0.0.0.0 \
    WADDLE_API_PORT=8000

WORKDIR /app

COPY pyproject.toml requirements.txt ./
COPY src ./src

# Install only the API/runtime dependencies declared by pyproject.toml.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

VOLUME ["/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os, urllib.request; port=os.getenv('WADDLE_API_PORT', '8000'); urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=4)"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
