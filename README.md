# Bacchat

A calm, private, open-source money notebook for Android. Built with Kotlin and Jetpack Compose (Material 3 / Material You).

- `frontend/` - the Android app
- `backend/` - optional end-to-end-encrypted sync service (Docker)
- `docs/` - design and engineering documentation
- `CLAUDE.md` - project guide for contributors and AI assistants

## Quick start

Frontend: `cd frontend && ./gradlew :core:test` (pure Kotlin tests), `./gradlew :app:assembleDebug` (needs the Android SDK).

Backend: `cd backend && ./gradlew test`, then `docker compose up --build`.

See `docs/README.md` for the full documentation index.
