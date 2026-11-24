# The Lens Frontend

Standalone Vue 3 single-page app for The Lens Publication. Laravel remains the backend and exposes JSON endpoints from its separate repository.

## Run and build

```sh
npm ci
npm run dev
```

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the Laravel API origin, without the `/api` suffix. The frontend adds `/api` to its requests.

For production:

```sh
npm run build
```

Vite writes a static SPA to `dist/`. Configure the frontend host to serve `index.html` for app routes such as `/archives` and `/writer/dashboard`.

## Laravel API handoff

See [docs/api-contract.md](docs/api-contract.md) for page-data endpoints, action routes, response shapes, and authentication/CORS requirements.

The browser app uses Vue Router and a JSON API client. It does not require Laravel to serve its HTML page, and Laravel does not return Inertia responses.

