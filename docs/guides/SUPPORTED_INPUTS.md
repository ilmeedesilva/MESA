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

## Known Limitations

MESA reads source code without running it, so some service calls are not visible to it.

- **Python calls need a plain string URL.** A call such as
  `requests.get("http://user-service:8080/users/1")` is recognised as a call from one service
  to another. A URL written as an f-string (`requests.get(f"http://user-service/{user_id}")`),
  built from variables (`requests.get(BASE_URL + "/users")`) or passed as a keyword
  (`requests.get(url=...)`) is not. Such a call adds no edge to the dependency graph, so it
  cannot count towards a cyclic dependency or a chatty service pair. The address is still
  reported as a hard-coded service dependency, because that check scans the text of the file.
- **JavaScript, TypeScript, Java and Go are read with patterns, not a full parser.** URLs that
  are assembled at runtime, read from configuration, or produced by a client library are
  missed.
- **Only HTTP calls and database connection settings are dependencies.** Message queues
  (Kafka, RabbitMQ) and gRPC are not yet followed.

These limits are kept as they are for now, because changing the extractor would change the
published benchmark results.
