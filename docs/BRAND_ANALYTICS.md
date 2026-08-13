# DAIL brand analytics

`brand.dail.life` uses an isolated, self-hosted Umami instance. It does not send
brand traffic to the Main or Dev application databases.

## Addresses

- Brand page: `https://brand.dail.life`
- Active private analytics login: `https://stats-dail.157-90-26-205.sslip.io`
- Custom analytics login after DNS setup: `https://stats.dail.life`

## Privacy defaults

- Tracking is restricted to `brand.dail.life`.
- URL query strings are excluded.
- Browser Do Not Track preferences are respected.
- Session replay and heatmaps are not enabled.
- Umami telemetry and update checks are disabled.

## Deploy

Create `/opt/movemap-secrets/.env.analytics` from
`deploy/analytics.env.example`, then run from the deployed repository:

```sh
docker compose \
  --env-file /opt/movemap-secrets/.env.analytics \
  -f docker-compose.analytics.yml \
  up -d
```

The two `ANALYTICS_ADMIN_*` values are bootstrap credentials and are not passed
to the containers. Keep the secrets file readable only by the deploy user.

Initialize the private administrator and the tracked website once:

```sh
python3 scripts/bootstrap-brand-analytics.py /opt/movemap-secrets/.env.analytics
```

The stable website ID embedded by `scripts/build-brand-static.js` is
`e6f5d5ec-49df-4bde-ae0c-93f8560148e7`.

Until the custom DNS record exists, the brand build uses the DNS-independent
login origin. Set `BRAND_ANALYTICS_ORIGIN=https://stats.dail.life` during the
brand build after the DNS record is active.
