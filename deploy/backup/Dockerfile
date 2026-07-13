FROM postgres:17-alpine

RUN apk add --no-cache bash coreutils restic rclone tzdata

COPY backup.sh /usr/local/bin/backup.sh
COPY healthcheck.sh /usr/local/bin/backup-healthcheck
RUN chmod 0555 /usr/local/bin/backup.sh /usr/local/bin/backup-healthcheck \
  && mkdir -p /var/cache/movemap-backup \
  && chown postgres:postgres /var/cache/movemap-backup

USER postgres
ENTRYPOINT ["/usr/local/bin/backup.sh"]
