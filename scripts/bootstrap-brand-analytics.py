#!/usr/bin/env python3
"""Initialize the isolated DAIL brand Umami instance without printing secrets."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


WEBSITE_ID = "e6f5d5ec-49df-4bde-ae0c-93f8560148e7"
DEFAULT_ORIGIN = "https://stats-dail.157-90-26-205.sslip.io"


def load_env(path: str) -> dict[str, str]:
    values: dict[str, str] = {}
    with open(path, encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key] = value
    return values


def request_json(
    origin: str,
    path: str,
    *,
    body: dict[str, object] | None = None,
    token: str | None = None,
) -> tuple[int, dict[str, object]]:
    headers = {"Accept": "application/json"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(
        f"{origin}{path}",
        data=data,
        headers=headers,
        method="POST" if body is not None else "GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8") or "{}")
            return response.status, payload
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8")
        try:
            payload = json.loads(raw or "{}")
        except json.JSONDecodeError:
            payload = {"message": "non-JSON response"}
        return error.code, payload


def login(origin: str, username: str, password: str) -> dict[str, object] | None:
    status, payload = request_json(
        origin,
        "/api/auth/login",
        body={"username": username, "password": password},
    )
    return payload if status == 200 and payload.get("token") else None


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: bootstrap-brand-analytics.py /path/to/.env.analytics", file=sys.stderr)
        return 2

    values = load_env(sys.argv[1])
    username = values.get("ANALYTICS_ADMIN_USERNAME", "")
    password = values.get("ANALYTICS_ADMIN_PASSWORD", "")
    if not username or not password:
        print("analytics admin credentials are missing", file=sys.stderr)
        return 2

    origin = os.environ.get("ANALYTICS_ORIGIN", DEFAULT_ORIGIN).rstrip("/")
    session = login(origin, username, password)
    using_default = False
    if not session:
        session = login(origin, "admin", "umami")
        using_default = bool(session)
    if not session:
        print("unable to authenticate to analytics", file=sys.stderr)
        return 1

    token = str(session["token"])
    user = session.get("user") or {}
    user_id = str(user.get("id") or "")
    if not user_id:
        print("analytics login did not return a user id", file=sys.stderr)
        return 1

    if using_default:
        status, _ = request_json(
            origin,
            f"/api/users/{user_id}",
            body={"username": username, "password": password, "role": "admin"},
            token=token,
        )
        if status != 200:
            print(f"failed to secure default administrator (HTTP {status})", file=sys.stderr)
            return 1
        print("secured default analytics administrator")
        session = login(origin, username, password)
        if not session:
            print("unable to authenticate with secured administrator", file=sys.stderr)
            return 1
        token = str(session["token"])
    else:
        print("analytics administrator already secured")

    status, payload = request_json(
        origin,
        "/api/websites",
        body={"id": WEBSITE_ID, "name": "DAIL 브랜드 선공개", "domain": "brand.dail.life"},
        token=token,
    )
    if status in (200, 201):
        print(f"registered brand website {WEBSITE_ID}")
    elif status in (400, 409) and "already" in str(payload).lower():
        print(f"brand website already registered {WEBSITE_ID}")
    else:
        # The stable ID lets us safely verify an idempotent rerun through GET.
        verify_status, _ = request_json(origin, f"/api/websites/{WEBSITE_ID}", token=token)
        if verify_status == 200:
            print(f"brand website already registered {WEBSITE_ID}")
        else:
            print(f"failed to register brand website (HTTP {status})", file=sys.stderr)
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
