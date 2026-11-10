# Public Demo Guide

## Purpose

This guide explains how to use MESA with demo data.

Demo data is meant for:

- people reviewing MESA
- reviewers
- first-time visitors
- anyone who wants to understand MESA without setting up the full backend stack first

## What The Demo Data Includes

When your MESA server is not available, MESA can still load:

- demo scans
- findings
- architecture graph views
- health scores
- remediation roadmap
- scan comparison
- the built-in documentation
- a guided tour

## What The Demo Data Does Not Do

With demo data, MESA does not:

- scan your own repositories
- save new projects
- persist new scans
- send requests to an AI provider

It is a guided example workspace, not a full analysis runtime.

## How To Use It

1. Open the frontend.
2. If the backend is unavailable, MESA automatically loads the demo data.
3. Read the banner at the top to confirm that it says "You're viewing demo data".
4. Review the sample project and scan history.
5. Start with these areas:

- summary strip
- Findings
- remediation roadmap
- architecture graph
- health score panel
- architecture evolution

## Take The Tour

1. Read the summary strip first.
2. Open the most urgent finding.
3. Open the remediation roadmap to see grouped actions.
4. Compare the latest demo scan with the previous one.
5. Switch to the documentation.
6. Read:

- `Quick start`
- `Getting started`
- `Findings`
- `Roadmap`

## Best Questions To Ask In Demo Mode

Try these example questions in the AI panel:

- `Explain simply what should be solved first.`
- `Why is the health score low?`
- `Summarize this scan.`
- `How do I use this tool?`

With demo data, the AI Explainer answers from the demo data and the built-in documentation.

## How To Leave Demo Mode

If your MESA server is available, use:

- `Load demo data`
- `Connect to your MESA server`

in the "Try it with demo data" box at the bottom of the sidebar (in the menu on phones) to switch between the demo data and your MESA server.

## When To Use The Full Stack Instead

Use the full backend stack when you want to:

- analyze your own repositories
- save projects and scans
- use live repository preview and service discovery
- persist graphs, history, and policies
- use the live hybrid AI path
