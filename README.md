# GitHub Key Scanner

A security research tool that scans public GitHub repositories for exposed API keys.

## Deploy to Vercel (Free, 5 minutes)

### Step 1: Create Turso Database (Free)

1. Go to **https://turso.tech** → Sign in with GitHub
2. Click **Create Database**
3. Name it `github-scanner`
4. Copy the **Database URL** (looks like `libsql://github-scanner-xxx.turso.io`)
5. Go to **Settings** → **API Tokens** → Create token
6. Copy the **Auth Token**

### Step 2: Deploy to Vercel

1. Go to **https://vercel.com/new**
2. Import `vedanth-jadhav/github-scanner`
3. Add Environment Variables:

| Name | Value |
|------|-------|
| `TURSO_DATABASE_URL` | `libsql://your-db.turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJhbGciOiJ...` |
| `GITHUB_TOKENS` | `ghp_your_token_here` |

4. Click **Deploy**

### Step 3: Initialize Database

After deployment, create tables in Turso:

1. Go to Turso Dashboard → your database → **SQL Console**
2. Run this SQL:

```sql
CREATE TABLE "Finding" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "keyMasked" TEXT NOT NULL,
  "keyHash" TEXT UNIQUE NOT NULL,
  "repoOwner" TEXT NOT NULL,
  "repoName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "line" INTEGER,
  "githubUrl" TEXT NOT NULL,
  "foundAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "disclosed" INTEGER DEFAULT 0,
  "disclosedAt" DATETIME
);

CREATE TABLE "ScannedRepo" (
  "id" TEXT PRIMARY KEY,
  "owner" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fullName" TEXT UNIQUE NOT NULL,
  "scannedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "findings" INTEGER DEFAULT 0
);

CREATE TABLE "Token" (
  "id" TEXT PRIMARY KEY,
  "token" TEXT UNIQUE NOT NULL,
  "name" TEXT,
  "active" INTEGER DEFAULT 1,
  "usedAt" DATETIME,
  "usage" INTEGER DEFAULT 0,
  "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ScanLog" (
  "id" TEXT PRIMARY KEY,
  "repoOwner" TEXT NOT NULL,
  "repoName" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "findings" INTEGER DEFAULT 0,
  "duration" INTEGER,
  "error" TEXT,
  "scannedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Done!** Your scanner is live.

## Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Start dev server (uses local SQLite)
npm run dev
```

## Features

- **Multi-provider detection**: OpenAI, Anthropic, Gemini, Groq, Cerebras, OpenRouter, Grok
- **High-speed scanning**: 8 parallel workers, 10+ repos/minute  
- **Smart filtering**: Aho-Corasick preflight, entropy validation, banlist
- **Persistent tracking**: Never scans the same repo twice
- **Disclosure helper**: Generate GitHub issue templates
- **Dark brutalist UI**: Data-first, no bloat

## Free Tier Limits

| Service | Free Limit |
|---------|------------|
| **Vercel** | 100GB bandwidth, 6000 min/month |
| **Turso** | 9GB storage, unlimited reads |
| **GitHub API** | 5,000 req/hr per token |

## How It Works

1. Polls GitHub Events API for new public repos
2. Scans files via GitHub Contents API
3. Detects keys with Aho-Corasick + regex + entropy
4. Stores masked findings in Turso
5. One-click disclosure via GitHub issues
