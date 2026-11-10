# AI Explainer Guide

## Current Status

The AI explainer is available inside the MESA app in two ways:

- MESA's built-in explanations (the default; no AI key needed)
- optional AI explanations from OpenAI or Anthropic

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

## Built-in Explanations vs AI

Built-in explanations:

- use only MESA's own explainer logic
- do not call an external model
- still use real scan data and documentation

AI explanations:

- first build MESA's own explanation and evidence from the scan
- then send only that to the AI provider you configured (OpenAI or Anthropic)
- keep MESA's evidence cards as the source of truth
- fall back to the built-in explanation if the AI request fails

## What Is Sent

With AI off (the default), nothing is sent anywhere: explanations are built on your MESA server.

With AI on, each question sends one request to the provider you chose (OpenAI or Anthropic). It
contains your question and MESA's own explanation and evidence for it: finding descriptions,
service names, file paths, scores and, for documentation questions, short excerpts of the MESA
docs. Your source files are not sent.

## How To Turn On AI

Create a local `.env` file from `.env.example`, then set one of these.

OpenAI:

```bash
MESA_AI_MODE=hybrid
MESA_AI_PROVIDER=openai
MESA_OPENAI_API_KEY=your_api_key_here
MESA_OPENAI_MODEL=gpt-5.4-mini
```

Optional OpenAI settings:

```bash
MESA_OPENAI_BASE_URL=https://api.openai.com/v1
MESA_OPENAI_TIMEOUT_SECONDS=20
```

Anthropic:

```bash
MESA_AI_MODE=hybrid
MESA_AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_api_key_here
MESA_ANTHROPIC_EXPLAINER_MODEL=claude-opus-5-5
```

Docker Compose reads those values automatically through the `${...}` mappings in `docker-compose.yml`.

If AI is not turned on, or no API key is configured, MESA uses its built-in explanations.

## What The App Shows

The AI Explainer page shows one status line:

- `AI: off. Using MESA's built-in explanations.` - no AI key is configured (the default)
- `AI: on (OpenAI).` or `AI: on (Anthropic).` - AI is configured and working; the model name is shown in the `Technical` explanation level
- `AI unavailable right now. Showing MESA's built-in explanation.` - AI is configured but not working (for example a wrong key, an unavailable model or a connection problem); the reason is shown in `Technical`

Each answer has a small `MESA` or `AI` label. The detailed source is shown in `Technical`.

## How To Use It

1. Run or load a scan.
2. Open the `AI Explainer` panel in the analysis workspace.
3. Choose a quick action or ask a custom question.
4. Review:
   - the answer
   - the evidence cards
   - the suggestions
   - the limitations
   - the `MESA` or `AI` label on the answer

## What The AI Does Not Change

Findings always come from MESA's deterministic analysis, with or without AI. The AI only explains those findings in clearer words; it is instructed not to invent claims the evidence does not support.

## Current Limitation

AI explanations are evidence-bounded by design. It does not let the model generate detector facts independently, and it does not execute repository code.
