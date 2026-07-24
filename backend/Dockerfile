# AutoVet backend — Render deployment image.
# Single image runs Laravel (php artisan serve, like Railway did) AND bundles
# Python 3 + the forecasting libs so the AI subprocess (ai/forecast.py) works
# self-contained — no separate AI service needed on Render's free tier.

FROM php:8.2-cli-bookworm

# --- System packages + Python for the AI forecasting subprocess ---
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip curl ca-certificates \
        libzip-dev libpng-dev libjpeg-dev libfreetype6-dev \
        libonig-dev libxml2-dev libicu-dev zlib1g-dev \
        python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# --- PHP extensions required by the app (mysql, dompdf/gd, intl, etc.) ---
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql mbstring bcmath gd zip exif pcntl intl opcache

# --- Node.js 20 (builds Laravel's Vite assets) ---
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# --- Composer ---
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . .

# --- Python venv with the forecasting deps (numpy/pandas/scikit-learn/...) ---
# PYTHON_BIN_PATH tells InventoryForecastingService which interpreter to spawn.
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r ai/requirements.txt
ENV PYTHON_BIN_PATH=/opt/venv/bin/python

# --- PHP + JS dependencies and asset build ---
RUN composer install --no-dev --optimize-autoloader --no-interaction \
    && npm ci \
    && (npm run build || true)

# Render injects $PORT. Migrate on boot (matches the old Railway start command),
# then serve. config:clear avoids a stale cached config from the build layer.
CMD php artisan config:clear \
    && php artisan migrate --force \
    && php artisan serve --host 0.0.0.0 --port "${PORT:-8080}"
