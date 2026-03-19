#!/bin/bash
# init-letsencrypt.sh
#
# One-time bootstrap script that obtains the initial Let's Encrypt certificate
# for your domain via the HTTP-01 ACME challenge.
#
# How it works:
#   1. Downloads Certbot's recommended TLS options file (if not already present).
#   2. Creates a temporary self-signed certificate so nginx can start even before
#      the real cert exists (nginx refuses to start if ssl_certificate is missing).
#   3. Starts nginx.
#   4. Deletes the temporary cert and requests the real one from Let's Encrypt.
#      Certbot completes the HTTP-01 challenge through the running nginx on :80.
#   5. Reloads nginx so it picks up the real certificate immediately.
#
# Usage:
#   1. Replace the DOMAIN and EMAIL variables below with your values.
#   2. chmod +x init-letsencrypt.sh
#   3. ./init-letsencrypt.sh
#   4. docker compose -f docker-compose.prod.yml up -d
#
# Set STAGING=1 to test against Let's Encrypt's staging environment, which has
# much higher rate limits and avoids burning production quota during testing.
# Set STAGING=0 (or leave unset) to issue a real, browser-trusted certificate.

# ── Configuration ─────────────────────────────────────────────────────────────
# These can be set by exporting env vars before running, e.g.:
#   DOMAIN=mysite.com EMAIL=me@gmail.com ./init-letsencrypt.sh
DOMAIN="${DOMAIN:-mmthepool.com}"
EMAIL="${EMAIL:-you@example.com}"
STAGING="${STAGING:-0}"       # 1 = staging (testing), 0 = production

# Paths for the shared volumes defined in docker-compose.prod.yml.
CONF_PATH="./data/certbot/conf"
WWW_PATH="./data/certbot/www"

# ── Pre-flight validation ─────────────────────────────────────────────────────
# Fail immediately if the placeholder values have not been replaced, rather
# than letting certbot fail mid-run with a confusing ACME error.
if [ "$DOMAIN" = "yourdomain.com" ]; then
    echo "ERROR: DOMAIN is still set to the placeholder 'yourdomain.com'."
    echo "       Run:  DOMAIN=mysite.com EMAIL=me@gmail.com ./init-letsencrypt.sh"
    exit 1
fi

if [ "$EMAIL" = "you@example.com" ]; then
    echo "ERROR: EMAIL is still set to the placeholder 'you@example.com'."
    echo "       Run:  DOMAIN=mysite.com EMAIL=me@gmail.com ./init-letsencrypt.sh"
    exit 1
fi

# ── Staging flag ──────────────────────────────────────────────────────────────
STAGING_FLAG=""
if [ "$STAGING" -eq 1 ]; then
    echo "WARNING: Running in STAGING mode -- certificate will NOT be browser-trusted."
    STAGING_FLAG="--staging"
fi

# ── Create required directories ───────────────────────────────────────────────
mkdir -p "$CONF_PATH/live/$DOMAIN" "$WWW_PATH"

# ── Download recommended TLS options from Let's Encrypt ──────────────────────
# These are referenced in nginx/conf.d/app.conf via the 'include' directive.
if [ ! -f "$CONF_PATH/options-ssl-nginx.conf" ]; then
    echo "Downloading recommended TLS options..."
    curl -fsSL https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
        -o "$CONF_PATH/options-ssl-nginx.conf"
fi

if [ ! -f "$CONF_PATH/ssl-dhparams.pem" ]; then
    echo "Downloading DH parameters..."
    curl -fsSL https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
        -o "$CONF_PATH/ssl-dhparams.pem"
fi

# ── Create a temporary self-signed cert ───────────────────────────────────────
# nginx will fail to start if the ssl_certificate file is missing.
# We create a dummy cert now, start nginx, swap in the real cert, then reload.
echo "Creating temporary self-signed certificate..."
docker compose -f docker-compose.prod.yml run --rm --entrypoint \
    "openssl req -x509 -nodes -newkey rsa:4096 -days 1
     -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem
     -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem
     -subj '/CN=localhost'" \
    certbot

# ── Start nginx with the temporary cert ───────────────────────────────────────
echo "Starting nginx..."
docker compose -f docker-compose.prod.yml up -d nginx

# Give nginx a moment to come up before Certbot tries to hit it.
echo "Waiting for nginx to be ready..."
sleep 5

# ── Delete the temporary cert and request the real one ────────────────────────
echo "Removing temporary certificate..."
docker compose -f docker-compose.prod.yml run --rm --entrypoint \
    "rm -rf /etc/letsencrypt/live/$DOMAIN
             /etc/letsencrypt/archive/$DOMAIN
             /etc/letsencrypt/renewal/$DOMAIN.conf" \
    certbot

echo "Requesting real Let's Encrypt certificate for $DOMAIN and www.$DOMAIN..."
docker compose -f docker-compose.prod.yml run --rm --entrypoint \
    "certbot certonly --webroot
     --webroot-path=/var/www/certbot
     $STAGING_FLAG
     --email $EMAIL
     --agree-tos
     --no-eff-email
     -d $DOMAIN
     -d www.$DOMAIN" \
    certbot

# ── Reload nginx to pick up the real certificate ──────────────────────────────
echo "Reloading nginx with the real certificate..."
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo ""
echo "Done! Your site should now be reachable at https://$DOMAIN and https://www.$DOMAIN"
echo "Start the full stack with:"
echo "  docker compose -f docker-compose.prod.yml up -d"
