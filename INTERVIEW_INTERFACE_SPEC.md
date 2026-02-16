# Spec: Interview Drill-In Mindmap Interface

## 1. Objective
Create a lightweight, static web app for interview support that enables fast retrieval of STAR stories by drilling from question category -> situation -> detailed response.

## 2. Product Goals
- Minimize cognitive load during interviews.
- Optimize retrieval speed under pressure.
- Keep deploy/run model simple (Netlify static hosting).
- Use markdown as content source of truth.

## 3. Non-Goals
- CMS/editor UI in v1.
- Authentication or multi-user support.
- Backend database/API in v1.

## 4. Primary User Flow
1. User lands on graph overview of categories.
2. User clicks a category based on interview question type.
3. Graph focuses selected category; irrelevant nodes are de-emphasized.
4. User clicks a situation bubble.
5. Modal opens with STAR answer details.
6. User navigates back via breadcrumb/back controls.

## 5. Information Architecture
- Root: Question Categories
- Category node: one question category slug
- Situation node: one answer/story mapped to category
- Detail view: STAR response for selected situation

## 6. Content Model
Each answer markdown file must support:

```yaml
---
question_categories:
  - leadership
  - conflict-resolution
situation_tag: payment-system-migration
---
```

Body structure:
```md
# Story Title
## Situation
...
## Task
...
## Action
...
## Result
...
```

## 7. Data Loading Strategy
- Manifest-driven file discovery via `/answers/index.json`.
- Client fetches manifest first, then fetches each markdown file.
- Parse on client side into normalized objects:
  - `tag`
  - `categories[]`
  - `title`
  - `sections.{Situation,Task,Action,Result}`

## 8. Functional Requirements
- Render node graph with root/category/situation nodes.
- Category selection triggers zoom/center focus.
- Non-selected categories and irrelevant links are muted.
- Situation selection opens modal with STAR details.
- Modal supports close by button, backdrop, and Escape key.
- Breadcrumb reflects location:
  - `Home`
  - `Home / <Category>`
  - `Home / <Category> / <Situation>`
- Back button behavior:
  - From situation: close modal to category view
  - From category: return to home view

## 9. Responsive/Mobile Requirements
- App must work at 320px+ widths.
- Header controls must wrap/stack on narrow screens.
- Node labels and bubble sizes must scale down on mobile.
- Modal must fit within viewport and allow internal scrolling.
- Touch targets should remain usable.

## 10. Accessibility Requirements
- Keyboard operable buttons for all nodes/controls.
- Visible focus states for controls.
- Modal uses dialog semantics (`role="dialog"`, `aria-modal="true"`).
- Escape key closes modal.

## 11. Performance Requirements
- Initial render under 1s for <= 100 markdown files on modern laptop.
- Client-only parsing; no external runtime dependencies.

## 12. Deployment Requirements (Netlify)
- Static files only.
- `publish = "."` in `netlify.toml`.
- Ensure answers are deployed with site.
- Keep cache for markdown content conservative while iterating.

## 13. Suggested Future Enhancements
- Script to auto-generate `/answers/index.json`.
- Search by keyword/tag/category.
- Pin/favorites shortlist for likely interview topics.
- Graph drag/pan and optional zoom controls.
- Print view / compact cheat sheet mode.
- Optional localStorage for recency or starred stories.

## 14. Acceptance Criteria (v1)
- Selecting category clearly focuses relevant nodes.
- Selecting situation opens STAR details in modal.
- Back/breadcrumb navigation is clear and deterministic.
- Works on desktop and mobile.
- Deploys on Netlify without build step.
