# Frontend and Laravel API contract

This frontend is a static Vue SPA. Laravel serves JSON from a separate API host; the frontend host serves the built files in `dist/` and falls back to `index.html` for app routes.

## Local setup and deployment

```sh
npm ci
npm run dev
```

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the Laravel API origin, for example `https://api.example.com`. Do not add `/api`; the client adds that prefix. Vite embeds this value at build time, so configure it before building each environment.

```sh
npm run build
```

Deploy the contents of `dist/` to the frontend host. Configure history fallback so direct visits to paths such as `/archives`, `/articles/example-story`, and `/writer/dashboard` return `index.html`.

## Authentication and CORS

The API client sends credentialed requests and uses Laravel Sanctum's CSRF cookie flow before mutating requests. Cookie-based Sanctum authentication requires the SPA and API to share a top-level domain; they can use different subdomains. Laravel must trust the frontend origin, allow credentialed CORS, and enable Sanctum's stateful API middleware. See [Laravel Sanctum's SPA authentication guide](https://laravel.com/docs/13.x/sanctum).

If the frontend and API use different top-level domains, choose an API token/OAuth strategy before implementing authentication; cookie-based Sanctum SPA auth does not cover that deployment shape.

## Page-data endpoints

Vue Router owns browser URLs. When a screen loads, the client calls its JSON endpoint and passes the returned `props` to the page component. `portal`, `slug`, and `kind` values are sent as query parameters where applicable.

Each page-data response has this shape:

```json
{
  "shared": {
    "auth": {
      "user": {
        "id": 1,
        "name": "Mika Reyes",
        "studentNumber": "2024-00123",
        "role": "Writer",
        "avatarUrl": "https://media.example.com/avatars/1.jpg"
      }
    },
    "flash": {},
    "errors": {}
  },
  "props": {}
}
```

For a logged-out visitor, set `shared.auth.user` to `null`. Page-specific props are:

| Endpoint | Vue page | Page props |
| --- | --- | --- |
| `GET /api/pages/public/home` | `Public/Home` | `featuredArticle`, `latestArticles`, `moreStories`, `categorySections` |
| `GET /api/pages/public/about` | `Public/About` | None |
| `GET /api/pages/public/archives` | `Public/Archives` | Required `filters`; also `articles`, `pagination`, `categories`, `total` |
| `GET /api/pages/public/article?slug=...` | `Public/Article` | Required `article`; also `relatedArticles` |
| `GET /api/pages/public/author?slug=...` | `Public/Author` | Required `authorName`; also `authorFound`, `articles`, `roleName`, `beatsWithCount` |
| `GET /api/pages/public/category?slug=...` | `Public/Category` | Required `currentCategory`; also `articles`, `pagination` |
| `GET /api/pages/public/feedback` | `Public/Feedback` | `oldInput` |
| `GET /api/pages/public/members` | `Public/Members` | None |
| `GET /api/pages/dashboard?portal=...` | `Dashboard/Overview` | `title`, `metrics`, `writerStats`, `pendingArticles`, `publishedArticles`, `recentActivities`, `recentArticles`, `topArticles`, `mediaItems`, `cartoons`, `isSectionHead`, `category` |
| `GET /api/pages/articles/manage-my?portal=...` | `Articles/ManageMy` | `articles` |
| `GET /api/pages/articles/submit?portal=...` | `Articles/Submit` | `categories`, `drafts`, `editingDraft` |
| `GET /api/pages/profile?portal=...` | `Settings/Profile` | Uses `shared.auth.user` |
| `GET /api/pages/workspace/accounts?portal=...` | `Workspace/Accounts` | `officers`, `roles` |
| `GET /api/pages/workspace/activity-logs?portal=...` | `Workspace/ActivityLogs` | `activities` |
| `GET /api/pages/workspace/articles?portal=...` | `Workspace/Articles` | `articles`, `categories` |
| `GET /api/pages/workspace/feedback?portal=...` | `Workspace/Feedback` | `feedbacks` |
| `GET /api/pages/workspace/media?portal=...&kind=...` | `Workspace/Media` | `items`, `isSectionHead` |
| `GET /api/pages/workspace/publish?portal=...` | `Workspace/Publish` | `articles`, `approvedCovers`, `counts` |
| `GET /api/pages/workspace/review?portal=...` | `Workspace/Review` | `articles`, `sort` |
| `GET /api/pages/workspace/transparency?portal=...` | `Workspace/Transparency` | None |
| `GET /api/pages/workspace/upload-visual?portal=...&kind=...` | `Workspace/UploadVisual` | None |

`portal` is one of `writer`, `section-head`, `media`, `mpc`, `eic`, `executive`, or `cartoonist`. Media `kind` is `desk`, `library`, `cartoons`, or `cartoon-desk`; upload `kind` is `photo` or `cartoon`. The login screen is local and does not fetch page data.

Public article, author, and category links returned in props must be frontend paths (`/articles/{slug}`, `/authors/{slug}`, `/category/{slug}`), so navigation stays on the Vue host. Uploaded-media URLs should be absolute URLs or point to a media host.

## Mutations

The client uses JSON for standard actions and multipart form data for file uploads. JSON requests include `Accept: application/json`, `X-Requested-With`, credentials, and the Sanctum XSRF header.

Successful mutations should return a 2xx JSON response such as `{"success":true,"message":"Saved."}`. When appropriate, include the updated `user`. Validation errors should use HTTP 422 and Laravel's standard `{"message":"...","errors":{"field":["..."]}}` shape. Return 401 for unauthenticated requests and 403 for denied access.

| Method | API path | Purpose |
| --- | --- | --- |
| `POST` | `/api/login` | Sign in; return `user` and optional frontend `redirect` path |
| `POST` | `/api/logout` | Sign out |
| `POST` | `/api/feedback` | Public feedback form |
| `POST` | `/api/{portal}/submit-article` | Save or submit an article |
| `DELETE` | `/api/{portal}/drafts/{id}` | Delete a draft |
| `POST` | `/api/profile/update-info` | Update profile and avatar |
| `POST` | `/api/profile/update-password` | Change password |
| `POST` | `/api/{portal}/manage-accounts` | Add an account |
| `PUT` | `/api/{portal}/manage-accounts/{id}/role` | Change a role |
| `PATCH` | `/api/{portal}/manage-accounts/{id}/status` | Activate/deactivate an account |
| `PUT` | `/api/{portal}/manage-articles/{id}` | Edit an article |
| `POST` | `/api/{portal}/manage-articles/{id}/archive` or `/restore` | Archive or restore an article |
| `DELETE` | `/api/{portal}/manage-articles/{id}` | Delete an article |
| `PUT` | `/api/{portal}/review-articles/{id}` | Save review edits |
| `POST` | `/api/{portal}/review-articles/{id}/approve` or `/revision` | Approve or return an article |
| `POST` | `/api/{portal}/media/{id}/approve`, `/endorse`, or `/revision` | Review media |
| `POST` | `/api/cartoonist/cartoons/{id}/endorse` or `/revision` | Review cartoons |
| `POST` | `/api/mpc/articles/{id}/publish`, `/unpublish`, `/assign-cover`, or `/revision` | Manage publication |
| `POST` | `/api/{portal}/submit-media` | Upload media |
| `POST` | `/api/cartoonist/submit-cartoon` | Upload a cartoon |
| `POST` | `/api/article/{id}/share` | Increment an article's share count |

After successful JSON actions, the frontend reloads the current page-data endpoint. It may send an `only` query parameter; the backend can ignore it and return the full page props.
