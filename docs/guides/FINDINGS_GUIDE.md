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

## Explanation Levels

Switch with the `Explanation level` control at the top of every page. Your browser remembers the choice.

### Simple (default)

Use `Simple` when you want:

- simpler language
- less raw detail
- clearer action guidance: what MESA found, why it matters, and what to do first

### Technical

Use `Technical` when you want everything in `Simple`, plus:

- the finding ID, detector and rule
- the exact file:line locations
- the evidence steps, recommendation source and raw evidence

## What A Finding Does Not Prove

A finding is a strong static signal, not a complete runtime truth claim. Always distinguish:

- observed structure
- likely impact
- confirmed runtime behavior
