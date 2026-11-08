# Supported Inputs

## Supported Source Types

MESA currently supports these input styles:

- local repository paths
- archive paths
- public GitHub repository URLs
- manually entered service directories

## Intended Usage

### Local Path

Use this when MESA runs in a trusted environment with filesystem access to a repository checkout.

### Archive Path

Use this when a repository has already been packaged as a ZIP or archive for offline analysis.

### GitHub URL

Use this for public repository analysis workflows when the backend environment can fetch a public snapshot safely.

### Manual Service Paths

Use this when service directories are already known and you want direct control over the scan scope.

## Safety Boundary

MESA is intended for read-only static analysis:

- no repository code execution
- no dependency installation as part of public repo analysis
- no service startup

## Practical Guidance

- use repository preview first when possible
- review discovered services before scanning
- use manual service paths when discovery needs correction
