FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./

RUN mkdir -p logs outputs uploads

EXPOSE 8000

CMD ["sh", "-c", "gunicorn -w ${WEB_CONCURRENCY:-4} -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:${PORT:-8000} --access-logfile - --error-logfile - --timeout ${GUNICORN_TIMEOUT:-300}"]
