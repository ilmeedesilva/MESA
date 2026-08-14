# Health Score Guide

## Purpose

Health scores summarize architecture quality across key dimensions.

## What Health Scores Represent

MESA health scores are intended to give a directional view of architecture quality, not a replacement for detailed finding review.

## Common Dimensions

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

## How To Interpret A Score

- higher scores generally indicate healthier architecture properties
- lower scores indicate higher structural concern in that dimension

## Recommended Reading Order

1. system score
2. explanation text
3. weakest dimensions
4. lowest service scores
5. related findings

## Important Limitation

Health scores compress many signals into a small summary. Use them as prioritization support, not as the only decision input.
