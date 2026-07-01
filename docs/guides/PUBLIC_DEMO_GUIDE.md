# Public Demo Guide

## Purpose

This guide explains how to use MESA in public demo mode.

Public demo mode is meant for:

- evaluators
- reviewers
- first-time visitors
- anyone who wants to understand MESA without setting up the full backend stack first

## What Public Demo Mode Includes

When the live backend is not available, MESA can still load:

- embedded demo scans
- findings
- architecture graph views
- health scores
- remediation roadmap
- scan comparison
- embedded documentation
- evaluator walkthrough guidance

## What Public Demo Mode Does Not Do

Public demo mode does not:

- scan your own repositories
- save new projects
- persist new scans
- run live backend AI requests

It is a guided example workspace, not a full analysis runtime.

## How To Use It

1. Open the frontend.
2. If the backend is unavailable, MESA automatically loads the embedded demo workspace.
3. Read the banner at the top to confirm that public demo mode is active.
4. Review the sample project and scan history.
5. Start with these areas:

- summary strip
- findings dashboard
- remediation roadmap
- architecture graph
- health score panel
- architecture evolution

## Recommended Evaluator Walkthrough

1. Read the summary strip first.
2. Open the most urgent finding.
3. Open the remediation roadmap to see grouped actions.
4. Compare the latest demo scan with the previous one.
5. Switch to the documentation portal.
6. Read:

- `Evaluator Quick Start`
- `Getting Started`
- `How To Read Findings`
- `Remediation Roadmap Guide`

## Best Questions To Ask In Demo Mode

Try these example questions in the AI panel:

- `Explain simply what should be solved first.`
- `Why is the health score low?`
- `Summarize this scan.`
- `How do I use this tool?`

In public demo mode, the AI panel answers from embedded example data and documentation.

## How To Leave Demo Mode

If the live backend is available, use:

- `Load demo workspace`
- `Return to live workspace`

from the top banner to switch between the embedded example view and the live workspace.

## When To Use The Full Stack Instead

Use the full backend stack when you want to:

- analyze your own repositories
- save projects and scans
- use live repository preview and service discovery
- persist graphs, history, and policies
- use the live hybrid AI path
