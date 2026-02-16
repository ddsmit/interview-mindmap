****# Context Dump: Interview Mindmap Prototype

## Repository State
- Project path: `/Users/davidsmit/Documents/Interview`
- Stack: static HTML/CSS/JavaScript (no framework)
- Deployment target: Netlify (static publish)
- Content source: Markdown files under `/answers` with YAML front matter

## Current Files
- `/Users/davidsmit/Documents/Interview/index.html`
- `/Users/davidsmit/Documents/Interview/styles.css`
- `/Users/davidsmit/Documents/Interview/app.js`
- `/Users/davidsmit/Documents/Interview/netlify.toml`
- `/Users/davidsmit/Documents/Interview/answers/index.json`
- `/Users/davidsmit/Documents/Interview/answers/*.md` (sample answer files)

## Markdown Contract (Current)
Each answer file is expected to include:
1. YAML front matter
   - `question_categories`: array of slugs (e.g. `leadership`)
   - `situation_tag`: string slug
2. Body markdown
   - `#` Title
   - `## Situation`
   - `## Task`
   - `## Action`
   - `## Result`

## App Behavior (Current)
1. Load manifest from `/answers/index.json`.
2. Load each markdown file from `/answers/<file>.md`.
3. Parse front matter and STAR sections.
4. Render a node graph:
   - Root node: "Question Categories"
   - Category nodes around root
   - Situation nodes around selected category
5. Interaction:
   - Click category -> zoom/center focus
   - Non-selected categories are muted/greyed out
   - Breadcrumb + back button enabled in focused mode
   - Click situation -> open modal with STAR details
   - Close modal via button, backdrop click, or `Esc`

## UX Changes Already Applied
- Removed side panel details view.
- Added modal overlay for answer details.
- Added focused view with muted non-selected nodes.
- Added breadcrumb and back navigation.
- Added mobile-focused responsive adjustments.

## Local Run Command
From project root:
```bash
python3 -m http.server 8080
```
Open: `http://localhost:8080`

## Netlify Notes
- `netlify.toml` currently publishes project root (`.`).
- Static hosting cannot enumerate folder files client-side reliably.
- `/answers/index.json` must be updated when adding/removing answers.

## Known Limitations / Next Improvements
- No automated manifest generation.
- No drag/pan interactions on graph.
- No search/filter UI.
- Front matter parser is intentionally simple and expects straightforward YAML.
- No build/test tooling yet (pure static).
