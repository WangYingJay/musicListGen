# Repository Guidelines

## Project Structure & Module Organization

This repository contains planning documentation and the initial MVP scaffold for `musicListGen`, a lightweight desktop image-generation app concept.

- `README.md` is the short project entry point.
- `有品服务-歌单生成设计文档.md` contains the product, architecture, UI, and technology-stack design.
- `launcher/` contains the pywebview native-window launcher.
- `desktop/` contains the React renderer.
- `backend/` contains the FastAPI sidecar service.
- `data/` is reserved for runtime SQLite files, uploads, and generated results.

When implementation begins, keep the planned architecture separated by responsibility:

- `launcher/` for the Python native-window launcher.
- `frontend/` for React + TypeScript + Vite renderer code.
- `backend/` for the FastAPI sidecar service.
- `data/` for local runtime artifacts such as SQLite databases and generated results; avoid committing generated files.
- `assets/` for static UI assets, icons, and bundled images.

## Build, Test, and Development Commands

No build or test commands are defined in this repository yet. Add commands as soon as source code is introduced, and document them in `README.md`.

Recommended future examples:

- `npm install` installs frontend dependencies.
- `pip install -r requirements.txt` installs backend dependencies.
- `npm run dev` starts the pywebview desktop launcher, FastAPI backend, and renderer development server.
- `启动.command` starts the app on macOS.
- `启动-windows.bat` starts the app on Windows.
- `npm run build` creates production frontend/desktop artifacts.
- `npm run backend:dev` runs the FastAPI backend during development.
- `pytest` runs backend tests once a test suite exists.

## Coding Style & Naming Conventions

Follow the design document’s planned stack: React 18, TypeScript, Vite, TailwindCSS, FastAPI, SQLite, and HTTP polling for long-running image tasks.

Use clear, conventional names:

- React components: `PascalCase.tsx`, for example `PromptPanel.tsx`.
- Hooks and utilities: `camelCase.ts`, for example `useTaskPolling.ts`.
- Python modules: `snake_case.py`, for example `task_store.py`.
- API routes should keep the documented async pattern: submit task, return `task_id`, then poll status.

Keep comments short and useful, especially around async task state, compatibility behavior, and desktop-side process management.

## Testing Guidelines

There is no active test framework yet. When adding code, include focused tests with the feature:

- Backend: use `pytest`; name files `test_*.py`.
- Frontend: use the project’s chosen test runner; name files `*.test.ts` or `*.test.tsx`.
- Cover task lifecycle behavior: `pending`, `running`, `succeeded`, and `failed`.

## Commit & Pull Request Guidelines

Current Git history only shows `Initial commit`, so no detailed convention is established. Use concise, imperative commit messages such as `Add FastAPI task polling` or `Document desktop architecture`.

Pull requests should include:

- A short summary of the change.
- Any linked issue or design-doc section.
- Screenshots or recordings for UI changes.
- Notes about commands run, or a clear statement when tests were not available.

## Security & Configuration Tips

Do not commit API keys, generated images, SQLite runtime databases, or local proxy credentials. Prefer local environment files or secure desktop storage when configuration support is added.
