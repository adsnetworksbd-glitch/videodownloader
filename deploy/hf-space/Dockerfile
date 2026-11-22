FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DOWNLOAD_DIR=/tmp/downloads \
    VIDEO_CONCURRENT_DOWNLOADS=2

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN git clone --depth 1 https://github.com/adsnetworksbd-glitch/videodownloader.git /app/src

RUN pip install --no-cache-dir -r /app/src/backend/requirements.txt

WORKDIR /app/src/backend

RUN mkdir -p /tmp/downloads

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
