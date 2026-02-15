# GitHub Key Scanner

A security research tool that scans public GitHub repositories for exposed API keys using **GH Archive** (no rate limits).

## Features

- **GH Archive Integration**: Uses free GH Archive data - no GitHub API rate limits for discovery
- **Multi-provider detection**: OpenAI, Anthropic, Gemini, Groq, Cerebras, OpenRouter, Grok
- **High-speed scanning**: 8 parallel workers, 30+ repos/minute
- **Smart filtering**: Aho-Corasick preflight, entropy validation, banlist filtering
- **Persistent tracking**: Never scans the same repo twice
- **Disclosure helper**: Generate issue templates to notify repo owners
- **Dark brutalist UI**: Data-first design, no bloat

## Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

1. **Create project**: Go to https://railway.app → New Project
2. **Add PostgreSQL**: Click + Add Service → Database → PostgreSQL
3. **Deploy app**: Click + Add Service → GitHub Repo → Select this repo
4. **Set env var**: In your app service → Variables → Add:
   - `GITHUB_TOKENS` = `ghp_xxx,ghp_yyy` (comma-separated PATs)
5. **Connect database**: Variables → Add Reference → Select `DATABASE_URL` from PostgreSQL

Railway auto-provides `DATABASE_URL` from PostgreSQL. Prisma handles migrations on build.

## How It Works

### No Rate Limits for Discovery

Instead of polling GitHub's rate-limited Events API, we use **GH Archive**:

```
https://data.gharchive.org/{YYYY-MM-DD-H}.json.gz
```

- **Free** - No authentication required
- **Complete** - All public GitHub events since 2011
- **Fast** - Download hourly archives in seconds
- **Updated hourly** - Fresh data every hour

### Architecture

```
GH Archive → Extract repos → Queue → 8 parallel scanners → Findings
    ↓              ↓                        ↓
 No rate      CreateEvent,            Scan files via
   limit      PushEvent,              GitHub API
              PublicEvent             (uses your tokens)
```

### Key Detection

1. **Aho-Corasick preflight**: O(n) keyword scan before regex
2. **Provider-specific regex**: Match key formats
3. **Entropy validation**: Shannon entropy ≥ 3.0
4. **Banlist filtering**: Skip placeholders, test keys
5. **Deduplication**: SHA-256 hash check

## Provider Patterns

| Provider | Pattern |
|----------|---------|
| OpenAI | `sk-proj-*` or `sk-*` (48+ chars) |
| Anthropic | `sk-ant-api03-*` |
| Gemini | `AIza*` |
| Groq | `gsk_*` |
| Cerebras | `csk-*` |
| OpenRouter | `sk-or-*` |
| Grok | `xai-*` |

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Auto | PostgreSQL URL (auto-provided by Railway) |
| `GITHUB_TOKENS` | Optional | Comma-separated GitHub PATs for API rate limits |

## Responsible Disclosure

When you find an exposed key:
1. Click **Disclose** on the finding
2. Review the pre-filled issue template
3. Click **Open New Issue** to notify the repo owner