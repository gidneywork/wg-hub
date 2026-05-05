# WG Hub — Personal Performance Dashboard

Your private ultra-marathon training and performance tracking app.
Accessible from mobile, desktop, and TV once deployed.

---

## What You'll Need

All free. No credit card required for any of these.

- **GitHub account** — github.com (stores your code)
- **Supabase account** — supabase.com (your database)
- **Vercel account** — vercel.com (hosts the live website)
- **Node.js** installed on your computer — nodejs.org (download the LTS version)

---

## Step 1 — Get the Code on GitHub

1. Go to **github.com** and sign in
2. Click the **+** button → **New repository**
3. Name it `wg-hub`, set it to **Private**, click **Create repository**
4. On your computer, open a terminal in the `wg-hub` folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/wg-hub.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 2 — Set Up Supabase (Your Database)

1. Go to **supabase.com** → **Start your project** → sign in with GitHub
2. Click **New project**, give it a name (e.g. `wg-hub`), pick a region close to you, set a strong password, click **Create new project**
3. Wait ~2 minutes for it to spin up
4. In the left sidebar, click **SQL Editor** → click **+ New query**
5. Paste the following SQL and click **Run**:

```sql
-- Daily training logs (one row per date)
CREATE TABLE daily_logs (
  date    DATE        PRIMARY KEY,
  data    JSONB       NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- App settings (stores settings + training plan as JSON)
CREATE TABLE app_settings (
  key     TEXT        PRIMARY KEY,
  value   JSONB       NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security: only authenticated users can access data
ALTER TABLE daily_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access only" ON daily_logs
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated access only" ON app_settings
  FOR ALL USING (auth.role() = 'authenticated');
```

6. **Create your login account**: in the left sidebar go to **Authentication** → **Users** → **Invite user**, enter your email and click Send. Check your email and set a password via the link.

   *(Alternatively: Authentication → Users → Add user → enter email + password directly)*

7. **Get your API keys**: go to **Settings** (gear icon) → **API**
   - Copy the **Project URL** (looks like `https://xxxx.supabase.co`)
   - Copy the **anon / public** key (long string starting with `eyJ`)
   - Keep these — you'll need them in Step 4

---

## Step 3 — Run Locally (Optional but Recommended)

Test that everything works on your computer before going live.

1. In the `wg-hub` folder, copy the example env file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` in a text editor and fill in your two Supabase values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. Install dependencies and start the app:
   ```bash
   npm install
   npm run dev
   ```

4. Open **http://localhost:3000** in your browser. Sign in with the account you created in Step 2.

---

## Step 4 — Deploy to Vercel (Go Live)

1. Go to **vercel.com** → sign in with GitHub
2. Click **Add New... → Project**
3. Find `wg-hub` in your GitHub repositories → click **Import**
4. On the configuration screen, expand **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your Supabase anon key
5. Click **Deploy** and wait ~1 minute

Vercel will give you a live URL like `https://wg-hub-xxxx.vercel.app`.
Every time you push code to GitHub, Vercel automatically redeploys.

---

## Step 5 — Access on Mobile, Desktop & TV

**Mobile / Desktop**: just visit your Vercel URL in any browser and bookmark it. On mobile, you can add it to your home screen (Share → Add to Home Screen on iOS, or the browser menu on Android) for a native-app feel.

**TV**: open the browser on your TV, navigate to your Vercel URL, sign in once, and navigate to **TV MODE** in the app. Bookmark that page. The TV mode displays large metrics and auto-refreshes every 30 seconds — designed to sit passively on screen.

---

## Making Updates

Whenever you want to update the app (new features, tweaks), edit the code on your computer and run:

```bash
git add .
git commit -m "Describe what you changed"
git push
```

Vercel picks up the push and automatically deploys the new version within ~60 seconds.

---

## Custom Domain (Optional)

If you want a cleaner URL like `wghub.com`:
1. Buy a domain from any registrar (Namecheap, Cloudflare, etc.)
2. In Vercel → your project → **Settings → Domains** → add your domain
3. Follow Vercel's DNS instructions (takes ~10 minutes to propagate)

---

## Troubleshooting

**"Missing Supabase environment variables"** — check your `.env.local` file has both variables filled in (no quotes around the values, no trailing spaces).

**Sign in fails** — make sure you created a user in Supabase's Authentication → Users section. The app doesn't have a sign-up page by design.

**Data not saving** — check the Supabase SQL Editor that both tables exist and the RLS policies were created.

**TV mode looks wrong** — use the browser's full-screen mode (usually F11 or the TV browser's menu) to hide the browser chrome.
