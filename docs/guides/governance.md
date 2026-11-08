# Governance Guide

## Purpose

Governance policies let MESA check architecture rules during scans.

## What Policies Are For

Use governance rules to express expectations such as:

- no cyclic dependencies
- no hard-coded service URLs
- maximum outbound dependency count

## Typical Workflow

1. write or edit policy YAML
2. save the policy set into the selected project
3. run a scan
4. review any policy violations in the findings

## Good Policy Design

- start with a small number of high-value rules
- keep rule meaning easy to explain
- use severity intentionally
- review violations with architecture context, not in isolation

## What To Avoid

- too many low-value rules
- unclear rule names
- treating every violation as equally urgent
