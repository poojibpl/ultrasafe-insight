#!/usr/bin/env bash
cd "$(dirname "$0")"
if command -v bun >/dev/null 2>&1; then bun install && bun run dev; else npm install && npm run dev; fi
