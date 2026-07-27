# Deployment

[Documentation index](README.md)

The application is a static site. Anything that can serve files can host it.

## GitHub Pages

The repository deploys itself. `.github/workflows/deploy.yml` publishes `main`
to Pages after CI passes.

To enable it once:

1. **Settings → Pages → Build and deployment**
2. Set **Source** to **GitHub Actions**
3. Push to `main`

The site appears at `https://<owner>.github.io/govspirit-warehouse/`.

`404.html` at the repository root is served for unknown paths. Its styles are
inlined rather than linked, because Pages serves that file for a missing path
at any depth and a relative stylesheet would resolve against the wrong
directory.

## Any static host

Upload the repository contents. No build, no environment variables, no server
runtime.

```
index.html
404.html
assets/
src/
```

`docs/`, `scripts/`, `node_modules/` and the dotfiles are not needed at
runtime and can be excluded.

### Netlify

```
Build command:      (leave empty)
Publish directory:  .
```

### Nginx

```nginx
server {
    listen 80;
    root /var/www/govspirit;
    index index.html;

    location / {
        try_files $uri $uri/ /404.html;
    }
}
```

### Apache

Drop the folder into the document root. No configuration is required.

## Running without a web server

Open `index.html` from the filesystem. The application uses classic scripts
rather than ES modules specifically so this works.

Two features degrade:

| Feature              | Behaviour on `file://`                                                                  |
| -------------------- | --------------------------------------------------------------------------------------- |
| Charts               | Fail if the CDN is unreachable. The page says so and the tables still hold every figure |
| Excel and PDF export | Fail if the CDN is unreachable. CSV export is unaffected                                |

## Air-gapped installation

For a depot with no internet access, vendor the two libraries.

**1. Download once, on a connected machine:**

```bash
mkdir -p vendor
curl -o vendor/chart.umd.min.js \
  https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js
curl -o vendor/xlsx.full.min.js \
  https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
```

**2. Verify what you downloaded** against the digests already pinned in the
repository. They are in `index.html` for Chart.js and in `src/ui/exporters.js`
for the rest.

```bash
cat vendor/chart.umd.min.js | openssl dgst -sha384 -binary | openssl base64 -A
# must print: JUh163oCRItcbPme8pYnROHQMC6fNKTBWtRG3I3I0erJkzNgL7uxKlNwcrcFKeqF
```

If a digest does not match, stop. The file is not the one this project was
built against.

**3. Point the application at the local copies:**

- In `index.html`, change the Chart.js `src` to `vendor/chart.umd.min.js` and
  drop the `integrity` and `crossorigin` attributes, which do not apply to a
  same-origin file.
- In `src/ui/exporters.js`, change the `src` values in the `CDN` constant.
- In `index.html`, remove the Google Fonts `<link>` elements. The type stack
  falls back to the system UI font, which is present on every target platform.

## Subresource Integrity

Every third-party script is pinned to an exact version with a SHA-384 digest.
If the CDN ever serves altered bytes for those versions, the browser refuses to
execute them.

This matters because these libraries are handed the operator's inventory data.

To regenerate a digest after a deliberate upgrade:

```bash
curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A
```

| Library     | Version | Loaded                                 |
| ----------- | ------- | -------------------------------------- |
| Chart.js    | 4.4.3   | On page load, deferred                 |
| SheetJS     | 0.18.5  | On first workbook read or Excel export |
| jsPDF       | 2.5.1   | On first PDF export                    |
| html2canvas | 1.4.1   | On first PDF export                    |

## What the browser sends

Nothing about your data. The only outbound requests are:

| Request                                   | When                                      |
| ----------------------------------------- | ----------------------------------------- |
| Google Fonts stylesheet and woff2         | Page load. Remove the `<link>` to stop it |
| Chart.js from jsDelivr                    | Page load                                 |
| SheetJS, jsPDF, html2canvas from jsDelivr | Only when you read a workbook or export   |

There is no analytics, no telemetry and no error reporting. Spreadsheet
contents are read by the browser's own `FileReader` API and never leave the
tab.

## Browser support

The floor is set by `color-mix()`, which the stylesheet uses for translucent
status borders.

| Browser               | Minimum | Set by        |
| --------------------- | ------- | ------------- |
| Chrome and Edge       | 111     | `color-mix()` |
| Firefox               | 113     | `color-mix()` |
| Safari and iOS Safari | 16.2    | `color-mix()` |

Other modern features used, all of which shipped earlier than the above:
`dvh` units, `:focus-visible`, `inert`, `:has()` is not used.

`inert` is paired with an `aria-hidden` fallback for engines that lack it, but
`color-mix()` and `dvh` have no fallback, so an older browser will render the
page without laying it out correctly.
