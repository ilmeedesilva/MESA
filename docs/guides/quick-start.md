# Local Scan Guide

## Goal

This guide explains how to run MESA against local repositories or manually supplied service directories.

## Local Repository Workflow

1. Create or select a project.
2. Choose `Local path`.
3. Enter the repository path that MESA can access.
4. Preview discovery.
5. Confirm the service set.
6. Run the scan.

## Manual Service Path Workflow

1. Leave repository source blank if you do not want discovery.
2. Paste one service directory per line into the `Service paths` area.
3. Run the scan.

## When Manual Paths Are Useful

- you already know the service boundaries
- repository discovery needs correction
- you want a tightly controlled evaluation scope

## Good Practice

- keep each path focused on one service root
- avoid mixing infrastructure-only folders into the scan set
- use scan history to compare manual-scope changes over time
