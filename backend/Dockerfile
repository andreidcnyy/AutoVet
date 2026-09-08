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

# --- Opcache settings ---
# The extension is installed above, but `php artisan serve` runs under the CLI
# SAPI where opcache is off unless enable_cli is set, so it was inert. Copied
# before composer/npm so the build steps benefit from it too.
RUN cp docker/opcache.ini "$PHP_INI_DIR/conf.d/zz-opcache.ini"

# --- Python venv with the forecasting deps (numpy/pandas/scikit-learn/...) ---
# PYTHON_BIN_PATH tells InventoryForecastingService which interpreter to spawn.
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r ai/requirements.txt
ENV PYTHON_BIN_PATH=/opt/venv/bin/python

# --- PHP + JS dependencies and asset build ---
RUN composer install --no-dev --optimize-autoloader --no-interaction \
    && npm ci \
    && (npm run build || true)

# --- Precompile the parts that do not depend on runtime environment ---
# Routes, views and events are fixed by the source tree, so they can be built
# into the image instead of being rebuilt from scratch on every request. The
# route table alone is 258 routes across a 411-line api.php.
#
# config:cache is deliberately absent. Seven env() calls live outside config/
# (PYTHON_BIN_PATH in four places, CRON_SECRET, BREVO_API_KEY,
# FILESYSTEM_PUBLIC), and env() returns null once the config is cached — that
# would quietly send the forecast subprocess to the system python3 instead of
# the venv, and leave the cron endpoint comparing against a null secret.
# Caching config safely means moving those reads into config/ first.
RUN php artisan route:cache \
    && php artisan view:cache \
    && php artisan event:cache

# --- Concurrency ---
# Without this the server handles exactly one request at a time: eight parallel
# requests measured as a clean staircase, each waiting for the one before it,
# while the same eight run flat when issued serially. The admin dashboard opens
# with three parallel calls, so the third was paying for the first two.
#
# Laravel's ServeCommand reads PHP_CLI_SERVER_WORKERS and forks that many
# workers, but only when --no-reload is also passed (see the flag below).
# Requests are mostly waiting on TiDB rather than burning CPU, so workers
# overlap that wait even on a 0.1-CPU instance.
#
# Set here as an ENV rather than inline so it can be re-tuned from the Render
# dashboard without a rebuild. Watch memory when changing it: workers are forks
# and share the opcache SHM, but the forecast job spawns a pandas/scikit-learn
# subprocess that is the largest single allocation on a 512MB instance. If the
# service starts OOM-restarting, lower this to 2 before anything else.
ENV PHP_CLI_SERVER_WORKERS=4

# Render injects $PORT. Migrate on boot (matches the old Railway start command),
# then serve.
#
# optimize:clear used to run here to avoid a stale cached config from the build
# layer. Nothing caches config any more — not at build time and not here — so
# there is nothing stale to guard against, and the clear would now delete the
# route/view/event caches built above. bootstrap/cache is gitignored, so a
# Render build starts from a clean tree regardless.
#
# --no-reload only stops the server watching .env for changes and restarting.
# .dockerignore excludes .env, so there is no such file in the image and
# nothing to watch; the flag is required for the worker count above to apply.
#
# config:cache runs here rather than at build time because Render injects the
# environment at container start, so a build-time cache would bake in whatever
# was present during the build — which is nothing. Running it at boot captures
# the real values once, instead of re-reading ~30 config files per request.
#
# Safe despite the env() calls that remain outside config/: the "env() returns
# null once config is cached" rule applies to variables read from a .env file,
# and .dockerignore keeps .env out of the image entirely. Render's variables
# are real process environment variables, which env() still resolves. Verified
# both ways — every value below is identical cached and uncached.
CMD php artisan config:cache \
    && php artisan migrate --force \
    && php artisan serve --host 0.0.0.0 --port "${PORT:-8080}" --no-reload
