# AI Explainer Guide

## Current Status

The dedicated in-product AI explainer is planned as a later phase of the MESA upgrade roadmap.

## Intended Role

The AI explainer is meant to help users:

- understand findings in plain English
- summarize scan results
- prioritize remediation
- compare scans
- understand health scores
- navigate MESA documentation

## Important Rule

AI explanation should never replace deterministic detection.

The intended design is:

- detector produces evidence-based findings
- AI explains detector output
- AI distinguishes evidence from inference

## What This Means For Evaluators

When the AI layer is introduced, it should be evaluated separately from detector quality.

## What To Use Today

Until the dedicated AI explainer is fully added, use:

- beginner mode
- research mode
- documentation portal
- recommendation sections
