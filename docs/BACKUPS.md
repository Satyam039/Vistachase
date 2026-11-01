# Database backups

Two kinds of backup, both with `pg_dump` (package `postgresql-client`, same major version as the database or newer):

| When | Script | Files | Kept |
| --- | --- | --- | --- |
| Every night (cron) | `backend/scripts/nightly-backup.js` | `~/backups/daily-<time>.dump` | newest 14 (`DAILY_BACKUPS_KEEP`) |
| Deploy with a pending migration | `backend/scripts/backup-before-migrate.js` | `~/backups/pre-migrate-<time>-<names>.dump` | newest 10 |

## Set up the nightly backup (once, on the server)

```
cd /home/ubuntu/Vistachase/backend
which pg_dump || sudo apt install -y postgresql-client
mkdir -p /home/ubuntu/backups
node scripts/nightly-backup.js          # first run by hand: should print "saved … MB"
crontab -e
```

Add this line (03:15 server time every night), save, exit:

```
15 3 * * * cd /home/ubuntu/Vistachase/backend && /usr/bin/env node scripts/nightly-backup.js >> /home/ubuntu/backups/backup.log 2>&1
```

If `node` isn't found from cron (nvm installs), use the full path from `which node` instead of `/usr/bin/env node`.

Check: `crontab -l`, and next morning `tail /home/ubuntu/backups/backup.log`.

## Copy off the server (recommended)

A backup on the same server is lost with the server. With an S3 bucket:

1. Create a private S3 bucket (for example `vistachase-backups`), with a lifecycle rule deleting objects after 30 days.
2. Give the EC2 instance an IAM role allowed `s3:PutObject` on that bucket (EC2 → Actions → Security → Modify IAM role), and install the CLI: `sudo apt install -y awscli`.
3. In `backend/.env`: `BACKUP_S3_BUCKET=vistachase-backups`.

Each night's file is then also copied to `s3://<bucket>/vistachase-db/`.

## Restore

```
pg_restore --clean --if-exists --no-owner -d "postgresql://USER:PASS@HOST:5432/DB" ~/backups/daily-<time>.dump
```

Stop the API first (`pm2 stop vistachase-backend`) and start it again afterwards.

## Check everything

`npx tsx scripts/check-connections.ts` lists database, Redis, Stripe, email, Bókun, site URL and the latest backup.
