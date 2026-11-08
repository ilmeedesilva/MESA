# How To Read Findings

## Reading Order

For each finding, read the result in this order:

1. title
2. severity
3. affected services
4. description
5. why it matters
6. what to do first
7. evidence
8. limitation

## Severity vs Confidence

- `Severity` describes likely architectural impact.
- `Confidence` describes how strongly detector evidence supports the finding.

These are not the same thing.

## Evidence vs Inference

MESA separates:

- `evidence`
  - what the detector actually observed
- `inference`
  - what that observation likely means architecturally

## Beginner Mode

Use beginner mode when you want:

- simpler language
- less raw detail
- clearer action guidance

## Research Mode

Use research mode when you want:

- raw detector evidence
- technical labels
- deeper interpretation support

## What A Finding Does Not Prove

A finding is a strong static signal, not a complete runtime truth claim. Always distinguish:

- observed structure
- likely impact
- confirmed runtime behavior
