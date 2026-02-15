# GitHub Key Scanner

A security research tool that scans public GitHub repositories for exposed API keys using **GH Archive** (no rate limits).

## Features

- **GH Archive Integration**: Uses free GH Archive data - no GitHub API rate limits for discovery
- **Multi-provider detection**: OpenAI, Anthropic, Gemini, Groq, Cerebras, OpenRouter, Grok
- **High-speed scanning**: 8 parallel workers, unlimited repos
- **Smart filtering**: Aho-Corasick preflight, entropy validation, banlist filtering
- **Persistent tracking**: Never scans the same repo twice
- **Disclosure helper**: Generate issue templates to notify repo owners
- **Dark brutalist UI**: Data-first design, no bloat

## Deploy to Vercel (Free, 5 minutes)

### Step 1: Create Turso Database (Free)

1. Go to **https://turso.tech** → Sign in with GitHub
2. Click **Create Database** → Name: `github-scanner`
3. Copy the **Database URL**
4. Go to **Settings** → **API Tokens** → Create token

### Step 2: Deploy to Vercel

1. Go to **https://vercel.com/new**
2. Import your fork of this repo
3. Add Environment Variables:

| Name | Value |
|------|-------|
| `TURSO_DATABASE_URL` | `libsql://your-db.turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJhbGciOiJ...` |
| `GITHUB_TOKENS` | `ghp_your_token_here` (optional, for file scanning) |

4. Click **Deploy**

### Step 3: Initialize Database

Visit: `https://your-app.vercel.app/api/setup`

This auto-creates all required tables.

**Done!**

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

## Free Tier Limits

| Service | Free Limit |
|---------|------------|
| **GH Archive** | Unlimited |
| **Vercel** | 100GB bandwidth, 6000 min/month |
| **Turso** | 9GB storage, unlimited reads |
| **GitHub API** | 5,000 req/hr per token (optional) |

## Local Development

```bash
npm install
npx prisma generate  
npm run dev
```

Open http://localhost:3000

## Responsible Disclosure

When you find an exposed key:
1. Click **Disclose** on the finding
2. Review the pre-filled issue template
3. Click **Open New Issue** to notify the repo owner
