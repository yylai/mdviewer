# X bookmarks and likes ingestion

This document captures the current X API shape and the first ingestion path for a
personal archive of bookmarks and liked posts.

## Current API availability

Based on the current X API docs:

- Bookmarks: `GET /2/users/:id/bookmarks`
  - Retrieves bookmarked posts for the authenticated user.
  - Requires OAuth 2.0 user context with `bookmark.read`, `tweet.read`, and
    `users.read`.
  - Supports `max_results` up to 100 and `pagination_token`.
  - X documents the lookup endpoint as returning the most recent 800 bookmarked
    posts.
- Likes: `GET /2/users/:id/liked_tweets`
  - Retrieves posts liked by a user ID.
  - Requires OAuth 2.0 user context with `like.read`, `tweet.read`, and
    `users.read`.
  - Supports `max_results` up to 100 and `pagination_token`.
- Billing: X API v2 is pay-per-usage. Bookmarks and liked posts count as
  engagement post reads, with daily deduplication when the same post is returned
  multiple times. Check the Developer Console for the current endpoint price and
  set a budget before running a full backfill.

For this project, use a user access token with these scopes:

```text
bookmark.read like.read tweet.read users.read
```

## Datastore choice

Use SQLite first.

Why SQLite is the best default for this personal archive:

- It is free, open source, local, and portable as a single file.
- It has strong uniqueness constraints and upserts, which makes repeated syncs
  safe.
- It supports JSON text columns, so we can store both queryable fields and the
  complete raw X payload.
- It needs no server process, credentials, Docker, or cloud account.

Use Postgres later if this becomes a hosted multi-user service, needs many
concurrent writers, or needs server-side APIs over the archive. Use DuckDB later
for heavy analytics over exported snapshots; it is excellent for analytical
queries but less natural as the operational ingestion store.

## CLI usage

The ingestion CLI is in `scripts/x-ingest.ts` and uses Node's built-in SQLite
module plus native TypeScript stripping. Run it with Node 22.6 or newer.

Configure `.env`:

```bash
X_ACCESS_TOKEN=your-x-user-access-token
# Optional. If omitted, the CLI calls /2/users/me.
X_USER_ID=123456789
# Optional. Defaults to data/x-archive.sqlite.
X_INGEST_DB_PATH=data/x-archive.sqlite
```

Run one page from both sources:

```bash
pnpm x:ingest
```

Run only bookmarks:

```bash
pnpm x:ingest -- --source=bookmarks
```

Run a larger backfill:

```bash
pnpm x:ingest -- --source=all --max-pages=all
```

The default is `--max-pages=1` to avoid accidental pay-per-use spend. Use an
integer or `all`/`full` when you are ready to backfill more pages.

Other options:

```bash
pnpm x:ingest -- --help
pnpm x:ingest -- --db=data/x-archive.sqlite --source=likes --max-pages=5
```

## Stored schema

The CLI creates these tables:

- `ingest_runs`: one row per CLI run with status and counts.
- `tweets`: normalized tweet fields plus `raw_json`.
- `users`: expanded author/user records plus `raw_json`.
- `media`: expanded media records plus `raw_json`.
- `tweet_sources`: many-to-many source mapping, so one post can be both a
  bookmark and a like.
- `api_errors`: partial API errors returned by X.
- `sync_state`: last completed run summary per source.

The schema intentionally stores raw JSON alongside normalized columns so future
fields from X can be recovered without re-ingesting.

## Example queries

Recently seen bookmarks:

```sql
SELECT t.created_at, u.username, t.text
FROM tweet_sources s
JOIN tweets t ON t.id = s.tweet_id
LEFT JOIN users u ON u.id = t.author_id
WHERE s.source = 'bookmarks'
ORDER BY s.last_seen_at DESC
LIMIT 25;
```

Posts that are both bookmarked and liked:

```sql
SELECT t.id, t.text
FROM tweets t
JOIN tweet_sources b ON b.tweet_id = t.id AND b.source = 'bookmarks'
JOIN tweet_sources l ON l.tweet_id = t.id AND l.source = 'likes';
```

Top authors in the archive:

```sql
SELECT u.username, COUNT(*) AS posts
FROM tweet_sources s
JOIN tweets t ON t.id = s.tweet_id
LEFT JOIN users u ON u.id = t.author_id
GROUP BY u.username
ORDER BY posts DESC
LIMIT 20;
```

## Limitations and next steps

- OAuth PKCE token acquisition is not implemented yet; generate a user token in
  the X Developer Console or add an OAuth helper before making this a polished
  app.
- The X API does not expose a true delta endpoint for bookmarks/likes here, so
  syncs page from the newest records. The local store deduplicates by tweet ID
  and source.
- Deleted/unliked/unbookmarked records are not removed automatically. A future
  reconciliation mode can compare a full source scan with local rows and mark
  missing records as inactive.
- Full-text search can be added with SQLite FTS5 once the basic archive shape is
  stable.
