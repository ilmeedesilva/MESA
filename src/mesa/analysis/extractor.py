from __future__ import annotations

import ast
import ipaddress
import json
import re
from pathlib import Path
from urllib.parse import urlparse

from mesa.models import (
    DatabaseConnection,
    Endpoint,
    EnvironmentVariable,
    HardCodedDependency,
    LibraryUsage,
    MessageBrokerConnection,
    ServiceCall,
    ServiceFacts,
    SourceLocation,
)

HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options"}
URL_PATTERN = re.compile(r"https?://[^'\"\s)]+")
HOST_PORT_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_./:-])"
    r"(?P<host>localhost|(?:\d{1,3}\.){3}\d{1,3}|[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)*)"
    r":(?P<port>\d{2,5})"
    r"(?![A-Za-z0-9_.-])"
)
SERVICE_HOST_PATTERN = re.compile(
    r"^[a-z0-9][a-z0-9-]*(?:-service|-svc|service)(?:\..*)?$", re.IGNORECASE
)
ANALYZED_TEXT_SUFFIXES = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".yml", ".yaml",
    ".properties", ".json", ".xml",
}
ANALYZED_TEXT_FILENAMES = {
    ".env", "docker-compose.yml", "docker-compose.yaml", "application.yml",
    "application.yaml", "package.json", "pom.xml",
}
DOMAIN_STOPWORDS = {
    "api", "app", "application", "base", "client", "config", "controller", "data",
    "database", "db", "docker", "env", "error", "handler", "http", "internal", "main",
    "model", "module", "payload", "request", "response", "route", "service", "src",
    "test", "tests", "url", "utils", "view",
}
ENV_PATTERN = re.compile(
    r"^\s*(?:export\s+)?(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?P<value>[^#\n]+)",
    re.MULTILINE,
)
LIBRARY_PATTERN = re.compile(
    r"^\s*(?P<name>[A-Za-z0-9_.-]+)\s*(?:==|>=|<=|~=|>|<)?\s*(?P<version>[A-Za-z0-9_.*+-]+)?",
    re.MULTILINE,
)
BROKER_PATTERN = re.compile(
    r"(?P<type>amqp|amqps|kafka|mqtt|mqtts)://"
    r"(?:(?P<user>[^:@/\s]+)(?::[^@/\s]+)?@)?"
    r"(?P<host>[^:/\s]+)?"
    r"(?::(?P<port>\d+))?"
    r"(?:/(?P<resource>[A-Za-z0-9_.-]+))?"
)
DB_PATTERN = re.compile(
    r"(?P<type>postgresql|postgres|mysql|mongodb|mongo|redis)://"
    r"(?:(?P<user>[^:@/\s]+)(?::[^@/\s]+)?@)?"
    r"(?P<host>[^:/\s]+)?"
    r"(?::(?P<port>\d+))?"
    r"/(?P<database>[A-Za-z0-9_.-]+)"
)
JS_ROUTE_PATTERN = re.compile(
    r"(?:app|router|server)\s*\.\s*(?P<method>get|post|put|patch|delete|head|options)\s*"
    r"\(\s*[`'\"](?P<path>/[^`'\"]*)[`'\"]",
    re.IGNORECASE,
)
NEST_ROUTE_PATTERN = re.compile(
    r"@(?P<method>Get|Post|Put|Patch|Delete|Head|Options)\s*\(\s*(?:[`'\"](?P<path>/[^`'\"]*)[`'\"])?",
)
JS_CALL_PATTERN = re.compile(
    r"(?:fetch|axios\.(?P<axios_method>get|post|put|patch|delete)|request)\s*"
    r"\(\s*[`'\"](?P<url>https?://[^`'\"\s)]+)[`'\"]",
    re.IGNORECASE,
)
SPRING_MAPPING_PATTERN = re.compile(
    r"@(?P<method>GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)"
    r"\s*\((?P<args>[^)]*)\)",
    re.MULTILINE,
)
SPRING_URL_CALL_PATTERN = re.compile(
    r"\.(?:getForObject|postForObject|exchange|execute|getForEntity|postForEntity)\s*"
    r"\(\s*\"(?P<url>https?://[^\"\\\s)]+)\"",
    re.IGNORECASE,
)


_HOSTED_CONFIG_STEM_SUFFIXES = ("-docker", "-prod", "-production", "-local", "-dev", "-staging")


def extract_service_facts(
    service_path: str | Path, sibling_service_names: set[str] | None = None
) -> ServiceFacts:
    root = Path(service_path).resolve()
    facts = ServiceFacts(name=root.name, root_path=str(root), language=detect_language(root))
    other_service_names = {
        name.lower() for name in (sibling_service_names or set()) if name != root.name
    }

    for file_path in sorted(root.rglob("*")):
        if not file_path.is_file() or _is_ignored(file_path):
            continue
        if _is_analyzed_text_file(file_path):
            facts.file_count += 1
        if file_path.suffix == ".py":
            _extract_python_file(file_path, facts)
        if file_path.name == "requirements.txt":
            _extract_requirements(file_path, facts)
        if file_path.name == "package.json":
            _extract_package_json(file_path, facts)
        if file_path.name == "pom.xml":
            _extract_pom_xml(file_path, facts)
        if file_path.suffix in {".js", ".jsx", ".ts", ".tsx"}:
            _extract_javascript_file(file_path, facts)
        if file_path.suffix == ".java":
            _extract_java_file(file_path, facts)
        if _is_openapi_file(file_path):
            _extract_openapi_file(file_path, facts)
        if _is_analyzed_text_file(file_path):
            _extract_hard_coded_dependencies(file_path, facts)
        if file_path.name.startswith(".env") or file_path.suffix in {".yml", ".yaml", ".properties"}:
            hosts_other_service_config = _stem_matches_other_service(file_path, other_service_names)
            _extract_text_config(file_path, facts, include_urls=not hosts_other_service_config)

    facts.domain_keywords = _domain_keywords_for(root, facts)
    return facts


def _stem_matches_other_service(file_path: Path, other_service_names: set[str]) -> bool:
    """True if this file is very likely a Config-Server-hosted copy of another
    service's own config (e.g. config-service/.../discovery-service.yml), rather
    than this service's own configuration. Used to exclude its URLs from this
    service's outbound-call evidence without affecting hard-coded-dependency
    scanning, which still runs on every analyzed text file unconditionally."""
    if not other_service_names:
        return False
    stem = file_path.stem.lower()
    for suffix in _HOSTED_CONFIG_STEM_SUFFIXES:
        if stem.endswith(suffix):
            stem = stem[: -len(suffix)]
            break
    return stem in other_service_names


def _domain_keywords_for(root: Path, facts: ServiceFacts) -> list[str]:
    keywords: set[str] = set()
    service_tokens = set(_tokens_from(root.name))

    for file_path in sorted(root.rglob("*")):
        if not file_path.is_file() or _is_ignored(file_path):
            continue
        relative = file_path.relative_to(root)
        for part in relative.with_suffix("").parts:
            keywords.update(_tokens_from(part))

    for endpoint in facts.endpoints:
        keywords.update(_tokens_from(endpoint.path))
    for call in facts.calls:
        parsed = urlparse(call.url)
        keywords.update(_tokens_from(parsed.path))
        keywords.update(_tokens_from(call.target_hint))
    for database in facts.databases:
        if database.database:
            keywords.update(_tokens_from(database.database))

    return sorted(keyword for keyword in keywords - service_tokens if keyword not in DOMAIN_STOPWORDS)


def _tokens_from(value: str) -> set[str]:
    return {
        token.lower()
        for token in re.split(r"[^A-Za-z0-9]+", value)
        if len(token) >= 3 and not token.isdigit()
    }


def detect_language(root: Path) -> str:
    if any(root.rglob("*.py")):
        return "python"
    if any(root.rglob("*.java")):
        return "java"
    if any(root.rglob("*.js")) or any(root.rglob("*.ts")):
        return "typescript"
    return "unknown"


def _extract_requirements(file_path: Path, facts: ServiceFacts) -> None:
    try:
        content = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return

    for line_number, line in enumerate(content.splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith("-"):
            continue
        match = LIBRARY_PATTERN.match(stripped)
        if not match:
            continue
        facts.libraries.append(
            LibraryUsage(
                service_name=facts.name,
                name=match.group("name"),
                version=match.group("version"),
                source=SourceLocation(file_path=str(file_path), line_number=line_number),
            )
        )


def _extract_package_json(file_path: Path, facts: ServiceFacts) -> None:
    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return
    dependencies = {}
    for section in ["dependencies", "devDependencies"]:
        section_data = data.get(section)
        if isinstance(section_data, dict):
            dependencies.update(section_data)
    for name, version in sorted(dependencies.items()):
        if not isinstance(name, str):
            continue
        facts.libraries.append(
            LibraryUsage(
                service_name=facts.name,
                name=name,
                version=str(version) if version is not None else None,
                source=SourceLocation(file_path=str(file_path), line_number=None),
            )
        )


def _extract_pom_xml(file_path: Path, facts: ServiceFacts) -> None:
    try:
        content = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return
    for match in re.finditer(
        r"<dependency>.*?<groupId>(?P<group>[^<]+)</groupId>.*?<artifactId>(?P<artifact>[^<]+)</artifactId>(?:.*?<version>(?P<version>[^<]+)</version>)?.*?</dependency>",
        content,
        re.DOTALL,
    ):
        facts.libraries.append(
            LibraryUsage(
                service_name=facts.name,
                name=f"{match.group('group')}:{match.group('artifact')}",
                version=match.group("version"),
                source=SourceLocation(
                    file_path=str(file_path), line_number=_line_for(content, match.start())
                ),
            )
        )


def _is_ignored(file_path: Path) -> bool:
    ignored = {".git", "__pycache__", "node_modules", ".venv", "venv", "dist", "build"}
    return any(part in ignored for part in file_path.parts)


def _is_analyzed_text_file(file_path: Path) -> bool:
    if file_path.name.startswith(".env"):
        return True
    if file_path.name in ANALYZED_TEXT_FILENAMES:
        return True
    return file_path.suffix in ANALYZED_TEXT_SUFFIXES


def _extract_python_file(file_path: Path, facts: ServiceFacts) -> None:
    try:
        source = file_path.read_text(encoding="utf-8")
        tree = ast.parse(source)
    except (SyntaxError, UnicodeDecodeError):
        return

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            facts.endpoints.extend(_extract_python_endpoints(file_path, facts.name, node))
        if isinstance(node, ast.Call):
            call = _extract_python_call(file_path, facts.name, node)
            if call:
                facts.calls.append(call)

    _extract_text_config(file_path, facts, text=source, include_urls=False, include_environment=False)


def _extract_javascript_file(file_path: Path, facts: ServiceFacts) -> None:
    try:
        content = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return

    for match in JS_ROUTE_PATTERN.finditer(content):
        facts.endpoints.append(
            Endpoint(
                service_name=facts.name,
                method=match.group("method").upper(),
                path=match.group("path"),
                source=SourceLocation(
                    file_path=str(file_path), line_number=_line_for(content, match.start())
                ),
            )
        )
    for match in NEST_ROUTE_PATTERN.finditer(content):
        method = match.group("method").upper().replace("DELETE", "DELETE")
        path = match.group("path") or "/"
        facts.endpoints.append(
            Endpoint(
                service_name=facts.name,
                method=method,
                path=path,
                source=SourceLocation(
                    file_path=str(file_path), line_number=_line_for(content, match.start())
                ),
            )
        )
    for match in JS_CALL_PATTERN.finditer(content):
        url = match.group("url")
        facts.calls.append(
            ServiceCall(
                caller=facts.name,
                target_hint=target_hint_from_url(url),
                url=url,
                method=(match.group("axios_method") or "UNKNOWN").upper(),
                source=SourceLocation(
                    file_path=str(file_path), line_number=_line_for(content, match.start())
                ),
            )
        )

    _extract_text_config(file_path, facts, text=content, include_urls=False, include_environment=False)


def _extract_java_file(file_path: Path, facts: ServiceFacts) -> None:
    try:
        content = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return

    for match in SPRING_MAPPING_PATTERN.finditer(content):
        path = _spring_path_from_args(match.group("args"))
        facts.endpoints.append(
            Endpoint(
                service_name=facts.name,
                method=_spring_method(match.group("method")),
                path=path,
                source=SourceLocation(
                    file_path=str(file_path), line_number=_line_for(content, match.start())
                ),
            )
        )
    for match in SPRING_URL_CALL_PATTERN.finditer(content):
        url = match.group("url")
        facts.calls.append(
            ServiceCall(
                caller=facts.name,
                target_hint=target_hint_from_url(url),
                url=url,
                method="UNKNOWN",
                source=SourceLocation(
                    file_path=str(file_path), line_number=_line_for(content, match.start())
                ),
            )
        )

    _extract_text_config(file_path, facts, text=content, include_urls=False, include_environment=False)


def _extract_openapi_file(file_path: Path, facts: ServiceFacts) -> None:
    try:
        content = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return
    for match in re.finditer(r"^\s{2,}(?P<path>/[A-Za-z0-9_./{}-]+):\s*$", content, re.MULTILINE):
        path = match.group("path")
        block = content[match.end(): match.end() + 400]
        methods = [
            method.upper()
            for method in HTTP_METHODS
            if re.search(rf"^\s{{4,}}{method}:\s*$", block, re.MULTILINE | re.IGNORECASE)
        ] or ["UNKNOWN"]
        for method in methods:
            facts.endpoints.append(
                Endpoint(
                    service_name=facts.name,
                    method=method,
                    path=path,
                    source=SourceLocation(
                        file_path=str(file_path), line_number=_line_for(content, match.start())
                    ),
                )
            )


def _extract_python_endpoints(
    file_path: Path, service_name: str, node: ast.FunctionDef | ast.AsyncFunctionDef
) -> list[Endpoint]:
    endpoints: list[Endpoint] = []
    for decorator in node.decorator_list:
        if not isinstance(decorator, ast.Call):
            continue
        method = _decorator_http_method(decorator)
        if not method:
            continue
        path = _first_string_arg(decorator) or "/"
        endpoints.append(
            Endpoint(
                service_name=service_name,
                method=method.upper(),
                path=path,
                source=SourceLocation(file_path=str(file_path), line_number=node.lineno),
            )
        )
    return endpoints


def _decorator_http_method(decorator: ast.Call) -> str | None:
    func = decorator.func
    if isinstance(func, ast.Attribute) and func.attr.lower() in HTTP_METHODS | {"route"}:
        if func.attr.lower() == "route":
            for keyword in decorator.keywords:
                if keyword.arg == "methods" and isinstance(keyword.value, (ast.List, ast.Tuple)):
                    for item in keyword.value.elts:
                        if isinstance(item, ast.Constant) and isinstance(item.value, str):
                            return item.value
            return "GET"
        return func.attr
    return None


def _extract_python_call(file_path: Path, service_name: str, node: ast.Call) -> ServiceCall | None:
    method = _call_http_method(node)
    if not method:
        return None
    url = _first_string_arg(node)
    if not url:
        return None
    target_hint = target_hint_from_url(url)
    return ServiceCall(
        caller=service_name,
        target_hint=target_hint,
        url=url,
        method=method.upper(),
        source=SourceLocation(file_path=str(file_path), line_number=node.lineno),
    )


def _call_http_method(node: ast.Call) -> str | None:
    func = node.func
    if isinstance(func, ast.Attribute) and func.attr.lower() in HTTP_METHODS:
        return func.attr
    return None


def _first_string_arg(node: ast.Call) -> str | None:
    if not node.args:
        return None
    first = node.args[0]
    if isinstance(first, ast.Constant) and isinstance(first.value, str):
        return first.value
    return None


def _spring_path_from_args(args: str) -> str:
    match = re.search(r"(?:value\s*=\s*)?[\"'](?P<path>/[^\"']*)[\"']", args)
    return match.group("path") if match else "/"


def _spring_method(mapping: str) -> str:
    mapping = mapping.lower()
    if mapping.startswith("get"):
        return "GET"
    if mapping.startswith("post"):
        return "POST"
    if mapping.startswith("put"):
        return "PUT"
    if mapping.startswith("patch"):
        return "PATCH"
    if mapping.startswith("delete"):
        return "DELETE"
    return "UNKNOWN"


def _is_openapi_file(file_path: Path) -> bool:
    lowered = file_path.name.lower()
    return lowered.startswith("openapi.") or lowered.startswith("swagger.")


def _extract_text_config(
    file_path: Path,
    facts: ServiceFacts,
    text: str | None = None,
    include_urls: bool = True,
    include_environment: bool = True,
) -> None:
    try:
        content = text if text is not None else file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return

    if include_environment:
        for match in ENV_PATTERN.finditer(content):
            value = match.group("value").strip().strip("'\"")
            facts.environment_variables.append(
                EnvironmentVariable(
                    service_name=facts.name,
                    name=match.group("name"),
                    value_hint=_redact_value(value),
                    source=SourceLocation(
                        file_path=str(file_path), line_number=_line_for(content, match.start())
                    ),
                )
            )

    for match in BROKER_PATTERN.finditer(content):
        facts.message_brokers.append(
            MessageBrokerConnection(
                service_name=facts.name,
                raw=match.group(0),
                broker_type=match.group("type"),
                host=match.group("host"),
                source=SourceLocation(
                    file_path=str(file_path), line_number=_line_for(content, match.start())
                ),
            )
        )

    for match in DB_PATTERN.finditer(content):
        db_type = match.group("type").replace("postgresql", "postgres").replace("mongo", "mongodb")
        facts.databases.append(
            DatabaseConnection(
                service_name=facts.name,
                raw=match.group(0),
                db_type=db_type,
                host=match.group("host"),
                database=match.group("database"),
                source=SourceLocation(
                    file_path=str(file_path), line_number=_line_for(content, match.start())
                ),
            )
        )

    if not include_urls:
        return

    for match in URL_PATTERN.finditer(content):
        url = match.group(0)
        if DB_PATTERN.search(url):
            continue
        facts.calls.append(
            ServiceCall(
                caller=facts.name,
                target_hint=target_hint_from_url(url),
                url=url,
                source=SourceLocation(
                    file_path=str(file_path), line_number=_line_for(content, match.start())
                ),
            )
        )


def _extract_hard_coded_dependencies(file_path: Path, facts: ServiceFacts) -> None:
    try:
        content = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return

    file_type = _file_type(file_path)
    seen: set[tuple[str, int]] = set()
    for match in URL_PATTERN.finditer(content):
        url = match.group(0).rstrip("'\"),]}")
        parsed = urlparse(url)
        host = parsed.hostname
        if not host:
            continue
        classification = _classify_hard_coded_host(host)
        if classification is None:
            continue
        try:
            port = parsed.port
        except ValueError:
            # e.g. a Spring-style placeholder port such as "${server.port}"
            port = None
        line_number = _line_for(content, match.start())
        seen.add((url, line_number))
        facts.hard_coded_dependencies.append(
            HardCodedDependency(
                service_name=facts.name,
                value=url,
                host=host,
                port=port,
                scheme=parsed.scheme,
                file_type=file_type,
                context=_context_for(content, match.start()),
                reason=classification,
                source=SourceLocation(file_path=str(file_path), line_number=line_number),
            )
        )

    for match in HOST_PORT_PATTERN.finditer(content):
        if _inside_url(content, match.start()):
            continue
        host = match.group("host")
        port = int(match.group("port"))
        if port > 65535:
            continue
        classification = _classify_hard_coded_host(host)
        if classification is None:
            continue
        value = match.group(0)
        line_number = _line_for(content, match.start())
        if (value, line_number) in seen:
            continue
        facts.hard_coded_dependencies.append(
            HardCodedDependency(
                service_name=facts.name,
                value=value,
                host=host,
                port=port,
                file_type=file_type,
                context=_context_for(content, match.start()),
                reason=classification,
                source=SourceLocation(file_path=str(file_path), line_number=line_number),
            )
        )


def _classify_hard_coded_host(host: str) -> str | None:
    normalized = host.lower().strip("[]")
    if normalized in {"localhost", "127.0.0.1", "0.0.0.0"}:
        return "local development endpoint"
    try:
        address = ipaddress.ip_address(normalized)
    except ValueError:
        address = None
    if address and (address.is_private or address.is_loopback):
        return "private IP endpoint"
    if SERVICE_HOST_PATTERN.match(normalized):
        return "service hostname"
    if "." not in normalized and "-" in normalized:
        return "single-label service-like hostname"
    return None


def _inside_url(content: str, start: int) -> bool:
    prefix = content[max(0, start - 10):start]
    return "://" in prefix


def _context_for(content: str, start: int) -> str:
    line_start = content.rfind("\n", 0, start) + 1
    line_end = content.find("\n", start)
    if line_end == -1:
        line_end = len(content)
    return content[line_start:line_end].strip()[:240]


def _file_type(file_path: Path) -> str:
    if file_path.name.startswith(".env"):
        return "env"
    if file_path.name in {"docker-compose.yml", "docker-compose.yaml"}:
        return "docker_compose"
    if file_path.name in {"application.yml", "application.yaml"}:
        return "application_config"
    if file_path.name == "package.json":
        return "package_json"
    if file_path.name == "pom.xml":
        return "pom_xml"
    suffix_map = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".java": "java",
        ".yml": "yaml",
        ".yaml": "yaml",
        ".properties": "properties",
        ".json": "json",
        ".xml": "xml",
    }
    return suffix_map.get(file_path.suffix, "text")


def target_hint_from_url(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or url
    return host.split(".")[0].replace("_", "-").lower()


def _redact_value(value: str) -> str:
    if len(value) <= 4:
        return "****"
    return f"{value[:2]}***{value[-2:]}"


def _line_for(content: str, offset: int) -> int:
    return content.count("\n", 0, offset) + 1
