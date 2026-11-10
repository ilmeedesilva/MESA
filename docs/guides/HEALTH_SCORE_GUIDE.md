# Health score guide

## Purpose

Health scores summarize architecture quality across key dimensions.

## What health scores represent

MESA health scores are intended to give a directional view of architecture quality, not a replacement for detailed finding review.

## Common dimensions

Depending on the scan, health dimensions may include:

- cohesion
- coupling
- API complexity
- god service risk
- ownership clarity
- cyclic dependencies
- shared database usage
- deployment independence
- hard-coded dependency risk

## How to interpret a score

- higher scores generally indicate healthier architecture properties
- lower scores indicate higher structural concern in that dimension

## Recommended reading order

1. system score
2. explanation text
3. weakest dimensions
4. lowest service scores
5. related findings

## Important limitation

Health scores compress many signals into a small summary. Use them as prioritization support, not as the only decision input.
