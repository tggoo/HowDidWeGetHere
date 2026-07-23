# HowDidWeGetHere - implementation status

Last updated: 2026-07-23

## Progress log

- 2026-07-23: Added implementation status document.
- 2026-07-23: Added public tag list API, public entry detail API and frontend detail/tag integration.
- 2026-07-23: Added public map entries API, admin place attachment endpoint and frontend rendering of stored coordinates on the map canvas.
- 2026-07-23: Replaced the custom map canvas with a Leaflet map layer that renders stored markers and routes.
- 2026-07-23: Added admin route creation endpoint and route form that creates ordered route points with coordinates.
- 2026-07-23: Added admin relationship creation endpoint and related-topic form by target entry slug.
- 2026-07-23: Added admin source attachment endpoint and source form with support-field metadata.
- 2026-07-23: Added admin time period create/update endpoints, period form and primary-period selector for entries.
- 2026-07-23: Added admin tag create/update endpoints and tag attachment form for entries.
- 2026-07-23: Connected period buttons and manual year range inputs to public entry/map filtering.
- 2026-07-23: Connected search input to public entry/map filtering.

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
- filtering entries and map data by search text
- published-only public entries
- primary image/audio URLs included in entry list responses
- entry detail payload includes tags, time periods, places, routes, related entries, sources, images and audio tracks
- public tag list is filtered to tags used by published entries
- public map payload includes entries with stored coordinates and route geometry/route-point geometry
- public entry and map queries can be filtered by year range
- public entry and map queries can be filtered by search text

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
- add route with ordered coordinate points to entry
- add relationship to another entry by target slug
- add source to entry by URL with support-field metadata
- list, create and update time periods
- list, create and update tags
- attach tag to entry by slug
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
- period buttons and manual year range filters update entry and map queries
- search input updates entry and map queries
- selected entry detail panel loaded from public entry detail API
- selected entry detail can display summary, importance text, tags, places, route counts, related topics, sources, images and audio
- Leaflet map renders stored public coordinates/routes when entries have places/routes
- map falls back to starter sample points when no stored coordinates exist
- admin sign-in panel
- workbook upload/import from frontend
- admin entry list
- entry create/edit form
- place/coordinate attachment form
- route attachment form with ordered points
- related-entry attachment form
- source attachment form
- time period create/update form
- primary time period selector in the entry editor
- tag create/update form
- tag attachment selector in the entry editor
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

The frontend now uses Leaflet for the real map layer and renders stored public coordinates/routes when data exists. Admins can create simple ordered routes from coordinate rows. The map still needs richer UX such as clustering, viewport-aware filtering, better route styling and mobile controls.

### Workbook import

The importer reads the current workbook sheets, creates entries, tags, time periods and source links. It does not yet geocode regions, create real places/routes, create relationships, add translations, or import images/audio. Places can currently be added manually from the admin panel after import.

### Admin UI

Admin can sign in, import, list entries, create/edit basic content, add media URLs, attach point places with coordinates, create basic routes, add relationships by target slug, attach sources by URL, create/update time periods and create/update/attach tags. It is not yet a complete CMS. Missing pieces include tag delete/detach, relationship update/delete, route update/delete, source update/delete, time period delete and richer validation.

### Multilingual support

The schema supports translations and the UI can request EN/CS/ES. The imported workbook currently creates EN text only unless admins add translations through API/UI later.

## Not implemented yet

### Real map data

- route update/delete in admin UI
- richer route drawing on a real map from stored coordinates/GeoJSON
- marker clustering for mobile
- place/time/tag combined filtering with map bounds

### Relationships

- relationship update/delete
- richer public relationship labels and grouping
- relationship labels translated by language

### Tags

- tag delete/detach
- richer tag management and grouping UI

### Time periods

- richer era/period side panel
- period hierarchy UI
- time period delete
- richer timeline/time slider

### Sources

- source update/delete
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

1. Add route update/delete in admin UI.
2. Add marker clustering and viewport-aware filtering.
3. Add relationship update/delete and richer relationship display.
4. Improve the era side panel and period hierarchy UI.
5. Add source update/delete.
6. Add tag detach/delete and route/source/relationship delete endpoints.
7. Add real media upload/storage.
8. Add importer preview, duplicate detection and route/place mapping.
9. Add CS/ES translation workflow.
10. Add backend/frontend tests.

## Current answer

No, the whole product is not finished. The foundation is implemented and deployable, there is a usable first admin workflow for importing and editing basic content, and public entry detail/tag/map APIs now exist. The map now uses Leaflet and can render stored coordinates/routes, but it still needs route update/delete, importer mapping and production-quality map UX.
