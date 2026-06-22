import process from 'node:process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { setTimeout as sleep } from 'node:timers/promises'

type SourceName = 'bookmarks' | 'likes'

type JsonObject = Record<string, unknown>

type XUser = JsonObject & {
  id: string
  username?: string
  name?: string
  verified?: boolean
  profile_image_url?: string
}

type XMedia = JsonObject & {
  media_key: string
  type?: string
  url?: string
  preview_image_url?: string
  width?: number
  height?: number
  alt_text?: string
}

type XTweet = JsonObject & {
  id: string
  text?: string
  author_id?: string
  created_at?: string
  conversation_id?: string
  in_reply_to_user_id?: string
  lang?: string
  public_metrics?: unknown
  entities?: unknown
  attachments?: unknown
  referenced_tweets?: unknown
  context_annotations?: unknown
}

type XIncludes = {
  tweets?: XTweet[]
  users?: XUser[]
  media?: XMedia[]
}

type XPage = {
  data?: XTweet[]
  includes?: XIncludes
  errors?: unknown[]
  meta?: {
    next_token?: string
    result_count?: number
  }
}

type CliOptions = {
  accessToken: string
  databasePath: string
  maxPages: number | null
  sources: SourceName[]
  userId?: string
}

const X_API_BASE = 'https://api.x.com/2'

const SOURCE_ENDPOINTS: Record<SourceName, string> = {
  bookmarks: 'bookmarks',
  likes: 'liked_tweets',
}

const TWEET_FIELDS = [
  'attachments',
  'author_id',
  'context_annotations',
  'conversation_id',
  'created_at',
  'edit_history_tweet_ids',
  'entities',
  'id',
  'in_reply_to_user_id',
  'lang',
  'note_tweet',
  'possibly_sensitive',
  'public_metrics',
  'referenced_tweets',
  'reply_settings',
  'source',
  'text',
  'withheld',
]

const EXPANSIONS = [
  'attachments.media_keys',
  'author_id',
  'entities.mentions.username',
  'in_reply_to_user_id',
  'referenced_tweets.id',
  'referenced_tweets.id.author_id',
  'referenced_tweets.id.attachments.media_keys',
]

const USER_FIELDS = [
  'created_at',
  'description',
  'entities',
  'id',
  'location',
  'name',
  'profile_image_url',
  'protected',
  'public_metrics',
  'url',
  'username',
  'verified',
  'verified_type',
  'withheld',
]

const MEDIA_FIELDS = [
  'alt_text',
  'duration_ms',
  'height',
  'media_key',
  'preview_image_url',
  'public_metrics',
  'type',
  'url',
  'variants',
  'width',
]

loadEnvironment()

async function main(): Promise<void> {
  let db: DatabaseSync | undefined
  let runId: number | undefined

  try {
    const options = parseCliOptions()
    db = openDatabase(options.databasePath)
    runId = startRun(db, options.sources)

    const summary = await ingest(options, db, runId)
    finishRun(db, runId, 'completed', summary.pagesFetched, summary.itemsSeen)
    console.log(
      `Done. Stored ${summary.itemsSeen} source records from ${summary.pagesFetched} page(s) in ${options.databasePath}.`,
    )
  } catch (error: unknown) {
    const message = formatError(error)
    if (db && runId !== undefined) {
      finishRun(db, runId, 'failed', 0, 0, message)
    }
    console.error(message)
    process.exitCode = 1
  } finally {
    db?.close()
  }
}

function loadEnvironment(): void {
  if (existsSync('.env')) {
    process.loadEnvFile('.env')
  }
}

async function ingest(
  options: CliOptions,
  db: DatabaseSync,
  runId: number,
): Promise<{ pagesFetched: number; itemsSeen: number }> {
  const user = options.userId
    ? { id: options.userId }
    : await fetchAuthenticatedUser(options.accessToken)

  if ('username' in user && user.username) {
    console.log(`Authenticated as @${user.username} (${user.id}).`)
    upsertUsers(db, [user])
  } else {
    console.log(`Using X user ID ${user.id}.`)
  }

  let totalPages = 0
  let totalItems = 0

  for (const source of options.sources) {
    const sourceSummary = await ingestSource({
      accessToken: options.accessToken,
      db,
      maxPages: options.maxPages,
      runId,
      source,
      userId: user.id,
    })
    totalPages += sourceSummary.pagesFetched
    totalItems += sourceSummary.itemsSeen
  }

  return { pagesFetched: totalPages, itemsSeen: totalItems }
}

async function ingestSource({
  accessToken,
  db,
  maxPages,
  runId,
  source,
  userId,
}: {
  accessToken: string
  db: DatabaseSync
  maxPages: number | null
  runId: number
  source: SourceName
  userId: string
}): Promise<{ pagesFetched: number; itemsSeen: number }> {
  let nextToken: string | undefined
  let pagesFetched = 0
  let itemsSeen = 0

  do {
    const pageLimitReached = maxPages !== null && pagesFetched >= maxPages
    if (pageLimitReached) {
      break
    }

    const page = await fetchSourcePage({
      accessToken,
      nextToken,
      source,
      userId,
    })
    const stored = storePage(db, runId, source, page)

    pagesFetched += 1
    itemsSeen += stored.sourceRecords
    nextToken = page.meta?.next_token

    console.log(
      `${source}: page ${pagesFetched}, ${stored.sourceRecords} item(s), next=${nextToken ? 'yes' : 'no'}.`,
    )
  } while (nextToken)

  updateSyncState(db, source, pagesFetched, itemsSeen)

  return { pagesFetched, itemsSeen }
}

async function fetchAuthenticatedUser(accessToken: string): Promise<XUser> {
  const page = await xGet<{ data: XUser }>('/users/me', accessToken, {
    'user.fields': USER_FIELDS.join(','),
  })

  return page.data
}

async function fetchSourcePage({
  accessToken,
  nextToken,
  source,
  userId,
}: {
  accessToken: string
  nextToken?: string
  source: SourceName
  userId: string
}): Promise<XPage> {
  const endpoint = SOURCE_ENDPOINTS[source]
  const params: Record<string, string> = {
    expansions: EXPANSIONS.join(','),
    max_results: '100',
    'media.fields': MEDIA_FIELDS.join(','),
    'tweet.fields': TWEET_FIELDS.join(','),
    'user.fields': USER_FIELDS.join(','),
  }

  if (nextToken) {
    params.pagination_token = nextToken
  }

  return xGet<XPage>(`/users/${userId}/${endpoint}`, accessToken, params)
}

async function xGet<T>(
  path: string,
  accessToken: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`${X_API_BASE}${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetchWithRetry(url, accessToken)
  const json = (await response.json()) as T
  return json
}

async function fetchWithRetry(
  url: URL,
  accessToken: string,
  attempts = 3,
): Promise<Response> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (response.ok) {
      return response
    }

    if (response.status === 429 && attempt < attempts) {
      const delayMs = rateLimitDelayMs(response, attempt)
      console.warn(`Rate limited by X API. Retrying in ${Math.ceil(delayMs / 1000)}s.`)
      await sleep(delayMs)
      continue
    }

    const body = await response.text()
    throw new Error(`X API ${response.status} ${response.statusText}: ${body}`)
  }

  throw new Error('X API request failed after retries.')
}

function rateLimitDelayMs(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000
  }

  const resetSeconds = Number(response.headers.get('x-rate-limit-reset'))
  if (Number.isFinite(resetSeconds) && resetSeconds > 0) {
    return Math.max(resetSeconds * 1000 - Date.now() + 1000, 1000)
  }

  return Math.min(2 ** attempt * 1000, 30_000)
}

function openDatabase(databasePath: string): DatabaseSync {
  mkdirSync(dirname(databasePath), { recursive: true })
  const db = new DatabaseSync(databasePath)

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS ingest_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
      sources_json TEXT NOT NULL,
      pages_fetched INTEGER NOT NULL DEFAULT 0,
      items_seen INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS tweets (
      id TEXT PRIMARY KEY,
      text TEXT,
      author_id TEXT,
      created_at TEXT,
      conversation_id TEXT,
      in_reply_to_user_id TEXT,
      lang TEXT,
      public_metrics_json TEXT,
      entities_json TEXT,
      attachments_json TEXT,
      referenced_tweets_json TEXT,
      context_annotations_json TEXT,
      raw_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT,
      name TEXT,
      verified INTEGER,
      profile_image_url TEXT,
      raw_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media (
      media_key TEXT PRIMARY KEY,
      type TEXT,
      url TEXT,
      preview_image_url TEXT,
      width INTEGER,
      height INTEGER,
      alt_text TEXT,
      raw_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tweet_sources (
      tweet_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('bookmarks', 'likes')),
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      last_ingest_run_id INTEGER NOT NULL,
      PRIMARY KEY (tweet_id, source),
      FOREIGN KEY (tweet_id) REFERENCES tweets(id) ON DELETE CASCADE,
      FOREIGN KEY (last_ingest_run_id) REFERENCES ingest_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tweet_sources_source_seen
      ON tweet_sources (source, last_seen_at DESC);

    CREATE INDEX IF NOT EXISTS idx_tweets_author_created
      ON tweets (author_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS api_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingest_run_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      response_json TEXT NOT NULL,
      seen_at TEXT NOT NULL,
      FOREIGN KEY (ingest_run_id) REFERENCES ingest_runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      source TEXT PRIMARY KEY CHECK (source IN ('bookmarks', 'likes')),
      last_completed_at TEXT NOT NULL,
      pages_fetched INTEGER NOT NULL,
      items_seen INTEGER NOT NULL
    );
  `)

  return db
}

function startRun(db: DatabaseSync, sources: SourceName[]): number {
  const result = db
    .prepare(
      `INSERT INTO ingest_runs (started_at, status, sources_json)
       VALUES (?, 'running', ?)`,
    )
    .run(new Date().toISOString(), JSON.stringify(sources))

  return Number(result.lastInsertRowid)
}

function finishRun(
  db: DatabaseSync,
  runId: number,
  status: 'completed' | 'failed',
  pagesFetched: number,
  itemsSeen: number,
  error?: string,
): void {
  db.prepare(
    `UPDATE ingest_runs
     SET completed_at = ?, status = ?, pages_fetched = ?, items_seen = ?, error = ?
     WHERE id = ?`,
  ).run(new Date().toISOString(), status, pagesFetched, itemsSeen, error ?? null, runId)
}

function storePage(
  db: DatabaseSync,
  runId: number,
  source: SourceName,
  page: XPage,
): { sourceRecords: number } {
  db.exec('BEGIN')
  try {
    upsertTweets(db, [...(page.data ?? []), ...(page.includes?.tweets ?? [])])
    upsertUsers(db, page.includes?.users ?? [])
    upsertMedia(db, page.includes?.media ?? [])
    upsertTweetSources(db, runId, source, page.data ?? [])
    storeApiErrors(db, runId, source, page.errors ?? [])
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return { sourceRecords: page.data?.length ?? 0 }
}

function upsertTweets(db: DatabaseSync, tweets: XTweet[]): void {
  const now = new Date().toISOString()
  const statement = db.prepare(`
    INSERT INTO tweets (
      id,
      text,
      author_id,
      created_at,
      conversation_id,
      in_reply_to_user_id,
      lang,
      public_metrics_json,
      entities_json,
      attachments_json,
      referenced_tweets_json,
      context_annotations_json,
      raw_json,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      text = excluded.text,
      author_id = excluded.author_id,
      created_at = excluded.created_at,
      conversation_id = excluded.conversation_id,
      in_reply_to_user_id = excluded.in_reply_to_user_id,
      lang = excluded.lang,
      public_metrics_json = excluded.public_metrics_json,
      entities_json = excluded.entities_json,
      attachments_json = excluded.attachments_json,
      referenced_tweets_json = excluded.referenced_tweets_json,
      context_annotations_json = excluded.context_annotations_json,
      raw_json = excluded.raw_json,
      updated_at = excluded.updated_at
  `)

  for (const tweet of tweets) {
    statement.run(
      tweet.id,
      tweet.text ?? null,
      tweet.author_id ?? null,
      tweet.created_at ?? null,
      tweet.conversation_id ?? null,
      tweet.in_reply_to_user_id ?? null,
      tweet.lang ?? null,
      stringifyJson(tweet.public_metrics),
      stringifyJson(tweet.entities),
      stringifyJson(tweet.attachments),
      stringifyJson(tweet.referenced_tweets),
      stringifyJson(tweet.context_annotations),
      JSON.stringify(tweet),
      now,
    )
  }
}

function upsertUsers(db: DatabaseSync, users: XUser[]): void {
  const now = new Date().toISOString()
  const statement = db.prepare(`
    INSERT INTO users (id, username, name, verified, profile_image_url, raw_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      name = excluded.name,
      verified = excluded.verified,
      profile_image_url = excluded.profile_image_url,
      raw_json = excluded.raw_json,
      updated_at = excluded.updated_at
  `)

  for (const user of users) {
    statement.run(
      user.id,
      user.username ?? null,
      user.name ?? null,
      booleanToInteger(user.verified),
      user.profile_image_url ?? null,
      JSON.stringify(user),
      now,
    )
  }
}

function upsertMedia(db: DatabaseSync, mediaItems: XMedia[]): void {
  const now = new Date().toISOString()
  const statement = db.prepare(`
    INSERT INTO media (
      media_key,
      type,
      url,
      preview_image_url,
      width,
      height,
      alt_text,
      raw_json,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(media_key) DO UPDATE SET
      type = excluded.type,
      url = excluded.url,
      preview_image_url = excluded.preview_image_url,
      width = excluded.width,
      height = excluded.height,
      alt_text = excluded.alt_text,
      raw_json = excluded.raw_json,
      updated_at = excluded.updated_at
  `)

  for (const media of mediaItems) {
    statement.run(
      media.media_key,
      media.type ?? null,
      media.url ?? null,
      media.preview_image_url ?? null,
      media.width ?? null,
      media.height ?? null,
      media.alt_text ?? null,
      JSON.stringify(media),
      now,
    )
  }
}

function upsertTweetSources(
  db: DatabaseSync,
  runId: number,
  source: SourceName,
  tweets: XTweet[],
): void {
  const now = new Date().toISOString()
  const statement = db.prepare(`
    INSERT INTO tweet_sources (
      tweet_id,
      source,
      first_seen_at,
      last_seen_at,
      last_ingest_run_id
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(tweet_id, source) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      last_ingest_run_id = excluded.last_ingest_run_id
  `)

  for (const tweet of tweets) {
    statement.run(tweet.id, source, now, now, runId)
  }
}

function storeApiErrors(
  db: DatabaseSync,
  runId: number,
  source: SourceName,
  errors: unknown[],
): void {
  if (errors.length === 0) {
    return
  }

  const now = new Date().toISOString()
  const statement = db.prepare(`
    INSERT INTO api_errors (ingest_run_id, source, response_json, seen_at)
    VALUES (?, ?, ?, ?)
  `)

  for (const error of errors) {
    statement.run(runId, source, JSON.stringify(error), now)
  }
}

function updateSyncState(
  db: DatabaseSync,
  source: SourceName,
  pagesFetched: number,
  itemsSeen: number,
): void {
  db.prepare(`
    INSERT INTO sync_state (source, last_completed_at, pages_fetched, items_seen)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(source) DO UPDATE SET
      last_completed_at = excluded.last_completed_at,
      pages_fetched = excluded.pages_fetched,
      items_seen = excluded.items_seen
  `).run(source, new Date().toISOString(), pagesFetched, itemsSeen)
}

function parseCliOptions(): CliOptions {
  if (hasFlag('help') || hasFlag('h')) {
    printHelp()
    process.exit(0)
  }

  const accessToken = readArg('access-token') ?? process.env.X_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('Missing X access token. Set X_ACCESS_TOKEN or pass --access-token=...')
  }

  return {
    accessToken,
    databasePath: resolve(readArg('db') ?? process.env.X_INGEST_DB_PATH ?? 'data/x-archive.sqlite'),
    maxPages: parseMaxPages(readArg('max-pages') ?? process.env.X_INGEST_MAX_PAGES ?? '1'),
    sources: parseSources(readArg('source') ?? process.env.X_INGEST_SOURCE ?? 'all'),
    userId: readArg('user-id') ?? process.env.X_USER_ID,
  }
}

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const exact = `--${name}`
  const args = process.argv.slice(2)

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length)
    }
    if (arg === exact) {
      return args[index + 1]
    }
  }

  return undefined
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`)
}

function parseMaxPages(value: string): number | null {
  if (value === 'all' || value === 'full') {
    return null
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('--max-pages must be a positive integer, "all", or "full".')
  }

  return parsed
}

function parseSources(value: string): SourceName[] {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.includes('all')) {
    return ['bookmarks', 'likes']
  }

  const sources = parts.map((part) => {
    if (part === 'bookmarks' || part === 'likes') {
      return part
    }
    throw new Error('--source must be "all", "bookmarks", "likes", or a comma-separated subset.')
  })

  if (sources.length === 0) {
    throw new Error('--source must include at least one source.')
  }

  return sources
}

function stringifyJson(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value)
}

function booleanToInteger(value: boolean | undefined): number | null {
  if (value === undefined) {
    return null
  }

  return value ? 1 : 0
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function printHelp(): void {
  console.log(`
Usage:
  pnpm x:ingest -- --source=all --max-pages=1 --db=data/x-archive.sqlite

Environment:
  X_ACCESS_TOKEN       Required user access token.
  X_USER_ID            Optional; if omitted, the CLI calls /2/users/me.
  X_INGEST_DB_PATH     Optional SQLite path. Defaults to data/x-archive.sqlite.
  X_INGEST_SOURCE      Optional: all, bookmarks, likes, or comma-separated subset.
  X_INGEST_MAX_PAGES   Optional positive integer, "all", or "full". Defaults to 1.

Options:
  --access-token=...   Override X_ACCESS_TOKEN.
  --user-id=...        Override X_USER_ID.
  --db=...             SQLite database path.
  --source=...         all, bookmarks, likes, or comma-separated subset.
  --max-pages=...      Positive integer, "all", or "full".
  --help               Show this help.

Required X OAuth scopes:
  bookmark.read like.read tweet.read users.read
`)
}

void main()
