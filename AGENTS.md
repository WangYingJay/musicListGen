# Repository Guidelines

## Project Structure & Module Organization

This repository contains planning documentation and the initial MVP scaffold for `musicListGen`, a lightweight desktop image-generation app concept.

- `README.md` is the short project entry point.
- `有品服务-歌单生成设计文档.md` contains the product, architecture, UI, and technology-stack design.
- `launcher/` contains the Electron main-process launcher and preload bridge.
- `desktop/` contains the React renderer.
- `backend/` contains the FastAPI sidecar service.
- `data/` is reserved for runtime SQLite files, uploads, and generated results.

When implementation begins, keep the planned architecture separated by responsibility:

- `launcher/` for the Electron desktop shell, preload bridge, and backend sidecar entry.
- `desktop/` for React + TypeScript + Vite renderer code.
- `backend/` for the FastAPI sidecar service.
- `data/` for local runtime artifacts such as SQLite databases and generated results; avoid committing generated files.
- `assets/` for static UI assets, icons, and bundled images.

## Build, Test, and Development Commands

Current commonly used commands:

- `npm install` installs root workspace dependencies, including Electron tooling.
- `pip install -r requirements.txt` installs FastAPI runtime and backend packaging dependencies.
- `npm run start:app` performs dependency bootstrap and launches the desktop app in one step.
- `npm run dev` starts the Electron desktop shell, FastAPI backend, and renderer development server.
- `npm run build` builds the Vite renderer production assets.
- `npm run package:dir` builds the renderer and backend sidecar, then outputs an unpacked Electron app directory.
- `npm run dist:mac` builds the macOS installer artifacts on macOS.
- `npm run dist:win` builds the Windows installer artifacts on Windows.
- `npm run backend:dev` runs the FastAPI backend during development.

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
