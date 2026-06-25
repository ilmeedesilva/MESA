from __future__ import annotations

import os
import time
from collections.abc import Iterable
from typing import Any
from urllib.parse import urlparse

from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError, ServiceUnavailable

from mesa.models import AnalysisResult, ServiceFacts


class Neo4jArchitectureStore:
    """Persistence adapter for the MESA architectural digital twin graph."""

    def __init__(
        self,
        uri: str | None = None,
        user: str | None = None,
        password: str | None = None,
        max_retries: int = 30,
        retry_delay_seconds: float = 1.0,
    ) -> None:
        self.uri = uri or os.getenv("MESA_NEO4J_URI", "bolt://localhost:7687")
        self.user = user or os.getenv("MESA_NEO4J_USER", "neo4j")
        self.password = password or os.getenv("MESA_NEO4J_PASSWORD", "mesa-password")
        self.max_retries = max_retries
        self.retry_delay_seconds = retry_delay_seconds

    def initialize(self) -> None:
        with self._session() as session:
            for statement in _CONSTRAINTS:
                session.run(statement)

    def save_scan_graph(self, project_id: str, scan_id: str, result: AnalysisResult) -> None:
        """Persist one scan as a queryable architecture knowledge graph."""
        with self._session() as session:
            session.execute_write(self._clear_scan_graph, scan_id)
            session.execute_write(self._write_project_and_scan, project_id, scan_id)
            for service in result.services:
                session.execute_write(self._write_service, project_id, scan_id, service)
            for service in result.services:
                for endpoint_index, endpoint in enumerate(service.endpoints, start=1):
                    session.execute_write(
                        self._write_api,
                        project_id,
                        scan_id,
                        service.name,
                        endpoint_index,
                        endpoint.model_dump(mode="json"),
                    )
                for db_index, database in enumerate(service.databases, start=1):
                    session.execute_write(
                        self._write_database,
                        project_id,
                        scan_id,
                        service.name,
                        db_index,
                        database.model_dump(mode="json"),
                    )
                for library_index, library in enumerate(service.libraries, start=1):
                    session.execute_write(
                        self._write_library,
                        project_id,
                        scan_id,
                        service.name,
                        library_index,
                        library.model_dump(mode="json"),
                    )
                for env_index, environment_variable in enumerate(
                    service.environment_variables, start=1
                ):
                    session.execute_write(
                        self._write_environment_variable,
                        project_id,
                        scan_id,
                        service.name,
                        env_index,
                        environment_variable.model_dump(mode="json"),
                    )
                for broker_index, broker in enumerate(service.message_brokers, start=1):
                    session.execute_write(
                        self._write_message_broker,
                        project_id,
                        scan_id,
                        service.name,
                        broker_index,
                        broker.model_dump(mode="json"),
                    )

            for edge in result.graph.get("edges", []):
                edge_type = edge.get("type")
                if edge_type == "api_call":
                    session.execute_write(self._write_call_edge, project_id, scan_id, edge)
                if edge_type == "shared_database":
                    session.execute_write(self._write_shared_database_edge, project_id, scan_id, edge)

            for dependency in _service_dependencies(result.graph.get("edges", [])):
                session.execute_write(
                    self._write_dependency_edge,
                    project_id,
                    scan_id,
                    dependency["source"],
                    dependency["target"],
                    dependency["kind"],
                    dependency["weight"],
                    dependency.get("database"),
                )

    def write_services(self, project_id: str, services: Iterable[ServiceFacts]) -> None:
        """Backward-compatible service-only writer retained for earlier scripts."""
        scan_id = f"legacy:{project_id}"
        result = AnalysisResult(
            services=list(services),
            findings=[],
            graph={"nodes": [], "edges": []},
            summary={"service_count": 0, "finding_count": 0},
        )
        self.save_scan_graph(project_id, scan_id, result)

    def get_architecture_graph(self, scan_id: str) -> dict[str, list[dict[str, Any]]]:
        with self._session() as session:
            rows = session.run(
                """
                MATCH (n {scan_id: $scan_id})
                WITH n, properties(n) AS node_properties
                RETURN elementId(n) AS element_id, labels(n) AS labels,
                       node_properties AS properties
                ORDER BY coalesce(
                    node_properties.name,
                    node_properties.path,
                    node_properties.key,
                    node_properties.id
                )
                """,
                scan_id=scan_id,
            ).data()
            edge_rows = session.run(
                """
                MATCH (a {scan_id: $scan_id})-[r]->(b {scan_id: $scan_id})
                RETURN elementId(a) AS source, elementId(b) AS target, type(r) AS type,
                       properties(r) AS properties
                ORDER BY type(r), source, target
                """,
                scan_id=scan_id,
            ).data()
        return {"nodes": rows, "relationships": edge_rows}

    def find_dependency_paths(
        self, scan_id: str, source: str, target: str, max_depth: int = 4
    ) -> list[dict[str, Any]]:
        depth = _bounded_depth(max_depth)
        with self._session() as session:
            if not self._relationship_type_exists(session, "DEPENDS_ON"):
                return []
            return session.run(
                f"""
                MATCH path=(s:Service {{scan_id: $scan_id, name: $source}})
                      -[:DEPENDS_ON*1..{depth}]->
                      (t:Service {{scan_id: $scan_id, name: $target}})
                RETURN [node IN nodes(path) | node.name] AS services,
                       length(path) AS length
                ORDER BY length ASC
                LIMIT 25
                """,
                scan_id=scan_id,
                source=source,
                target=target,
            ).data()

    def find_cycles(self, scan_id: str, max_depth: int = 6) -> list[dict[str, Any]]:
        depth = max(2, _bounded_depth(max_depth, upper=8))
        with self._session() as session:
            if not self._relationship_type_exists(session, "DEPENDS_ON"):
                return []
            rows = session.run(
                f"""
                MATCH path=(s:Service {{scan_id: $scan_id}})-[:DEPENDS_ON*2..{depth}]->(s)
                WITH [node IN nodes(path) | node.name] AS cycle
                RETURN DISTINCT cycle, size(cycle) - 1 AS length
                ORDER BY length ASC, cycle ASC
                LIMIT 50
                """,
                scan_id=scan_id,
            ).data()
        return _deduplicate_cycles(rows)

    def get_service_centrality(self, scan_id: str) -> list[dict[str, Any]]:
        with self._session() as session:
            if not self._relationship_type_exists(session, "DEPENDS_ON"):
                return session.run(
                    """
                    MATCH (s:Service {scan_id: $scan_id})
                    RETURN s.name AS service, 0 AS incoming, 0 AS outgoing,
                           0 AS degree_centrality
                    ORDER BY service ASC
                    """,
                    scan_id=scan_id,
                ).data()
            return session.run(
                """
                MATCH (s:Service {scan_id: $scan_id})
                OPTIONAL MATCH (s)-[out:DEPENDS_ON]->(:Service {scan_id: $scan_id})
                WITH s, count(out) AS outgoing
                OPTIONAL MATCH (:Service {scan_id: $scan_id})-[inc:DEPENDS_ON]->(s)
                WITH s, outgoing, count(inc) AS incoming
                RETURN s.name AS service, incoming, outgoing,
                       incoming + outgoing AS degree_centrality
                ORDER BY degree_centrality DESC, service ASC
                """,
                scan_id=scan_id,
            ).data()

    def find_shared_database_relationships(self, scan_id: str) -> list[dict[str, Any]]:
        with self._session() as session:
            if not self._relationship_type_exists(session, "SHARES_DATABASE_WITH"):
                return []
            return session.run(
                """
                MATCH (a:Service {scan_id: $scan_id})-[r:SHARES_DATABASE_WITH]->
                      (b:Service {scan_id: $scan_id})
                WITH a, b, properties(r) AS relationship_properties
                RETURN a.name AS source,
                       b.name AS target,
                       relationship_properties.database AS database
                ORDER BY database, source, target
                """,
                scan_id=scan_id,
            ).data()

    def find_high_risk_dependency_clusters(
        self, scan_id: str, degree_threshold: int = 3
    ) -> list[dict[str, Any]]:
        with self._session() as session:
            if not self._relationship_type_exists(session, "DEPENDS_ON"):
                if not self._relationship_type_exists(session, "SHARES_DATABASE_WITH"):
                    return []
                return session.run(
                    """
                    MATCH (s:Service {scan_id: $scan_id})-[shared:SHARES_DATABASE_WITH]->
                          (:Service {scan_id: $scan_id})
                    WITH s, count(shared) AS shared_database_links
                    WHERE shared_database_links > 0
                    RETURN s.name AS service,
                           0 AS outgoing,
                           0 AS incoming,
                           0 AS dependency_degree,
                           shared_database_links,
                           'shared_database_cluster' AS risk_reason
                    ORDER BY shared_database_links DESC, service ASC
                    """,
                    scan_id=scan_id,
                ).data()
            return session.run(
                """
                MATCH (s:Service {scan_id: $scan_id})
                OPTIONAL MATCH (s)-[out:DEPENDS_ON]->(:Service {scan_id: $scan_id})
                WITH s, count(out) AS outgoing
                OPTIONAL MATCH (:Service {scan_id: $scan_id})-[inc:DEPENDS_ON]->(s)
                WITH s, outgoing, count(inc) AS incoming
                OPTIONAL MATCH (s)-[shared:SHARES_DATABASE_WITH]->(:Service {scan_id: $scan_id})
                WITH s, outgoing, incoming, count(shared) AS shared_database_links
                WHERE outgoing + incoming >= $degree_threshold OR shared_database_links > 0
                RETURN s.name AS service,
                       outgoing,
                       incoming,
                       outgoing + incoming AS dependency_degree,
                       shared_database_links,
                       CASE
                         WHEN outgoing + incoming >= $degree_threshold AND shared_database_links > 0
                         THEN 'dependency_hotspot_with_shared_database'
                         WHEN shared_database_links > 0
                         THEN 'shared_database_cluster'
                         ELSE 'dependency_hotspot'
                       END AS risk_reason
                ORDER BY dependency_degree DESC, shared_database_links DESC, service ASC
                """,
                scan_id=scan_id,
                degree_threshold=degree_threshold,
            ).data()

    def _session(self):
        last_error: Exception | None = None
        for _ in range(self.max_retries):
            try:
                driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
                driver.verify_connectivity()
                return _ClosingSession(driver)
            except (ServiceUnavailable, Neo4jError, OSError) as error:
                last_error = error
                time.sleep(self.retry_delay_seconds)
        if last_error is not None:
            raise last_error
        raise RuntimeError("Could not connect to Neo4j")

    @staticmethod
    def _relationship_type_exists(session, relationship_type: str) -> bool:
        row = session.run(
            """
            CALL db.relationshipTypes() YIELD relationshipType
            RETURN relationshipType = $relationship_type AS exists
            ORDER BY exists DESC
            LIMIT 1
            """,
            relationship_type=relationship_type,
        ).single()
        return bool(row and row["exists"])

    @staticmethod
    def _clear_scan_graph(tx, scan_id: str) -> None:
        tx.run("MATCH (n {scan_id: $scan_id}) DETACH DELETE n", scan_id=scan_id)
        tx.run("MATCH (scan:Scan {id: $scan_id}) DETACH DELETE scan", scan_id=scan_id)

    @staticmethod
    def _write_project_and_scan(tx, project_id: str, scan_id: str) -> None:
        tx.run(
            """
            MERGE (project:Project {id: $project_id})
            MERGE (scan:Scan {id: $scan_id})
            SET scan.project_id = $project_id, scan.scan_id = $scan_id
            MERGE (project)-[:HAS_SCAN]->(scan)
            """,
            project_id=project_id,
            scan_id=scan_id,
        )

    @staticmethod
    def _write_service(tx, project_id: str, scan_id: str, service: ServiceFacts) -> None:
        tx.run(
            """
            MATCH (project:Project {id: $project_id})
            MATCH (scan:Scan {id: $scan_id})
            MERGE (service:Service {project_id: $project_id, scan_id: $scan_id, name: $name})
            SET service.language = $language,
                service.root_path = $root_path,
                service.endpoint_count = $endpoint_count,
                service.outbound_call_count = $outbound_call_count,
                service.database_count = $database_count
            MERGE (project)-[:OWNS]->(service)
            MERGE (scan)-[:CONTAINS]->(service)
            """,
            project_id=project_id,
            scan_id=scan_id,
            name=service.name,
            language=service.language,
            root_path=service.root_path,
            endpoint_count=len(service.endpoints),
            outbound_call_count=len(service.calls),
            database_count=len(service.databases),
        )

    @staticmethod
    def _write_api(
        tx, project_id: str, scan_id: str, service_name: str, endpoint_index: int, endpoint: dict[str, Any]
    ) -> None:
        api_id = f"{scan_id}:api:{service_name}:{endpoint_index}"
        tx.run(
            """
            MATCH (service:Service {project_id: $project_id, scan_id: $scan_id, name: $service_name})
            MERGE (api:API {id: $api_id})
            SET api.project_id = $project_id,
                api.scan_id = $scan_id,
                api.service = $service_name,
                api.method = $method,
                api.path = $path,
                api.source_file = $source_file,
                api.source_line = $source_line
            MERGE (service)-[:EXPOSES_API]->(api)
            """,
            project_id=project_id,
            scan_id=scan_id,
            service_name=service_name,
            api_id=api_id,
            method=endpoint.get("method"),
            path=endpoint.get("path"),
            source_file=(endpoint.get("source") or {}).get("file_path"),
            source_line=(endpoint.get("source") or {}).get("line_number"),
        )

    @staticmethod
    def _write_database(
        tx,
        project_id: str,
        scan_id: str,
        service_name: str,
        db_index: int,
        database: dict[str, Any],
    ) -> None:
        db_key = _database_key(database)
        database_id = f"{scan_id}:database:{db_key}"
        config_id = f"{scan_id}:config:{service_name}:database:{db_index}"
        tx.run(
            """
            MATCH (service:Service {project_id: $project_id, scan_id: $scan_id, name: $service_name})
            MERGE (database:Database {id: $database_id})
            SET database.project_id = $project_id,
                database.scan_id = $scan_id,
                database.key = $db_key,
                database.db_type = $db_type,
                database.host = $host,
                database.database = $database_name
            MERGE (config:Config {id: $config_id})
            SET config.project_id = $project_id,
                config.scan_id = $scan_id,
                config.source_file = $source_file,
                config.source_line = $source_line,
                config.raw = $raw,
                config.kind = 'database_connection'
            MERGE (service)-[:OWNS]->(config)
            MERGE (config)-[:DEPENDS_ON]->(database)
            MERGE (service)-[:READS_FROM {database: $db_key}]->(database)
            MERGE (service)-[:WRITES_TO {database: $db_key}]->(database)
            """,
            project_id=project_id,
            scan_id=scan_id,
            service_name=service_name,
            database_id=database_id,
            config_id=config_id,
            db_key=db_key,
            db_type=database.get("db_type"),
            host=database.get("host"),
            database_name=database.get("database"),
            source_file=(database.get("source") or {}).get("file_path"),
            source_line=(database.get("source") or {}).get("line_number"),
            raw=database.get("raw"),
        )

    @staticmethod
    def _write_library(
        tx,
        project_id: str,
        scan_id: str,
        service_name: str,
        library_index: int,
        library: dict[str, Any],
    ) -> None:
        library_key = f"{library.get('name')}:{library.get('version') or 'unspecified'}"
        library_id = f"{scan_id}:library:{library_key}"
        tx.run(
            """
            MATCH (service:Service {project_id: $project_id, scan_id: $scan_id, name: $service_name})
            MERGE (library:Library {id: $library_id})
            SET library.project_id = $project_id,
                library.scan_id = $scan_id,
                library.name = $name,
                library.version = $version,
                library.source_file = $source_file,
                library.source_line = $source_line
            MERGE (service)-[:USES_LIBRARY {declaration_index: $library_index}]->(library)
            """,
            project_id=project_id,
            scan_id=scan_id,
            service_name=service_name,
            library_id=library_id,
            library_index=library_index,
            name=library.get("name"),
            version=library.get("version"),
            source_file=(library.get("source") or {}).get("file_path"),
            source_line=(library.get("source") or {}).get("line_number"),
        )

    @staticmethod
    def _write_environment_variable(
        tx,
        project_id: str,
        scan_id: str,
        service_name: str,
        env_index: int,
        environment_variable: dict[str, Any],
    ) -> None:
        env_id = f"{scan_id}:env:{service_name}:{environment_variable.get('name')}:{env_index}"
        tx.run(
            """
            MATCH (service:Service {project_id: $project_id, scan_id: $scan_id, name: $service_name})
            MERGE (env:EnvironmentVariable {id: $env_id})
            SET env.project_id = $project_id,
                env.scan_id = $scan_id,
                env.service = $service_name,
                env.name = $name,
                env.value_hint = $value_hint,
                env.source_file = $source_file,
                env.source_line = $source_line
            MERGE (service)-[:OWNS]->(env)
            """,
            project_id=project_id,
            scan_id=scan_id,
            service_name=service_name,
            env_id=env_id,
            name=environment_variable.get("name"),
            value_hint=environment_variable.get("value_hint"),
            source_file=(environment_variable.get("source") or {}).get("file_path"),
            source_line=(environment_variable.get("source") or {}).get("line_number"),
        )

    @staticmethod
    def _write_message_broker(
        tx,
        project_id: str,
        scan_id: str,
        service_name: str,
        broker_index: int,
        broker: dict[str, Any],
    ) -> None:
        broker_key = f"{broker.get('broker_type')}://{broker.get('host') or 'unknown'}"
        broker_id = f"{scan_id}:broker:{broker_key}:{broker_index}"
        tx.run(
            """
            MATCH (service:Service {project_id: $project_id, scan_id: $scan_id, name: $service_name})
            MERGE (broker:MessageBroker {id: $broker_id})
            SET broker.project_id = $project_id,
                broker.scan_id = $scan_id,
                broker.broker_type = $broker_type,
                broker.host = $host,
                broker.raw = $raw,
                broker.source_file = $source_file,
                broker.source_line = $source_line
            MERGE (service)-[:DEPENDS_ON {kind: 'message_broker'}]->(broker)
            """,
            project_id=project_id,
            scan_id=scan_id,
            service_name=service_name,
            broker_id=broker_id,
            broker_type=broker.get("broker_type"),
            host=broker.get("host"),
            raw=broker.get("raw"),
            source_file=(broker.get("source") or {}).get("file_path"),
            source_line=(broker.get("source") or {}).get("line_number"),
        )

    @staticmethod
    def _write_call_edge(tx, project_id: str, scan_id: str, edge: dict[str, Any]) -> None:
        call_id = f"{scan_id}:call:{edge.get('source')}:{edge.get('target')}:{edge.get('key')}"
        api_path = _path_from_url(edge.get("url", ""))
        tx.run(
            """
            MATCH (source:Service {project_id: $project_id, scan_id: $scan_id, name: $source_name})
            MATCH (target:Service {project_id: $project_id, scan_id: $scan_id, name: $target_name})
            CREATE (source)-[:CALLS {
                id: $call_id,
                method: $method,
                url: $url,
                source_file: $source_file,
                source_line: $source_line
            }]->(target)
            WITH source, target
            OPTIONAL MATCH (api:API {project_id: $project_id, scan_id: $scan_id,
                                     service: $target_name, path: $api_path})
            FOREACH (_ IN CASE WHEN api IS NULL THEN [] ELSE [1] END |
                CREATE (source)-[:CONSUMES_API {method: $method, url: $url}]->(api)
            )
            """,
            project_id=project_id,
            scan_id=scan_id,
            source_name=edge.get("source"),
            target_name=edge.get("target"),
            call_id=call_id,
            method=edge.get("method"),
            url=edge.get("url"),
            api_path=api_path,
            source_file=(edge.get("source_location") or {}).get("file_path"),
            source_line=(edge.get("source_location") or {}).get("line_number"),
        )

    @staticmethod
    def _write_shared_database_edge(tx, project_id: str, scan_id: str, edge: dict[str, Any]) -> None:
        tx.run(
            """
            MATCH (source:Service {project_id: $project_id, scan_id: $scan_id, name: $source_name})
            MATCH (target:Service {project_id: $project_id, scan_id: $scan_id, name: $target_name})
            MERGE (source)-[:SHARES_DATABASE_WITH {database: $database}]->(target)
            """,
            project_id=project_id,
            scan_id=scan_id,
            source_name=edge.get("source"),
            target_name=edge.get("target"),
            database=edge.get("database"),
        )

    @staticmethod
    def _write_dependency_edge(
        tx,
        project_id: str,
        scan_id: str,
        source: str,
        target: str,
        kind: str,
        weight: int,
        database: str | None = None,
    ) -> None:
        tx.run(
            """
            MATCH (source:Service {project_id: $project_id, scan_id: $scan_id, name: $source_name})
            MATCH (target:Service {project_id: $project_id, scan_id: $scan_id, name: $target_name})
            MERGE (source)-[dependency:DEPENDS_ON {kind: $kind}]->(target)
            SET dependency.weight = $weight,
                dependency.call_count = CASE WHEN $kind = 'api_call' THEN $weight ELSE 0 END,
                dependency.database = $database
            """,
            project_id=project_id,
            scan_id=scan_id,
            source_name=source,
            target_name=target,
            kind=kind,
            weight=weight,
            database=database,
        )


class _ClosingSession:
    def __init__(self, driver):
        self.driver = driver
        self.session = None

    def __enter__(self):
        self.session = self.driver.session()
        return self.session

    def __exit__(self, exc_type, exc, traceback) -> None:
        if self.session is not None:
            self.session.close()
        self.driver.close()


_CONSTRAINTS = [
    "CREATE CONSTRAINT mesa_project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE",
    "CREATE CONSTRAINT mesa_scan_id IF NOT EXISTS FOR (s:Scan) REQUIRE s.id IS UNIQUE",
    "CREATE CONSTRAINT mesa_api_id IF NOT EXISTS FOR (a:API) REQUIRE a.id IS UNIQUE",
    "CREATE CONSTRAINT mesa_database_id IF NOT EXISTS FOR (d:Database) REQUIRE d.id IS UNIQUE",
    "CREATE CONSTRAINT mesa_config_id IF NOT EXISTS FOR (c:Config) REQUIRE c.id IS UNIQUE",
    "CREATE CONSTRAINT mesa_library_id IF NOT EXISTS FOR (l:Library) REQUIRE l.id IS UNIQUE",
    "CREATE CONSTRAINT mesa_env_id IF NOT EXISTS FOR (e:EnvironmentVariable) REQUIRE e.id IS UNIQUE",
    "CREATE CONSTRAINT mesa_broker_id IF NOT EXISTS FOR (b:MessageBroker) REQUIRE b.id IS UNIQUE",
]


def _service_dependencies(edges: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    dependencies: dict[tuple[str, str, str, str | None], dict[str, Any]] = {}
    for edge in edges:
        edge_type = edge.get("type")
        if edge_type == "api_call":
            key = (edge["source"], edge["target"], "api_call", None)
            dependency = dependencies.setdefault(
                key,
                {"source": edge["source"], "target": edge["target"], "kind": "api_call", "weight": 0},
            )
            dependency["weight"] += 1
        if edge_type == "shared_database":
            database = edge.get("database")
            key = (edge["source"], edge["target"], "shared_database", database)
            dependencies.setdefault(
                key,
                {
                    "source": edge["source"],
                    "target": edge["target"],
                    "kind": "shared_database",
                    "weight": 1,
                    "database": database,
                },
            )
    return list(dependencies.values())


def _bounded_depth(depth: int, upper: int = 6) -> int:
    return min(max(depth, 1), upper)


def _deduplicate_cycles(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, ...]] = set()
    unique: list[dict[str, Any]] = []
    for row in rows:
        cycle = row["cycle"]
        service_cycle = cycle[:-1] if cycle and cycle[0] == cycle[-1] else cycle
        canonical = tuple(sorted(service_cycle))
        if canonical in seen:
            continue
        seen.add(canonical)
        unique.append({"cycle": service_cycle, "cycle_path": cycle, "length": row["length"]})
    return unique


def _database_key(database: dict[str, Any]) -> str:
    db_type = (database.get("db_type") or "unknown").lower()
    host = (database.get("host") or "localhost").lower()
    database_name = (database.get("database") or "").lower()
    return f"{db_type}://{host}/{database_name}"


def _path_from_url(url: str) -> str:
    parsed = urlparse(url)
    return parsed.path or "/"
