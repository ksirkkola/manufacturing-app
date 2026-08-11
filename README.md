# Hailer App (React + TypeScript)

Built with Vite, React, TypeScript, and the Hailer App SDK.

## Getting Started

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. In Hailer, create a "Local Development" app pointing to `http://localhost:3000`.

3. Open the app in Hailer — changes reload automatically.

## Manifest

The file `public/manifest.json` identifies your app to Hailer:

```json
{
    "appId": "65143728d2bd678b13daf289",
    "config": {
        "fields": {
            "workflowId": { "type": "string" }
        }
    }
}
```

| Field | Description |
|-------|-------------|
| `appId` | Your app's unique ID in Hailer. Set automatically by `--create`, or manually from Hailer's app settings. |
| `config` | Defines configuration fields that workspace admins can set in app settings. |
| `version` | Semver version string (required for `--market` publishes). |
| `versionDescription` | Description of this version (required for `--market` publishes). |
| `targetId` | Marketplace product ID. Written automatically after first `--market` publish — do not edit manually. |

This file is copied to `dist/` during build and included in the published package.

## Publishing

### First time — create and publish a new app

```bash
npm run publish-production -- --create --app-name "My App" --workspace <id> --user-api-key <key> --force
```

This creates the app in Hailer, publishes it, and writes the `appId` to `public/manifest.json` for future publishes.

If `--app-name` or `--workspace` are omitted, the script will prompt for them interactively.

Find your workspace ID in Hailer. Generate a user API key in your Hailer user settings.

### Update an existing app

```bash
npm run publish-production -- --user-api-key <key> --force
```

Or authenticate with email (will prompt for password):

```bash
npm run publish-production -- --email user@mail.com
```

### Credential resolution order

1. `--user-api-key` or `--email` flags
2. `USER_API_KEY` or `HAILER_USER_API_KEY` environment variables
3. `HAILER_USER_API_KEY` from `~/.env` (used automatically by Hailer Studio)

### Publish to marketplace

Requires `version` and `versionDescription` in `public/manifest.json`:

```json
{
    "appId": "...",
    "version": "1.0.0",
    "versionDescription": "Initial release"
}
```

```bash
npm run publish-production -- --market --user-api-key <key> --force
```

Bump the `version` (semver) for each subsequent marketplace publish.

### Environments

| Command | Target |
|---------|--------|
| `npm run publish-local` | Local (`https://api.hailer.local.gd`) |
| `npm run publish-development` | Development (`https://testapi.hailer.biz`) |
| `npm run publish-staging` | Staging (`https://api.hailer.biz`) |
| `npm run publish-production` | Production (`https://api.hailer.com`) |

### All options

| Flag | Description |
|------|-------------|
| `--email <email>` | Authenticate with email (prompts for password) |
| `--user-api-key <key>` | Authenticate with API key |
| `--create` | Create a new app before publishing |
| `--app-name <name>` | App name (requires `--create`) |
| `--workspace <id>` | Target workspace (requires `--create`) |
| `--market` | Publish to Hailer marketplace |
| `--force` | Skip confirmation prompt |
| `--yes` | Skip confirmation prompt (deprecated, use `--force`) |
| `--host <url>` | Override the target host URL |

## Building

```bash
npm run build-production       # Production
npm run build-staging          # Staging
npm run build-development      # Development (with sourcemaps)
```

## Linting

```bash
npm run lint
```
