# AI Explainer Guide

## Current Status

The AI explainer is now available inside the MESA analysis UI in two modes:

- grounded local mode
- optional live hybrid AI mode

It works on top of:

- persisted scan findings
- health scores
- scan comparison data
- governance policies
- local MESA documentation

## Intended Role

The AI explainer is meant to help users:

- understand findings in plain English
- summarize scan results
- prioritize remediation
- compare scans
- understand health scores
- navigate MESA documentation

## Important Rule

AI explanation does not replace deterministic detection.

The design is:

- detector produces evidence-based findings
- AI explains detector output
- AI distinguishes evidence from inference
- AI responses expose supporting evidence, suggestions, and limitations

## Available Actions

The current explainer supports:

- scan summary
- finding explanation
- fix-first prioritization
- health score explanation
- scan comparison
- governance policy help
- documentation question answering

## Grounded Mode vs Hybrid Mode

Grounded local mode:

- uses only MESA's local explainer logic
- does not call an external model
- still uses real scan data and documentation

Live hybrid AI mode:

- first builds a grounded MESA response packet
- then sends only that packet to a live OpenAI model
- keeps MESA evidence cards as the source of truth
- falls back to grounded mode if the live request fails

## How To Enable Live Hybrid AI

Create a local `.env` file from `.env.example`, then set:

```bash
MESA_AI_MODE=hybrid
MESA_OPENAI_API_KEY=your_api_key_here
MESA_OPENAI_MODEL=gpt-5.4-mini
```

Optional settings:

```bash
MESA_OPENAI_BASE_URL=https://api.openai.com/v1
MESA_OPENAI_TIMEOUT_SECONDS=20
```

Docker Compose reads those values automatically through the `${...}` mappings in `docker-compose.yml`.

If hybrid mode is not enabled, or if no API key is configured, MESA automatically stays in grounded local mode.

## How To Use It

1. Run or load a scan.
2. Open the `AI Explainer` panel in the analysis workspace.
3. Choose a quick action or ask a custom question.
4. Review:
   - the answer
   - the evidence cards
   - the suggestions
   - the limitations
   - the response source label

## What This Means For Evaluators

Evaluate the AI layer separately from detector quality.

The detector quality still depends on the deterministic analysis pipeline. The explainer quality depends on whether the grounded response makes the result easier to understand without inventing unsupported claims.

## Current Limitation

The live hybrid mode is still evidence-bounded by design. It does not let the model generate detector facts independently, and it does not execute repository code.
