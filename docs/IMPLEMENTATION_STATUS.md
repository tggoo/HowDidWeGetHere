# HowDidWeGetHere - implementation status

Last updated: 2026-07-23

## Progress log

- 2026-07-23: Added implementation status document.
- 2026-07-23: Added public tag list API, public entry detail API and frontend detail/tag integration.
- 2026-07-23: Added public map entries API, admin place attachment endpoint and frontend rendering of stored coordinates on the map canvas.

## Goal

Build a mobile-first historical world map app with:

- historical, mythological, invention, exploration and other timeline entries
- map points and route visualization
- tags and multi-tag filtering
- time period filtering and a side panel for eras/periods
- multilingual content, initially EN and CS, optionally ES
- sources preserved from the original workbook
- related entries/topics
- images and audio tracks per entry/text
- admin access for content editing and workbook imports
- ASP.NET Core backend, React TypeScript frontend and type-safe API client generation

## Implemented

### Backend architecture

- ASP.NET Core 10 API project
- separated endpoint files grouped by area
- Serilog logging
- PostgreSQL database with EF Core
- startup database migration support for Render
- Render deployment configuration
- Dockerfile
- `run.sh` helper script
- generated OpenAPI document in Development
- generated TypeScript API schema in `web/src/api/schema.d.ts`

### Persistence model

- entries with kinds such as event, invention, mythology entity/story, exploration, war, civilization and more
- content status: draft, published, archived
- historical date fields with precision/confidence support
- multilingual entry translations
- tags with translations and groups
- time periods/eras with translations
- many-to-many entry to time period relationship
- sources and entry source links
- places, routes and route points in the domain model
- entry relationships in the domain model
- images per entry
- audio tracks per entry/language
- import batches and imported row audit records
- ASP.NET Identity admin user tables

### Public API

- `GET /api/health`
- `GET /api/entries`
- `GET /api/entries/{slug}`
- `GET /api/tags`
- `GET /api/map/entries`
- `GET /api/time-periods`
- filtering entries by language, tag and year range
- published-only public entries
- primary image/audio URLs included in entry list responses
- entry detail payload includes tags, time periods, places, routes, related entries, sources, images and audio tracks
- public tag list is filtered to tags used by published entries
- public map payload includes entries with stored coordinates and route geometry/route-point geometry

### Admin API

- Identity login endpoints under `/api/auth`
- admin-only route group under `/api/admin`
- list admin entries
- get admin entry detail
- create entry
- update entry
- add entry image URL
- add entry audio URL
- add place/coordinate to entry
- import workbook from `.xlsx`
- workbook import preserves raw row JSON and source row metadata
- imported workbook rows can be published immediately from the UI

### Frontend

- Vite React TypeScript app
- mobile-first map workspace skeleton
- typed API client via OpenAPI
- public map data loading from API
- language selector
- tag filter buttons loaded from backend tag API
- time period side panel
- selected entry detail panel loaded from public entry detail API
- selected entry detail can display summary, importance text, tags, places, route counts, related topics, sources, images and audio
- map canvas renders stored public coordinates/routes when entries have places/routes
- admin sign-in panel
- workbook upload/import from frontend
- admin entry list
- entry create/edit form
- place/coordinate attachment form
- primary image URL attachment
- primary audio URL attachment

### Deployment

- Render API web service configured
- Render static frontend service configured
- Render PostgreSQL configured
- CORS configured for local frontend and Render frontend
- Render startup issues fixed:
  - weak admin password no longer crashes API
  - config reload watcher disabled for Render
  - frontend origin allowed by CORS

## Partially implemented

### Map experience

The frontend still uses a lightweight custom map canvas, not a real map library. It now renders stored public coordinates/routes when data exists, and falls back to sample points when there is no place/route data.

### Workbook import

The importer reads the current workbook sheets, creates entries, tags, time periods and source links. It does not yet geocode regions, create real places/routes, create relationships, add translations, or import images/audio. Places can currently be added manually from the admin panel after import.

### Admin UI

Admin can sign in, import, list entries, create/edit basic content, add media URLs and attach point places with coordinates. It is not yet a complete CMS. Missing pieces include tag editing, relationships, route editing, source editing, time period editing and richer validation.

### Multilingual support

The schema supports translations and the UI can request EN/CS/ES. The imported workbook currently creates EN text only unless admins add translations through API/UI later.

## Not implemented yet

### Real map data

- actual world map library integration, likely MapLibre GL or Leaflet
- route editing in admin UI
- route drawing on a real map from stored coordinates/GeoJSON
- marker clustering for mobile
- place/time/tag combined filtering with map bounds

### Relationships

- admin relationship endpoints
- richer public relationship labels and grouping
- relationship labels translated by language

### Tags

- admin tag CRUD

### Time periods

- admin time period CRUD
- richer era/period side panel
- period hierarchy UI
- timeline/time slider

### Sources

- admin source CRUD
- richer source display in public entry detail

### Media storage

- file upload for images/audio
- object storage integration
- thumbnail generation
- image/audio moderation/validation
- media replacement and deletion

### Authentication/admin

- production admin UX hardening
- token refresh handling in frontend
- logout
- role management
- audit trail display

### Import workflow

- preview import before saving
- duplicate detection
- idempotent re-import/update mode
- validation report
- mapping workbook columns to places/routes/relationships/tags
- import CS/ES translations

### Testing

- backend endpoint tests
- importer tests with sample workbook rows
- frontend component tests
- deployment smoke tests

## Recommended next implementation order

1. Integrate MapLibre or Leaflet in the frontend.
2. Add route editor in admin UI.
3. Add public/admin route endpoints beyond the current map/detail payload.
4. Add admin/public relationship endpoints beyond the current detail payload.
5. Add time period CRUD and improve the era side panel.
6. Add source editing.
7. Add real media upload/storage.
8. Add importer preview, duplicate detection and route/place mapping.
9. Add CS/ES translation workflow.
10. Add backend/frontend tests.

## Current answer

No, the whole product is not finished. The foundation is implemented and deployable, there is a usable first admin workflow for importing and editing basic content, and public entry detail/tag/map APIs now exist. The main missing feature is still the real map layer: the frontend can render stored coordinates on a simple canvas, but it still needs a proper map library and richer route/place editing/import.
