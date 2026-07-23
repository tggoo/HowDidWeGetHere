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
- 2026-07-23: Made workbook re-import idempotent by updating existing source rows and reporting created vs updated entries.
- 2026-07-23: Added admin route update/delete endpoints and route edit/delete controls in the admin UI.
- 2026-07-23: Added admin relationship update/delete endpoints and relationship edit/delete controls in the admin UI.
- 2026-07-23: Added admin source update/delete endpoints and source edit/delete controls in the admin UI.
- 2026-07-23: Added admin tag detach/delete endpoints and controls for attached entry tags.
- 2026-07-23: Added admin time period delete endpoint and guarded delete control in the admin UI.
- 2026-07-23: Added lightweight Leaflet marker clustering for dense low-zoom map views.
- 2026-07-23: Added viewport-aware map data filtering with map bounds sent to the public map API.
- 2026-07-23: Added localized and grouped public related-topic display.
- 2026-07-23: Added hierarchical time period filter panel using parent/child periods.
- 2026-07-23: Added admin image/audio update/delete endpoints and media edit/delete controls for URL-based media.
- 2026-07-23: Fixed mobile admin and entry detail panels to open as full-screen closeable overlays.
- 2026-07-23: Added local admin image/audio file upload workflow and static media serving.
- 2026-07-23: Reworked admin panel so content tools are visible only after sign-in and grouped into single-page admin sections with table views.
- 2026-07-23: Added frontend admin session persistence, automatic refresh token renewal and sign-out.
- 2026-07-23: Added workbook import preview endpoint and admin preview table before saving imports.
- 2026-07-23: Added structured workbook import validation report with severity counts and row-level issues.
- 2026-07-23: Added admin entry translation overview and EN/CS/ES editing workflow.
- 2026-07-23: Added persistent light/dark theme toggle with dark styling for app panels, admin UI and map tiles.

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
- public related-topic display groups incoming/outgoing relationships and localizes relationship labels
- public tag list is filtered to tags used by published entries
- public map payload includes entries with stored coordinates and route geometry/route-point geometry
- public entry and map queries can be filtered by year range
- public entry and map queries can be filtered by search text
- public map queries can be filtered by visible map bounds

### Admin API

- Identity login endpoints under `/api/auth`
- admin-only route group under `/api/admin`
- list admin entries
- get admin entry detail
- admin entry detail includes available translation coverage
- create entry
- update entry
- add entry image URL
- add entry audio URL
- upload local entry image files
- upload local entry audio files
- update and delete entry images
- update and delete entry audio tracks
- add place/coordinate to entry
- add route with ordered coordinate points to entry
- update route with a replacement set of ordered coordinate points
- delete route records
- add relationship to another entry by target slug
- update relationship target/type/confidence/note
- delete relationship records
- add source to entry by URL with support-field metadata
- update source URL/metadata/support-field links
- delete source links from entries
- list, create and update time periods
- delete unused time periods
- list, create and update tags
- attach tag to entry by slug
- detach tag from entry
- delete unused tags
- import workbook from `.xlsx`
- preview workbook import without saving rows
- workbook import preview validation report with row-level issues
- workbook import preserves raw row JSON and source row metadata
- imported workbook rows can be published immediately from the UI
- imported workbook rows can update existing entries by source sheet and row instead of creating duplicates
- imported workbook rows can also update existing entries by slug when source row metadata is missing or changed

### Frontend

- Vite React TypeScript app
- mobile-first map workspace skeleton
- persistent light/dark theme toggle
- typed API client via OpenAPI
- public map data loading from API
- language selector
- tag filter buttons loaded from backend tag API
- time period side panel
- hierarchical time period filter panel
- period buttons and manual year range filters update entry and map queries
- search input updates entry and map queries
- selected entry detail panel loaded from public entry detail API
- mobile selected entry detail replaces the map as a full-screen closeable panel
- selected entry detail can display summary, importance text, tags, places, route counts, related topics, sources, images and audio
- Leaflet map renders stored public coordinates/routes when entries have places/routes
- Leaflet map clusters dense marker sets at low zoom
- Leaflet map sends visible bounds to the API so map data follows the viewport
- map falls back to starter sample points when no stored coordinates exist
- admin sign-in panel
- admin session persistence in local browser storage
- automatic admin access-token refresh using the Identity refresh endpoint
- admin sign-out clears local session and editor state
- admin content tools are hidden until sign-in succeeds
- admin tools are grouped into separate pages for import, periods, tags, entry editing, places, routes, relationships, sources and media
- admin entity pages include table views for periods, tags, places, routes, relationships, sources and media
- mobile admin panel opens as a full-screen closeable panel
- workbook upload/import from frontend
- workbook preview from frontend before saving import rows
- workbook preview validation summary and row issue display
- workbook import result displays created and updated entry counts
- admin entry list
- entry create/edit form
- EN/CS/ES entry translation switcher in the admin entry editor
- entry editor supports localized title, summary, description, why-it-matters and dating note
- place/coordinate attachment form
- route attachment form with ordered points
- route edit/delete controls for existing entry routes
- related-entry attachment form
- related-entry edit/delete controls for existing outgoing relationships
- source attachment form
- source edit/delete controls for existing entry source links
- time period create/update form
- unused time period delete control
- primary time period selector in the entry editor
- tag create/update form
- tag attachment selector in the entry editor
- attached-tag list with detach controls in the entry editor
- unused tag delete control
- primary image URL attachment
- primary audio URL attachment
- primary image file upload
- primary audio file upload
- image/audio URL edit and delete controls

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

The frontend now uses Leaflet for the real map layer and renders stored public coordinates/routes when data exists. Dense low-zoom marker sets are grouped with lightweight client-side clustering, and the map sends visible bounds to the public map API so data follows the viewport. Admins can create, edit and delete simple ordered routes from coordinate rows. The map still needs richer UX such as better route styling and mobile controls.

### Workbook import

The importer reads the current workbook sheets, previews create/update counts and validation issues without saving, then creates or updates entries, tags, time periods and source links when the import is confirmed. Re-import uses source sheet and source row metadata as the first idempotency key, then falls back to matching by slug, so repeated uploads update existing imported rows instead of creating another copy. It does not yet geocode regions, create real places/routes, create relationships, add translations, or import images/audio. Places can currently be added manually from the admin panel after import.

### Admin UI

Admin can sign in, import, list entries, create/edit basic content and EN/CS/ES entry translations, add/edit/delete media URLs, upload local image/audio files, attach point places with coordinates, create/edit/delete basic routes, create/edit/delete outgoing relationships by target slug, attach/edit/delete source links by URL, create/update/delete unused time periods and create/update/attach/detach/delete tags. Admin tools are now separated into single-page sections with table views for non-entry entities. It is not yet a complete CMS. Missing pieces include richer validation and cloud/object media storage.

### Multilingual support

The schema supports translations and the UI can request EN/CS/ES. Admins can now switch an entry editor between EN/CS/ES, see which translations exist and save localized title/body fields. The imported workbook currently creates EN text only unless admins add translations through the admin editor later.

## Not implemented yet

### Real map data

- richer route drawing on a real map from stored coordinates/GeoJSON
- more advanced place/time/tag filtering with map bounds and anti-meridian handling

### Tags

- richer tag management and grouping UI

### Time periods

- richer timeline/time slider

### Sources

- richer source display in public entry detail

### Media storage

- object storage integration
- thumbnail generation
- image/audio moderation/validation
- media replacement and deletion for uploaded objects

### Authentication/admin

- production admin UX hardening
- role management
- audit trail display

### Import workflow

- mapping workbook columns to places/routes/relationships/tags
- import CS/ES translations

### Testing

- backend endpoint tests
- importer tests with sample workbook rows
- frontend component tests
- deployment smoke tests

## Recommended next implementation order

1. Add real media upload/storage.
2. Add importer preview, conflict review and route/place mapping.
3. Add CS/ES translation workflow.
4. Add backend/frontend tests.

## Current answer

No, the whole product is not finished. The foundation is implemented and deployable, there is a usable first admin workflow for importing and editing basic content, and public entry detail/tag/map APIs now exist. The map now uses Leaflet and can render stored coordinates/routes, workbook re-import updates existing source rows, and admins can now edit/delete routes, but it still needs importer mapping and production-quality map UX.
