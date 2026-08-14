# Demo Projects Guide

## Purpose

This guide explains how to use the built-in demo repositories for a before-and-after MESA scan.

## Available Demo Repositories

- broken version: `/Users/ilmeedesilva/MESA/demo-projects/myservice-broken`
- fixed version: `/Users/ilmeedesilva/MESA/demo-projects/myservice-fixed`

## What The Broken Version Demonstrates

- repeated synchronous calls from `order-service` to `user-service`
- a cycle between `order-service` and `payment-service`
- a shared database between `order-service` and `payment-service`
- hard-coded internal endpoints in source code
- an overloaded `platform-service`

## What The Fixed Version Demonstrates

- reduced synchronous coupling
- no order-payment cycle
- separate service databases
- no embedded private IP or fixed internal URLs in source code
- a much smaller `platform-service`

## MESA UI Workflow

1. Start MESA.
2. Create a project such as `MyService Demo`.
3. In the repository input, choose `Local path`.
4. Enter the broken repo path:

`/Users/ilmeedesilva/MESA/demo-projects/myservice-broken`

5. Preview discovery and select the discovered services.
6. Run the first scan.
7. Review findings, graph, health score, and scan history.
8. Run a second scan using the fixed repo path:

`/Users/ilmeedesilva/MESA/demo-projects/myservice-fixed`

9. Compare the second scan against the first one.

## Suggested Viva Narrative

1. Show the first scan and explain the key risks.
2. Explain that the code was refactored to remove tight coupling and shared persistence.
3. Run the second scan.
4. Show that findings decrease and the health score improves.
5. Use the scan history and evolution views to explain measurable architectural improvement.
