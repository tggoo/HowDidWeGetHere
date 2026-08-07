# World Records Import Package

World Records map data is imported through the normal admin content package ZIP flow.
The technical package field is still `minMaxItems` for compatibility. Add a `minMaxItems` array to the ZIP root `entries.json`.

Minimal item:

```json
{
  "schemaVersion": 1,
  "packageSlug": "min-max",
  "title": "World Records geography records",
  "entries": [],
  "minMaxItems": [
    {
      "slug": "mount-everest",
      "category": "mountains",
      "sortOrder": 10,
      "translations": {
        "en": {
          "title": "Mount Everest",
          "subtitle": "Highest mountain above sea level",
          "typeLabel": "Highest mountain",
          "valueLabel": "8,849 m",
          "summary": "Mount Everest is the highest point on Earth measured above sea level.",
          "mapNote": "Shown as a point at the summit area.",
          "facts": ["It lies in the Himalayas."]
        }
      },
      "shapes": [
        {
          "kind": "Point",
          "latitude": 27.9881,
          "longitude": 86.925
        }
      ]
    }
  ]
}
```

Supported shape kinds:

- `Point`: requires `latitude` and `longitude`.
- `Polygon`: requires `points`, each with `latitude` and `longitude`.

The importer upserts World Records items by `slug` when `updateExistingRows=true`. Re-importing a package replaces stale shapes and updates translations.

The local sample package was generated at `generated/packages/min-max.zip`; `generated/` is git-ignored, so regenerate it from `generated/packages/min-max/entries.json` when needed.
