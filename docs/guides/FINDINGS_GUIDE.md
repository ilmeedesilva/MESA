# How to read findings

## Reading order

For each finding, read the result in this order:

1. title
2. severity
3. affected services
4. description
5. why it matters
6. what to do first
7. evidence
8. limitation

## Severity vs confidence

- `Severity` describes likely architectural impact.
- `Confidence` describes how strongly detector evidence supports the finding.

These are not the same thing.

## Evidence vs inference

MESA separates:

- `evidence`
  - what the detector actually observed
- `inference`
  - what that observation likely means architecturally

## Explanation levels

Switch with the `Simple | Technical` control in the top bar (in the menu on phones). Your browser remembers the choice.

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

## What a finding does not prove

A finding is a strong static signal, not a complete runtime truth claim. Always distinguish:

- observed structure
- likely impact
- confirmed runtime behavior
