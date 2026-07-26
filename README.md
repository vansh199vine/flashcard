# Flashcard Creator

A minimal, Apple-inspired flashcard app with freeform filter groupings,
rich-text descriptions (bold/italic/underline/highlight), and a
Quizlet-style shuffle-and-flip quiz mode.

## Run it locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Push it to GitHub

If this is a brand new project with no git history yet, run these from
inside the `flashcard-creator` folder:

```bash
git init
git add .
git commit -m "Initial commit: flashcard creator app"
git branch -M main
```

Then create an empty repository on GitHub (no README/license, so it
stays empty) — either on github.com via "New repository", or with the
GitHub CLI:

```bash
gh repo create flashcard-creator --public --source=. --remote=origin
```

If you created it on the website instead, connect it manually (replace
the URL with the one from your new repo's page):

```bash
git remote add origin https://github.com/YOUR-USERNAME/flashcard-creator.git
```

Then push:

```bash
git push -u origin main
```

After this first push, future updates are just:

```bash
git add .
git commit -m "Describe what changed"
git push
```

## Note on data storage

This version uses the browser's `localStorage` to persist your
flashcards, so they'll be there next time you open the app in the same
browser. That's different from the Claude.ai artifact version, which
used Claude's own storage API — this copy is a self-contained web app,
so it uses the standard browser mechanism instead.
