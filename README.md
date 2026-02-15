# GitHub Key Scanner

A security research tool that scans public GitHub repositories for exposed API keys.

## Features

- **Multi-provider detection**: OpenAI, Anthropic, Gemini, Groq, Cerebras, OpenRouter, Grok
- **High-speed scanning**: 8 parallel workers, 10+ repos/minute
- **Smart filtering**: Aho-Corasick preflight, entropy validation, banlist filtering
- **Persistent tracking**: Never scans the same repo twice
- **Disclosure helper**: Generate issue templates to notify repo owners
- **Dark brutalist UI**: Data-first design, no bloat

## Deploy to Vercel (Free)

### Step 1: Fork this repo

### Step 2: Create Vercel Postgres Database

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your forked repo
3. Go to **Storage** → **Create Database** → **Postgres**
4. Copy the `DATABASE_URL` and `DIRECT_DATABASE_URL`

### Step 3: Add Environment Variables

In Vercel dashboard → Settings → Environment Variables:

| Name | Value |
|------|-------|
| `GITHUB_TOKENS` | `ghp_your_token_here` (comma-separated for multiple) |
| `DATABASE_URL` | (auto-added by Vercel Postgres) |
| `DIRECT_DATABASE_URL` | (auto-added by Vercel Postgres) |

### Step 4: Deploy

Click **Deploy**. Vercel will:
1. Run `prisma generate`
2. Build the Next.js app
3. Deploy to edge

### Step 5: Initialize Database

After deployment, run migrations:

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Run migrations
vercel env pull .env
npx prisma db push
```

Or use Vercel's **Prisma integration** to auto-migrate.

## Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Create local SQLite database
npx prisma db push

# Start dev server
npm run dev
```

## Rate Limits

| Auth | Requests/Hour |
|------|---------------|
| No token | 60 |
| 1 GitHub PAT | 5,000 |
| 5 GitHub PATs | 25,000 |

Add multiple tokens in Settings for faster scanning.

## How It Works

1. **Discovery**: Polls GitHub Events API for new public repos
2. **Queue**: Adds repos to queue (skips already scanned)
3. **Scanning**: 8 parallel workers scan files via GitHub API
4. **Detection**: Aho-Corasick keyword match → regex validation → entropy check
5. **Storage**: Findings saved to Postgres with masked keys
6. **Disclosure**: One-click to generate GitHub issue template

## Responsible Disclosure

When you find an exposed key:
1. Click **Disclose** on the finding
2. Review the pre-filled issue template
3. Click **Open New Issue** to notify the repo owner
4. Owner can rotate the key and remove from git history

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Next.js API Routes, Server-Sent Events
- **Database**: Vercel Postgres (Prisma ORM)
- **Detection**: Aho-Corasick algorithm, Shannon entropy
