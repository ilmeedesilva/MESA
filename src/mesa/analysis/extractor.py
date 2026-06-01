from __future__ import annotations

import ast
import re
from pathlib import Path
from urllib.parse import urlparse

from mesa.models import (
    DatabaseConnection,
    Endpoint,
    EnvironmentVariable,
    LibraryUsage,
    MessageBrokerConnection,
    ServiceCall,
    ServiceFacts,
    SourceLocation,
)

HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options"}
URL_PATTERN = re.compile(r"https?://[^'\"\s)]+")
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


def extract_service_facts(service_path: str | Path) -> ServiceFacts:
    root = Path(service_path).resolve()
    facts = ServiceFacts(name=root.name, root_path=str(root), language=detect_language(root))

    for file_path in sorted(root.rglob("*")):
        if not file_path.is_file() or _is_ignored(file_path):
            continue
        if file_path.suffix == ".py":
            _extract_python_file(file_path, facts)
        if file_path.name == "requirements.txt":
            _extract_requirements(file_path, facts)
        if file_path.name.startswith(".env") or file_path.suffix in {".yml", ".yaml", ".properties"}:
            _extract_text_config(file_path, facts, include_urls=True)

    return facts


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


def _is_ignored(file_path: Path) -> bool:
    ignored = {".git", "__pycache__", "node_modules", ".venv", "venv", "dist", "build"}
    return any(part in ignored for part in file_path.parts)


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
