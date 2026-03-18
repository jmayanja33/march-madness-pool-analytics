"""
Infrastructure configuration tests.

These tests assert that the production deployment files are structurally
correct and contain all required configuration.  They are plain file-content
checks — no containers are started, no network I/O occurs.

Covers:
  - nginx/conf.d/app.conf       — required server blocks and locations
  - docker-compose.prod.yml     — required services and port bindings
  - frontend/Dockerfile.prod    — multi-stage build structure
  - init-letsencrypt.sh         — placeholder-domain/email validation
"""

import os
import subprocess
from pathlib import Path

import pytest
import yaml

# Project root is three levels above this file:
#   app/tests/test_infrastructure.py → app/tests/ → app/ → project root
_ROOT = Path(__file__).resolve().parent.parent.parent


# ---------------------------------------------------------------------------
# nginx/conf.d/app.conf
# ---------------------------------------------------------------------------

_NGINX_CONF = _ROOT / "nginx" / "conf.d" / "app.conf"


@pytest.fixture(scope="module")
def nginx_conf() -> str:
    """Return the raw text of the nginx app.conf file."""
    return _NGINX_CONF.read_text()


def test_nginx_conf_exists() -> None:
    """The nginx app.conf file must exist."""
    assert _NGINX_CONF.exists(), f"Missing file: {_NGINX_CONF}"


def test_nginx_conf_has_http_server_block(nginx_conf: str) -> None:
    """The conf must define a server block that listens on port 80 (HTTP)."""
    assert "listen 80" in nginx_conf


def test_nginx_conf_has_https_server_block(nginx_conf: str) -> None:
    """The conf must define a server block that listens on port 443 with SSL."""
    assert "listen 443 ssl" in nginx_conf


def test_nginx_conf_has_acme_challenge_location(nginx_conf: str) -> None:
    """
    The HTTP server block must include the /.well-known/acme-challenge/ location
    so Let's Encrypt HTTP-01 challenges can be served without being redirected.
    """
    assert "/.well-known/acme-challenge/" in nginx_conf


def test_nginx_conf_redirects_http_to_https(nginx_conf: str) -> None:
    """The HTTP server block must issue a 301 redirect to HTTPS."""
    assert "return 301 https://" in nginx_conf


def test_nginx_conf_references_ssl_certificate(nginx_conf: str) -> None:
    """The HTTPS block must reference an ssl_certificate in the letsencrypt path."""
    assert "ssl_certificate" in nginx_conf
    assert "/etc/letsencrypt/live/" in nginx_conf


def test_nginx_conf_references_ssl_key(nginx_conf: str) -> None:
    """The HTTPS block must reference the private key (ssl_certificate_key)."""
    assert "ssl_certificate_key" in nginx_conf
    assert "privkey.pem" in nginx_conf


def test_nginx_conf_includes_recommended_tls_options(nginx_conf: str) -> None:
    """The HTTPS block must include Certbot's recommended TLS options file."""
    assert "options-ssl-nginx.conf" in nginx_conf


def test_nginx_conf_proxies_analyze_route(nginx_conf: str) -> None:
    """The API proxy location must cover the /analyze route."""
    assert "analyze" in nginx_conf
    assert "proxy_pass" in nginx_conf


def test_nginx_conf_proxies_to_backend_service(nginx_conf: str) -> None:
    """The proxy_pass target must point to the internal 'backend' Docker service."""
    assert "http://backend:8000" in nginx_conf


def test_nginx_conf_has_spa_fallback(nginx_conf: str) -> None:
    """
    The static-file location must use try_files with an index.html fallback so
    React Router can handle client-side navigation without 404s from nginx.
    """
    assert "try_files" in nginx_conf
    assert "/index.html" in nginx_conf


# ---------------------------------------------------------------------------
# docker-compose.prod.yml
# ---------------------------------------------------------------------------

_COMPOSE_PROD = _ROOT / "docker-compose.prod.yml"


@pytest.fixture(scope="module")
def compose_prod() -> dict:
    """Return the parsed docker-compose.prod.yml as a dictionary."""
    with _COMPOSE_PROD.open() as f:
        return yaml.safe_load(f)


def test_compose_prod_exists() -> None:
    """The docker-compose.prod.yml file must exist."""
    assert _COMPOSE_PROD.exists(), f"Missing file: {_COMPOSE_PROD}"


def test_compose_prod_has_nginx_service(compose_prod: dict) -> None:
    """The production compose must define an 'nginx' service."""
    assert "nginx" in compose_prod["services"]


def test_compose_prod_has_certbot_service(compose_prod: dict) -> None:
    """The production compose must define a 'certbot' service for auto-renewal."""
    assert "certbot" in compose_prod["services"]


def test_compose_prod_has_backend_service(compose_prod: dict) -> None:
    """The production compose must define the FastAPI 'backend' service."""
    assert "backend" in compose_prod["services"]


def test_compose_prod_has_chromadb_service(compose_prod: dict) -> None:
    """The production compose must define the 'chromadb' vector database service."""
    assert "chromadb" in compose_prod["services"]


def test_compose_prod_nginx_publishes_port_80(compose_prod: dict) -> None:
    """nginx must publish port 80 to the host for ACME challenges and HTTP redirects."""
    nginx_ports = compose_prod["services"]["nginx"].get("ports", [])
    assert any("80:80" in str(p) for p in nginx_ports), (
        "nginx must publish port 80:80"
    )


def test_compose_prod_nginx_publishes_port_443(compose_prod: dict) -> None:
    """nginx must publish port 443 to the host for HTTPS traffic."""
    nginx_ports = compose_prod["services"]["nginx"].get("ports", [])
    assert any("443:443" in str(p) for p in nginx_ports), (
        "nginx must publish port 443:443"
    )


def test_compose_prod_backend_has_no_published_ports(compose_prod: dict) -> None:
    """
    The backend must NOT publish any ports to the host in production.
    All traffic should reach it through the nginx proxy on the Docker network.
    """
    backend_ports = compose_prod["services"]["backend"].get("ports", [])
    assert len(backend_ports) == 0, (
        "backend should not expose ports to the host in production"
    )


def test_compose_prod_certbot_mounts_conf_volume(compose_prod: dict) -> None:
    """
    The certbot service must mount the letsencrypt conf volume so it can write
    renewed certificates to the same location that nginx reads from.
    """
    certbot_volumes = compose_prod["services"]["certbot"].get("volumes", [])
    assert any("certbot/conf" in str(v) for v in certbot_volumes), (
        "certbot must mount the certbot/conf volume"
    )


def test_compose_prod_certbot_mounts_www_volume(compose_prod: dict) -> None:
    """
    The certbot service must mount the webroot volume so it can write ACME
    challenge files that nginx serves on port 80.
    """
    certbot_volumes = compose_prod["services"]["certbot"].get("volumes", [])
    assert any("certbot/www" in str(v) for v in certbot_volumes), (
        "certbot must mount the certbot/www volume"
    )


def test_compose_prod_certbot_runs_renewal_loop(compose_prod: dict) -> None:
    """The certbot service entrypoint must include 'certbot renew' for auto-renewal."""
    certbot_entry = str(compose_prod["services"]["certbot"].get("entrypoint", ""))
    assert "certbot renew" in certbot_entry


# ---------------------------------------------------------------------------
# frontend/Dockerfile.prod
# ---------------------------------------------------------------------------

_DOCKERFILE_PROD = _ROOT / "frontend" / "Dockerfile.prod"


@pytest.fixture(scope="module")
def dockerfile_prod() -> str:
    """Return the raw text of frontend/Dockerfile.prod."""
    return _DOCKERFILE_PROD.read_text()


def test_dockerfile_prod_exists() -> None:
    """frontend/Dockerfile.prod must exist."""
    assert _DOCKERFILE_PROD.exists(), f"Missing file: {_DOCKERFILE_PROD}"


def test_dockerfile_prod_has_builder_stage(dockerfile_prod: str) -> None:
    """The first stage must be named 'builder' (multi-stage build pattern)."""
    assert "AS builder" in dockerfile_prod


def test_dockerfile_prod_runs_npm_build(dockerfile_prod: str) -> None:
    """The builder stage must run 'npm run build' to compile the React app."""
    assert "npm run build" in dockerfile_prod


def test_dockerfile_prod_uses_nginx_for_serving(dockerfile_prod: str) -> None:
    """The final stage must be based on nginx to serve the static files."""
    assert "FROM nginx" in dockerfile_prod


def test_dockerfile_prod_copies_dist_to_nginx_html(dockerfile_prod: str) -> None:
    """
    The compiled /app/dist must be copied into nginx's default serving
    directory (/usr/share/nginx/html).
    """
    assert "/usr/share/nginx/html" in dockerfile_prod


# ---------------------------------------------------------------------------
# init-letsencrypt.sh — placeholder validation
# ---------------------------------------------------------------------------

_INIT_SCRIPT = _ROOT / "init-letsencrypt.sh"


def test_init_script_exists() -> None:
    """init-letsencrypt.sh must exist at the project root."""
    assert _INIT_SCRIPT.exists(), f"Missing file: {_INIT_SCRIPT}"


def test_init_script_is_executable() -> None:
    """init-letsencrypt.sh must be executable (chmod +x)."""
    assert os.access(_INIT_SCRIPT, os.X_OK), (
        "init-letsencrypt.sh is not executable — run: chmod +x init-letsencrypt.sh"
    )


def test_init_script_exits_with_error_for_placeholder_domain() -> None:
    """
    Running init-letsencrypt.sh with DOMAIN still set to the placeholder value
    'yourdomain.com' must exit with a non-zero status and print an error message.
    This prevents the script from calling certbot with an invalid domain.
    """
    result = subprocess.run(
        ["bash", str(_INIT_SCRIPT)],
        env={**os.environ, "DOMAIN": "yourdomain.com", "EMAIL": "real@example.com"},
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0, (
        "Script should exit with an error when DOMAIN is the placeholder"
    )
    assert "yourdomain.com" in result.stdout or "yourdomain.com" in result.stderr


def test_init_script_exits_with_error_for_placeholder_email() -> None:
    """
    Running init-letsencrypt.sh with EMAIL still set to the placeholder value
    'you@example.com' must exit with a non-zero status and print an error message.
    This prevents cert expiry alerts from going to a non-existent address.
    """
    result = subprocess.run(
        ["bash", str(_INIT_SCRIPT)],
        env={**os.environ, "DOMAIN": "mysite.com", "EMAIL": "you@example.com"},
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0, (
        "Script should exit with an error when EMAIL is the placeholder"
    )
    assert "you@example.com" in result.stdout or "you@example.com" in result.stderr
