# The Lens Publication — Frontend

This repository houses the complete frontend interface for **The Lens Publication**, including the public-facing news magazine website, staff editorial portals, role-based dashboards, styling, scripts, and component templates.

---

## Repository Structure

```text
├── index.html                   # Public magazine homepage
├── *.html                       # Static HTML portals and reader pages
├── css/                         # Production CSS stylesheets (modular per view & component)
├── js/                          # Client-side JavaScript modules, state handlers & APIs
├── images/                      # Covers, editorial artwork, icons, and logos
├── documents/                   # CSV document templates & financial liquidation sheets
├── uploads/                     # Uploaded editorial and cartoon assets
├── resources/
│   ├── views/                   # Blade templates (layouts, components, portals)
│   │   ├── cartoonist/          # Cartoonist & Cartoonist Head portals
│   │   ├── components/          # Reusable UI partials (sidebars, navigation, modals)
│   │   ├── eic/                 # Editor-in-Chief management & editorial desk
│   │   ├── executive/           # Executive Board portals & reviews
│   │   ├── layouts/             # Role-specific master layouts
│   │   ├── media/               # Media & Photography submission & desk
│   │   ├── mpc/                 # Media & Public Communications desk
│   │   └── writer/              # Writer dashboard & article workflows
│   ├── css/                     # Tailwind & Vite application styling
│   └── js/                      # Application entry & bootstrapping scripts
├── package.json                 # Node package configuration (Vite, Tailwind CSS)
└── vite.config.js               # Frontend bundler & asset build configuration
```

---

## Portals & Pages Included

### 1. Public Magazine
- **`index.html`**: Main publication landing page with hero feature, latest releases, and trending articles.
- **`about.html`**: Editorial board, publication history, Facebook feed, and transparency library.
- **`archives.html`**: Published issue archives and historical article browsing.
- **`author.html`**: Author profiles with published stories, bio, and byline details.
- **`feedback.html`**: Reader feedback submission form to the editorial team.
- **`login.html`**: Multi-role authentication interface for staff and editors.
- **`members.html`**: Directory of 19 editorial leadership positions and staff roster.
- **Category Feeds**: `news.html`, `opinion.html`, `features.html`, `literature.html`, `science.html`, `latest.html`.

### 2. Staff & Editorial Portals
- **Writer**: `writer-dashboard.html`, `writer-manage-articles.html`, `writer-submit-article.html`, `writer-profile-settings.html`.
- **Cartoonist & Cartoonist Head**: `cartoonist-dashboard.html`, `cartoonist-submit-cartoon.html`, `cartoonist-manage-cartoons.html`, `cartoonist-head-media-desk.html`.
- **Media & Photojournalism**: `media-dashboard.html`, `media-submit-media.html`, `media-manage-media.html`.
- **Media & Public Communications (MPC)**: `mpc-dashboard.html`, `mpc-media-desk.html`, `mpc-publish-article.html`, `mpc-transparency.html`.
- **Section Head**: `section-head-dashboard.html`, `section-head-manage-my-articles.html`, `section-head-review-articles.html`, `section-head-submit-article.html`.
- **Editor-in-Chief (EIC)**: `eic-dashboard.html`, `eic-manage-articles.html`, `eic-media-desk.html`, `eic-review-articles.html`, `eic-feedback-inbox.html`.
- **Executive Board**: `executive-dashboard.html`, `executive-manage-articles.html`, `executive-manage-accounts.html`, `executive-review-articles.html`, `executive-transparency.html`.

---

## Running Locally

### Option A: Static Web Preview (Zero Dependencies)
You can run any static server pointing to the root directory:
```bash
# Using Python
python -m http.server 8000

# Using Node / npx
npx serve .
```
Then visit `http://localhost:8000` or open any `.html` page in your browser.

### Option B: Vite / Tailwind Build Pipeline
```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Build production assets
npm run build
```

---

## Backend Integration

This frontend repository connects to the backend API services provided by the [`the-lens-publication`](https://github.com/ryzafaye/the-lens-publication) backend repository.
