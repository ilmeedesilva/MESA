# Public repo scan guide

## Goal

This guide explains how to scan a public repository using MESA without manually typing service paths.

## Workflow

1. Create or select a project.
2. Choose `GitHub URL` as the repository source type.
3. Enter the public repository URL.
4. Optionally enter a branch, tag, or ref.
5. Click `Preview discovery`.
6. Review the discovered service candidates.
7. Keep the services you want to analyze.
8. Run the repository-backed scan.

## What preview discovery does

Preview discovery tries to identify likely service boundaries before the full scan runs. It shows:

- candidate service names
- paths
- language
- confidence
- reasons for selection

## When to be careful

Review the candidate list more carefully when:

- the repository mixes libraries and services
- orchestration files exist but service entrypoints are weak
- services share folders or are nested deeply

## Recommended interpretation

- high-confidence candidates are usually good defaults
- medium-confidence candidates should be reviewed manually
- low-confidence candidates should be treated as suggestions, not final truth
