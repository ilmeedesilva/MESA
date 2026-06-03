from __future__ import annotations

from collections.abc import Iterable

import networkx as nx

from mesa.models import ServiceFacts


def build_graph(services: Iterable[ServiceFacts]) -> nx.MultiDiGraph:
    service_list = list(services)
    names = {service.name for service in service_list}
    graph = nx.MultiDiGraph()

    for service in service_list:
        graph.add_node(
            service.name,
            type="service",
            language=service.language,
            root_path=service.root_path,
            endpoint_count=len(service.endpoints),
            database_count=len(service.databases),
            file_count=service.file_count,
            domain_keywords=service.domain_keywords,
            hard_coded_dependencies=[
                dependency.model_dump(mode="json")
                for dependency in service.hard_coded_dependencies
            ],
        )

    for service in service_list:
        for call in service.calls:
            target = resolve_target(call.target_hint, names)
            if target and target != service.name:
                graph.add_edge(
                    service.name,
                    target,
                    type="api_call",
                    method=call.method,
                    url=call.url,
                    source_location=call.source.model_dump(),
                )

    db_groups: dict[str, list[str]] = {}
    for service in service_list:
        for db in service.databases:
            db_node = f"db:{db.key}"
            graph.add_node(db_node, type="database", key=db.key)
            graph.add_edge(
                service.name,
                db_node,
                type="uses_database",
                raw=db.raw,
                source_location=db.source.model_dump(),
            )
            db_groups.setdefault(db.key, []).append(service.name)

    for db_key, service_names in db_groups.items():
        unique_services = sorted(set(service_names))
        if len(unique_services) < 2:
            continue
        for source in unique_services:
            for target in unique_services:
                if source != target:
                    graph.add_edge(source, target, type="shared_database", database=db_key)

    return graph


def resolve_target(target_hint: str, service_names: set[str]) -> str | None:
    normalized_hint = target_hint.replace("_", "-").lower()
    for service_name in service_names:
        normalized_service = service_name.replace("_", "-").lower()
        if normalized_hint == normalized_service:
            return service_name
        if normalized_hint in normalized_service or normalized_service in normalized_hint:
            return service_name
    return None


def graph_to_dict(graph: nx.MultiDiGraph) -> dict:
    return {
        "nodes": [{"id": node, **data} for node, data in graph.nodes(data=True)],
        "edges": [
            {**data, "source": source, "target": target, "key": key}
            for source, target, key, data in graph.edges(keys=True, data=True)
        ],
    }

