from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import json
import logging
import os
from pathlib import Path
import re
from urllib import error as urllib_error
from urllib import request as urllib_request

from mesa.models import (
    AIConnectionState,
    AIExplainerConfidence,
    AIExplainerEvidence,
    AIExplainerIntent,
    AIExplainerRequest,
    AIExplainerResponse,
    AIExplainerStatus,
    AnalysisResult,
    EvolutionReport,
    Finding,
    HealthScore,
    PolicyRecord,
    Severity,
)

_SEVERITY_WEIGHT = {
    Severity.CRITICAL: 4,
    Severity.HIGH: 3,
    Severity.MEDIUM: 2,
    Severity.LOW: 1,
}

_PLACEHOLDER_KEY_FRAGMENTS = {
    "your_api_key_here",
    "your_api_key",
    "replace_me",
    "sk-...",
}

logger = logging.getLogger(__name__)

_LIVE_AI_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "title": {"type": "string"},
        "answer": {"type": "string"},
        "suggestions": {"type": "array", "items": {"type": "string"}},
        "follow_up_questions": {"type": "array", "items": {"type": "string"}},
        "limitations": {"type": "array", "items": {"type": "string"}},
        "policy_document": {"type": ["string", "null"]},
        "confidence": {"type": "string", "enum": ["LOW", "MODERATE", "HIGH"]},
    },
    "required": [
        "title",
        "answer",
        "suggestions",
        "follow_up_questions",
        "limitations",
        "policy_document",
        "confidence",
    ],
}



@dataclass(frozen=True)
class _DocPage:
    path: str
    title: str
    category: str
    content: str


def explain_with_grounded_context(
    payload: AIExplainerRequest,
    *,
    result: AnalysisResult | None = None,
    scores: list[HealthScore] | None = None,
    policies: list[PolicyRecord] | None = None,
    comparison: EvolutionReport | None = None,
) -> AIExplainerResponse:
    scores = scores or []
    policies = policies or []
    intent = _resolve_intent(payload, result is not None, comparison is not None)

    grounded_response = grounded_response_for_request(
        payload,
        intent=intent,
        result=result,
        scores=scores,
        policies=policies,
        comparison=comparison,
    )
    return finalize_response_with_live_ai(payload, grounded_response)


def grounded_response_for_request(
    payload: AIExplainerRequest,
    *,
    intent: AIExplainerIntent | None,
    result: AnalysisResult | None,
    scores: list[HealthScore],
    policies: list[PolicyRecord],
    comparison: EvolutionReport | None,
) -> AIExplainerResponse:
    intent = intent or _resolve_intent(
        payload, result is not None, comparison is not None
    )
    if intent == AIExplainerIntent.DOC_QA:
        return _doc_answer(payload)
    if result is None and intent != AIExplainerIntent.COMPARE_SCANS:
        return _missing_scan_response(
            intent, payload.question or "No scan question provided."
        )
    if intent == AIExplainerIntent.SCAN_SUMMARY:
        return _scan_summary_answer(result, scores)
    if intent == AIExplainerIntent.FINDING_EXPLANATION:
        return _finding_answer(payload, result)
    if intent == AIExplainerIntent.PRIORITIZE_FIXES:
        return _prioritize_answer(result)
    if intent == AIExplainerIntent.HEALTH_SCORE_EXPLANATION:
        return _health_answer(payload, scores, result)
    if intent == AIExplainerIntent.COMPARE_SCANS:
        return _comparison_answer(payload, comparison)
    if intent == AIExplainerIntent.GOVERNANCE_POLICY_HELP:
        return _governance_answer(result, policies)
    if intent == AIExplainerIntent.POLICY_WRITING_ASSISTANCE:
        return _policy_draft_answer(result, policies)
    return _scan_summary_answer(result, scores)


def finalize_response_with_live_ai(
    payload: AIExplainerRequest, grounded_response: AIExplainerResponse
) -> AIExplainerResponse:
    if not _hybrid_mode_enabled():
        return grounded_response
    if _ai_provider() == "anthropic":
        return _finalize_with_anthropic(payload, grounded_response)

    api_key = _openai_api_key()
    if not api_key:
        return grounded_response.model_copy(
            update={
                "limitations": grounded_response.limitations
                + ["Live AI mode is enabled, but no OpenAI API key was configured."],
            }
        )

    try:
        llm_response = _call_openai_responses_api(payload, grounded_response, api_key)
    except Exception as error:
        logger.warning(
            "MESA AI fallback: OpenAI request failed for intent=%s model=%s error=%s",
            grounded_response.intent.value,
            os.getenv("MESA_OPENAI_MODEL", "gpt-5.4-mini"),
            error,
        )
        return grounded_response.model_copy(
            update={
                "source": "mesa-grounded-explainer-fallback",
                "limitations": grounded_response.limitations
                + [
                    f"Live AI fallback was used because the OpenAI request failed: {error}"
                ],
            }
        )

    if llm_response is None:
        logger.warning(
            "MESA AI fallback: OpenAI returned no structured response for intent=%s model=%s",
            grounded_response.intent.value,
            os.getenv("MESA_OPENAI_MODEL", "gpt-5.4-mini"),
        )
        return grounded_response.model_copy(
            update={
                "source": "mesa-grounded-explainer-fallback",
                "limitations": grounded_response.limitations
                + [
                    "Live AI fallback was used because no structured OpenAI response was returned."
                ],
            }
        )

    logger.info(
        "MESA AI answered via OpenAI responses API intent=%s model=%s",
        grounded_response.intent.value,
        os.getenv("MESA_OPENAI_MODEL", "gpt-5.4-mini"),
    )
    return llm_response


def stream_answer_text(
    payload: AIExplainerRequest, grounded_response: AIExplainerResponse
) -> tuple[AIExplainerResponse, list[str]]:
    if not _hybrid_mode_enabled():
        logger.info(
            "MESA AI answered via grounded local mode intent=%s",
            grounded_response.intent.value,
        )
        return grounded_response, list(_chunk_text(grounded_response.answer))
    if _ai_provider() == "anthropic":
        return _stream_with_anthropic(payload, grounded_response)

    api_key = _openai_api_key()
    if not api_key:
        fallback = grounded_response.model_copy(
            update={
                "limitations": grounded_response.limitations
                + ["Live AI mode is enabled, but no OpenAI API key was configured."],
            }
        )
        logger.warning(
            "MESA AI fallback: hybrid mode enabled but no API key for intent=%s",
            grounded_response.intent.value,
        )
        return fallback, list(_chunk_text(fallback.answer))

    try:
        streamed_chunks, answer = _stream_openai_answer_text(
            payload, grounded_response, api_key
        )
    except Exception as error:
        fallback = grounded_response.model_copy(
            update={
                "source": "mesa-grounded-explainer-fallback",
                "limitations": grounded_response.limitations
                + [
                    f"Live AI fallback was used because the OpenAI stream failed: {error}"
                ],
            }
        )
        logger.warning(
            "MESA AI fallback: OpenAI stream failed for intent=%s model=%s error=%s",
            grounded_response.intent.value,
            os.getenv("MESA_OPENAI_MODEL", "gpt-5.4-mini"),
            error,
        )
        return fallback, list(_chunk_text(fallback.answer))

    final_response = grounded_response.model_copy(
        update={
            "answer": answer or grounded_response.answer,
            "source": f"openai-hybrid:{os.getenv('MESA_OPENAI_MODEL', 'gpt-5.4-mini')}",
        }
    )
    logger.info(
        "MESA AI answered via OpenAI streaming intent=%s model=%s",
        grounded_response.intent.value,
        os.getenv("MESA_OPENAI_MODEL", "gpt-5.4-mini"),
    )
    return final_response, (
        streamed_chunks if streamed_chunks else list(_chunk_text(final_response.answer))
    )


def _hybrid_mode_enabled() -> bool:
    return os.getenv("MESA_AI_MODE", "grounded").lower() in {"hybrid", "live", "openai"}


def _openai_api_key() -> str | None:
    key = os.getenv("MESA_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
    return key.strip() if key else None


def ai_status(*, probe: bool = True) -> AIExplainerStatus:
    if _hybrid_mode_enabled() and _ai_provider() == "anthropic":
        return _anthropic_status(probe=probe)
    mode = os.getenv("MESA_AI_MODE", "grounded").lower()
    base_url = os.getenv("MESA_OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip(
        "/"
    )
    model = os.getenv("MESA_OPENAI_MODEL", "gpt-5.4-mini")
    live_enabled = _hybrid_mode_enabled()
    api_key = _openai_api_key()

    if not live_enabled:
        return AIExplainerStatus(
            mode=mode,
            state=AIConnectionState.GROUNDED_ONLY,
            live_enabled=False,
            api_key_configured=bool(api_key),
            api_key_hint=_api_key_hint(api_key),
            model=model,
            base_url=base_url,
            message="Hybrid AI is off. MESA is using grounded local explanations only.",
        )

    if not api_key:
        return AIExplainerStatus(
            mode=mode,
            state=AIConnectionState.MISSING_API_KEY,
            live_enabled=True,
            api_key_configured=False,
            api_key_hint=None,
            model=model,
            base_url=base_url,
            message="Hybrid AI is enabled, but no OpenAI API key was configured.",
        )

    if _looks_like_placeholder_key(api_key):
        return AIExplainerStatus(
            mode=mode,
            state=AIConnectionState.PLACEHOLDER_API_KEY,
            live_enabled=True,
            api_key_configured=True,
            api_key_hint=_api_key_hint(api_key),
            model=model,
            base_url=base_url,
            message="The configured API key still looks like a placeholder value.",
        )

    if not probe:
        return AIExplainerStatus(
            mode=mode,
            state=AIConnectionState.READY,
            live_enabled=True,
            api_key_configured=True,
            api_key_hint=_api_key_hint(api_key),
            model=model,
            base_url=base_url,
            message="Hybrid AI appears configured. Probe was skipped.",
        )

    try:
        state, message = _probe_openai_status(api_key, base_url, model)
    except Exception as error:
        state = AIConnectionState.CONNECTION_ERROR
        message = f"Could not reach OpenAI to validate the live AI setup: {error}"

    return AIExplainerStatus(
        mode=mode,
        state=state,
        live_enabled=True,
        api_key_configured=True,
        api_key_hint=_api_key_hint(api_key),
        model=model,
        base_url=base_url,
        message=message,
    )


def _call_openai_responses_api(
    payload: AIExplainerRequest,
    grounded_response: AIExplainerResponse,
    api_key: str,
) -> AIExplainerResponse | None:
    base_url = os.getenv("MESA_OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip(
        "/"
    )
    model = os.getenv("MESA_OPENAI_MODEL", "gpt-5.4-mini")
    timeout_seconds = float(os.getenv("MESA_OPENAI_TIMEOUT_SECONDS", "20"))

    schema = _LIVE_AI_SCHEMA

    prompt = _build_live_ai_prompt(payload, grounded_response)
    body = {
        "model": model,
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You are MESA's architecture explainer. Use only the provided grounding packet. "
                            "Do not invent findings, files, services, metrics, policies, or docs. "
                            "Keep the answer user-friendly and concrete. Preserve uncertainty and limitations."
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": prompt}],
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "mesa_ai_explainer",
                "schema": schema,
                "strict": True,
            }
        },
    }

    request = urllib_request.Request(
        f"{base_url}/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib_request.urlopen(request, timeout=timeout_seconds) as response:
            payload_json = json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {detail[:240]}") from error
    except urllib_error.URLError as error:
        raise RuntimeError(str(error.reason)) from error

    structured_text = _extract_output_text(payload_json)
    if not structured_text:
        return None

    return _apply_live_ai_json(
        json.loads(structured_text), grounded_response, f"openai-hybrid:{model}"
    )


def _apply_live_ai_json(
    parsed: dict, grounded_response: AIExplainerResponse, source: str
) -> AIExplainerResponse:
    return grounded_response.model_copy(
        update={
            "title": parsed["title"],
            "answer": parsed["answer"],
            "suggestions": parsed["suggestions"][:5],
            "follow_up_questions": parsed["follow_up_questions"][:4],
            "limitations": _merge_lists(
                grounded_response.limitations, parsed["limitations"], limit=5
            ),
            "policy_document": parsed.get("policy_document")
            or grounded_response.policy_document,
            "confidence": AIExplainerConfidence(parsed["confidence"]),
            "source": source,
        }
    )


def _probe_openai_status(
    api_key: str, base_url: str, model: str
) -> tuple[AIConnectionState, str]:
    request = urllib_request.Request(
        f"{base_url}/models/{model}",
        headers={"Authorization": f"Bearer {api_key}"},
        method="GET",
    )
    try:
        with urllib_request.urlopen(request, timeout=10) as response:
            if 200 <= response.status < 300:
                return (
                    AIConnectionState.READY,
                    f"Live AI is ready. OpenAI accepted the configured key for model {model}.",
                )
    except urllib_error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        if error.code == 401:
            return (
                AIConnectionState.INVALID_API_KEY,
                "OpenAI rejected the configured API key.",
            )
        if error.code == 403:
            return (
                AIConnectionState.ACCESS_DENIED,
                "OpenAI accepted the request but denied access to this model or account.",
            )
        if error.code == 404:
            return (
                AIConnectionState.MODEL_UNAVAILABLE,
                f"The configured model '{model}' was not available from OpenAI.",
            )
        return (
            AIConnectionState.CONNECTION_ERROR,
            f"OpenAI probe failed with HTTP {error.code}: {detail[:180]}",
        )
    except urllib_error.URLError as error:
        return (
            AIConnectionState.CONNECTION_ERROR,
            f"OpenAI probe failed: {error.reason}",
        )
    return (
        AIConnectionState.CONNECTION_ERROR,
        "OpenAI probe did not return a usable result.",
    )


def _stream_openai_answer_text(
    payload: AIExplainerRequest,
    grounded_response: AIExplainerResponse,
    api_key: str,
) -> tuple[list[str], str]:
    base_url = os.getenv("MESA_OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip(
        "/"
    )
    model = os.getenv("MESA_OPENAI_MODEL", "gpt-5.4-mini")
    timeout_seconds = float(os.getenv("MESA_OPENAI_TIMEOUT_SECONDS", "20"))
    prompt = _build_live_ai_stream_prompt(payload, grounded_response)
    body = {
        "model": model,
        "stream": True,
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You are MESA's architecture explainer. Use only the provided grounding packet. "
                            "Return only a plain-text answer. Do not invent findings or evidence."
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": prompt}],
            },
        ],
    }
    request = urllib_request.Request(
        f"{base_url}/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    chunks: list[str] = []
    full_text_parts: list[str] = []
    try:
        with urllib_request.urlopen(request, timeout=timeout_seconds) as response:
            for raw_line in response:
                line = raw_line.decode("utf-8", errors="replace").strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                if not data:
                    continue
                event = json.loads(data)
                event_type = str(event.get("type", ""))
                if event_type.endswith("delta"):
                    delta = _extract_stream_delta_text(event)
                    if delta:
                        chunks.append(delta)
                        full_text_parts.append(delta)
                elif event_type.endswith("done"):
                    final_text = (
                        _extract_output_text(event.get("response", {}))
                        if isinstance(event.get("response"), dict)
                        else ""
                    )
                    if final_text and not "".join(full_text_parts).strip():
                        full_text_parts.append(final_text)
    except urllib_error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {detail[:240]}") from error
    except urllib_error.URLError as error:
        raise RuntimeError(str(error.reason)) from error
    return chunks, "".join(full_text_parts).strip()


def _build_live_ai_prompt(
    payload: AIExplainerRequest, grounded_response: AIExplainerResponse
) -> str:
    packet = {
        "intent": grounded_response.intent.value,
        "question": payload.question,
        "doc_query": payload.doc_query,
        "grounded_title": grounded_response.title,
        "grounded_answer": grounded_response.answer,
        "evidence": [
            item.model_dump(mode="json") for item in grounded_response.evidence
        ],
        "suggestions": grounded_response.suggestions,
        "follow_up_questions": grounded_response.follow_up_questions,
        "limitations": grounded_response.limitations,
        "confidence": grounded_response.confidence.value,
    }
    return (
        "Rewrite and improve this grounded MESA explanation for clarity while staying strictly within the evidence. "
        "Return only JSON matching the required schema.\n\n"
        f"{json.dumps(packet, indent=2)}"
    )


def _build_live_ai_stream_prompt(
    payload: AIExplainerRequest, grounded_response: AIExplainerResponse
) -> str:
    packet = {
        "intent": grounded_response.intent.value,
        "question": payload.question,
        "title": grounded_response.title,
        "answer": grounded_response.answer,
        "evidence": [
            item.model_dump(mode="json") for item in grounded_response.evidence
        ],
        "limitations": grounded_response.limitations,
    }
    return (
        "Rewrite the grounded MESA answer into a clearer, simpler explanation. "
        "Use only the provided grounding packet. Return plain text only.\n\n"
        f"{json.dumps(packet, indent=2)}"
    )


def _extract_output_text(payload_json: dict[str, object]) -> str:
    output_text = payload_json.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    output = payload_json.get("output")
    if not isinstance(output, list):
        return ""
    for item in output:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            text = block.get("text")
            if isinstance(text, str) and text.strip():
                return text
            if block.get("type") == "output_text":
                nested = block.get("text")
                if isinstance(nested, str) and nested.strip():
                    return nested
    return ""


def _looks_like_placeholder_key(api_key: str) -> bool:
    lowered = api_key.strip().lower()
    return (
        lowered in _PLACEHOLDER_KEY_FRAGMENTS or "your_api" in lowered or "*" in api_key
    )


def _api_key_hint(api_key: str | None) -> str | None:
    if not api_key:
        return None
    trimmed = api_key.strip()
    if len(trimmed) <= 8:
        return trimmed
    return f"{trimmed[:6]}...{trimmed[-4:]}"


def _extract_stream_delta_text(event: dict[str, object]) -> str:
    for key in ("delta", "text"):
        value = event.get(key)
        if isinstance(value, str):
            return value
    item = event.get("item")
    if isinstance(item, dict):
        content = item.get("content")
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    text = block.get("text")
                    if isinstance(text, str):
                        return text
    return ""


def _merge_lists(primary: list[str], secondary: list[str], *, limit: int) -> list[str]:
    merged: list[str] = []
    for item in [*primary, *secondary]:
        if item not in merged:
            merged.append(item)
        if len(merged) >= limit:
            break
    return merged


def _chunk_text(text: str) -> tuple[str, ...]:
    words = text.split()
    if not words:
        return ("",)
    chunks = []
    current = []
    for word in words:
        current.append(word)
        if len(current) >= 5:
            chunks.append(" ".join(current) + " ")
            current = []
    if current:
        chunks.append(" ".join(current) + " ")
    return tuple(chunks)


def _resolve_intent(
    payload: AIExplainerRequest, has_scan: bool, has_comparison: bool
) -> AIExplainerIntent:
    if payload.intent != AIExplainerIntent.AUTO:
        return payload.intent

    question = f"{payload.question} {payload.doc_query or ''}".strip().lower()
    if payload.finding_id:
        return AIExplainerIntent.FINDING_EXPLANATION
    if any(
        token in question
        for token in (
            "write policy",
            "draft policy",
            "create policy",
            "policy draft",
            "generate policy",
            "suggest policy",
        )
    ):
        return AIExplainerIntent.POLICY_WRITING_ASSISTANCE
    if payload.base_scan_id or payload.target_scan_id or has_comparison:
        if any(
            token in question
            for token in (
                "compare",
                "difference",
                "changed",
                "evolution",
                "before",
                "after",
            )
        ):
            return AIExplainerIntent.COMPARE_SCANS
    if any(
        token in question
        for token in (
            "fix first",
            "priority",
            "prioritize",
            "what should i fix",
            "what should solve first",
            "what should i solve first",
            "solve first",
            "should be solved first",
            "urgent",
        )
    ):
        return AIExplainerIntent.PRIORITIZE_FIXES
    if any(
        token in question for token in ("health", "score", "weakest dimension", "grade")
    ):
        return AIExplainerIntent.HEALTH_SCORE_EXPLANATION
    if any(token in question for token in ("policy", "governance", "rule", "yaml")):
        return AIExplainerIntent.GOVERNANCE_POLICY_HELP
    if any(
        token in question
        for token in (
            "doc",
            "guide",
            "how do i",
            "how to",
            "what is mesa",
            "documentation",
        )
    ):
        return AIExplainerIntent.DOC_QA
    return AIExplainerIntent.SCAN_SUMMARY if has_scan else AIExplainerIntent.DOC_QA


def _scan_summary_answer(
    result: AnalysisResult, scores: list[HealthScore]
) -> AIExplainerResponse:
    ordered = _prioritized_findings(result.findings)
    top = ordered[:3]
    system_score = _score_for(scores, "system", "system") or _summary_system_score(
        result
    )
    evidence = [
        AIExplainerEvidence(
            kind="scan",
            label="Scan summary",
            pointer="summary.finding_count",
            snippet=f"{result.summary.get('finding_count', 0)} findings across {result.summary.get('service_count', 0)} services.",
        )
    ]
    if system_score is not None:
        evidence.append(
            AIExplainerEvidence(
                kind="score",
                label="System health",
                pointer="health_scores.system",
                snippet=f"System health is {system_score.score:.1f}/100 ({system_score.grade}).",
            )
        )
    for finding in top:
        evidence.append(_finding_evidence(finding))

    answer_parts = [
        f"MESA found {result.summary.get('finding_count', 0)} architectural risks across {result.summary.get('service_count', 0)} services."
    ]
    if system_score is not None:
        answer_parts.append(
            f"The overall health score is {system_score.score:.1f}/100, graded {system_score.grade.lower()}."
        )
    if top:
        answer_parts.append(
            "The main areas to review first are "
            + ", ".join(_plain_title(finding).lower() for finding in top[:2])
            + "."
        )
    return AIExplainerResponse(
        intent=AIExplainerIntent.SCAN_SUMMARY,
        title="Grounded scan summary",
        answer=" ".join(answer_parts),
        evidence=evidence,
        suggestions=_top_suggestions_from_findings(top),
        follow_up_questions=[
            "What should I fix first?",
            "Explain the most urgent finding.",
            "Why is the health score low?",
        ],
        limitations=[
            "This summary is based on static analysis evidence only.",
            "MESA highlights likely architecture risks, not confirmed runtime incidents.",
        ],
        confidence=(
            AIExplainerConfidence.HIGH if top else AIExplainerConfidence.MODERATE
        ),
    )


def _finding_answer(
    payload: AIExplainerRequest, result: AnalysisResult
) -> AIExplainerResponse:
    finding = _find_finding(result.findings, payload.finding_id)
    if finding is None:
        return AIExplainerResponse(
            intent=AIExplainerIntent.FINDING_EXPLANATION,
            title="Finding not available",
            answer="I could not find the requested finding in the current scan.",
            evidence=[],
            suggestions=["Select a finding from the dashboard and try again."],
            follow_up_questions=["Summarize this scan.", "What should I fix first?"],
            limitations=[
                "The requested finding id was not present in the loaded scan."
            ],
            confidence=AIExplainerConfidence.LOW,
        )

    recommendation = finding.recommendations[0] if finding.recommendations else None
    evidence = [_finding_evidence(finding)]
    evidence.extend(_finding_supporting_evidence(finding))
    if recommendation and recommendation.affected_files:
        evidence.append(
            AIExplainerEvidence(
                kind="file",
                label="Affected files",
                pointer="recommendations[0].affected_files",
                snippet=", ".join(recommendation.affected_files[:3]),
            )
        )

    answer = (
        f"{_plain_title(finding)} affects {', '.join(finding.services)}. "
        f"{_finding_impact_text(finding)} "
        f"MESA flagged it because {_short_evidence_phrase(finding)}."
    )
    return AIExplainerResponse(
        intent=AIExplainerIntent.FINDING_EXPLANATION,
        title=_plain_title(finding),
        answer=answer,
        evidence=evidence,
        suggestions=(
            recommendation.refactoring_steps[:3]
            if recommendation
            else [finding.recommendation]
        ),
        follow_up_questions=[
            "What should I fix first overall?",
            "Why is this severity level important?",
            "Show me related documentation.",
        ],
        limitations=[
            _confidence_limitation(finding.confidence),
            "This finding points to a likely architecture problem, but code and domain review are still important.",
        ],
        confidence=_confidence_bucket(finding.confidence),
    )


def _prioritize_answer(result: AnalysisResult) -> AIExplainerResponse:
    ordered = _prioritized_findings(result.findings)
    top = ordered[:3]
    if not top:
        return AIExplainerResponse(
            intent=AIExplainerIntent.PRIORITIZE_FIXES,
            title="No fixes to prioritize",
            answer="This scan does not contain active findings to prioritize.",
            evidence=[
                AIExplainerEvidence(
                    kind="scan",
                    label="Finding count",
                    pointer="summary.finding_count",
                    snippet="The current scan contains 0 findings.",
                )
            ],
            suggestions=[
                "Run another scan after making changes to confirm the architecture is still clean."
            ],
            follow_up_questions=["Summarize this scan.", "Explain the health score."],
            limitations=["Priority advice is only available when findings exist."],
            confidence=AIExplainerConfidence.HIGH,
        )

    answer = (
        "Start with "
        + "; then ".join(
            f"{_plain_title(finding).lower()} in {', '.join(finding.services)}"
            for finding in top[:2]
        )
        + ". This order is based on severity, confidence, and how many services are affected."
    )
    return AIExplainerResponse(
        intent=AIExplainerIntent.PRIORITIZE_FIXES,
        title="Recommended fix order",
        answer=answer,
        evidence=[_finding_evidence(finding) for finding in top],
        suggestions=_top_suggestions_from_findings(top, limit=4),
        follow_up_questions=[
            "Explain the first finding in more detail.",
            "How does this affect the health score?",
            "Compare this scan with the previous one.",
        ],
        limitations=[
            "Priority ranking is deterministic and evidence-based, but effort and business context still need human review."
        ],
        confidence=AIExplainerConfidence.HIGH,
    )


def _health_answer(
    payload: AIExplainerRequest,
    scores: list[HealthScore],
    result: AnalysisResult,
) -> AIExplainerResponse:
    score = _resolve_score(payload, scores, result)
    if score is None:
        return AIExplainerResponse(
            intent=AIExplainerIntent.HEALTH_SCORE_EXPLANATION,
            title="Health score not available",
            answer="I could not find the requested health score in the current scan.",
            evidence=[],
            suggestions=[
                "Try the system health summary or choose a service score from the results panel."
            ],
            follow_up_questions=["Summarize this scan.", "What should I fix first?"],
            limitations=[
                "The requested score target was not present in the scan summary."
            ],
            confidence=AIExplainerConfidence.LOW,
        )

    weakest = sorted(score.breakdown.items(), key=lambda item: item[1])[:3]
    weak_text = ", ".join(
        f"{_pretty_label(name)} ({value:.0f})" for name, value in weakest
    )
    return AIExplainerResponse(
        intent=AIExplainerIntent.HEALTH_SCORE_EXPLANATION,
        title=f"{_pretty_label(score.scope)} health for {score.target}",
        answer=(
            f"{score.target} is graded {score.grade.lower()} with a score of {score.score:.1f}/100. "
            f"The weakest dimensions are {weak_text}. {score.explanation}"
        ),
        evidence=[
            AIExplainerEvidence(
                kind="score",
                label=f"{score.scope.title()} score",
                pointer=f"health_scores.{score.scope}.{score.target}",
                snippet=f"Score {score.score:.1f}/100, grade {score.grade}.",
            )
        ]
        + [
            AIExplainerEvidence(
                kind="dimension",
                label=_pretty_label(name),
                pointer=f"breakdown.{name}",
                snippet=f"{value:.1f}/100",
            )
            for name, value in weakest
        ],
        suggestions=score.recommendations[:4],
        follow_up_questions=[
            "What should I fix first?",
            "Explain the most urgent finding.",
            "Show related docs for this score.",
        ],
        limitations=[
            "Health scores summarize architecture quality signals; they are not direct performance benchmarks."
        ],
        confidence=AIExplainerConfidence.HIGH,
    )


def _comparison_answer(
    payload: AIExplainerRequest, comparison: EvolutionReport | None
) -> AIExplainerResponse:
    if comparison is None:
        return AIExplainerResponse(
            intent=AIExplainerIntent.COMPARE_SCANS,
            title="Comparison not available",
            answer="I need two scans to compare architecture evolution.",
            evidence=[],
            suggestions=[
                "Run at least two scans for the same project, then try the comparison again."
            ],
            follow_up_questions=["Summarize this scan.", "What should I fix first?"],
            limitations=["No comparison context was available for this request."],
            confidence=AIExplainerConfidence.LOW,
        )

    evidence = [
        AIExplainerEvidence(
            kind="comparison",
            label="Architecture change summary",
            pointer="architecture_change_summary.summary",
            snippet=str(
                comparison.architecture_change_summary.get(
                    "summary", "No change summary available."
                )
            ),
        ),
        AIExplainerEvidence(
            kind="comparison",
            label="Risk delta",
            pointer="risk_trend.delta",
            snippet=f"Risk delta {comparison.risk_trend.get('delta', 0):+}.",
        ),
        AIExplainerEvidence(
            kind="comparison",
            label="System score delta",
            pointer="score_trend.system_delta",
            snippet=f"System score delta {comparison.score_trend.get('system_delta', 0):+}.",
        ),
    ]
    if comparison.new_cycles:
        evidence.append(
            AIExplainerEvidence(
                kind="comparison",
                label="New cycles",
                pointer="new_cycles",
                snippet=f"{len(comparison.new_cycles)} new dependency cycle(s) detected.",
            )
        )

    answer = (
        f"Between scans {comparison.base_scan_id[:8]} and {comparison.target_scan_id[:8]}, "
        f"MESA observed {comparison.risk_trend.get('new_risk_count', 0)} new risks and "
        f"{comparison.risk_trend.get('resolved_risk_count', 0)} resolved risks. "
        f"The system score changed by {comparison.score_trend.get('system_delta', 0):+}."
    )
    return AIExplainerResponse(
        intent=AIExplainerIntent.COMPARE_SCANS,
        title="Architecture evolution summary",
        answer=answer,
        evidence=evidence,
        suggestions=comparison.recommendations[:4],
        follow_up_questions=[
            "Which new risks should I review first?",
            "Why did the health score change?",
            "Summarize the latest scan.",
        ],
        limitations=[
            "Evolution compares persisted scan snapshots. It does not explain business reasons behind the changes."
        ],
        confidence=AIExplainerConfidence.HIGH,
    )


def _governance_answer(
    result: AnalysisResult | None, policies: list[PolicyRecord]
) -> AIExplainerResponse:
    violations = [
        finding
        for finding in (result.findings if result else [])
        if finding.type.value == "GOVERNANCE_POLICY_VIOLATION"
    ]
    if policies:
        answer = f"This project currently has {len(policies)} governance polic{'y' if len(policies) == 1 else 'ies'}."
        if violations:
            answer += f" The latest scan triggered {len(violations)} policy violation finding(s)."
    else:
        answer = "No saved governance policies were found for this project."

    evidence = [
        AIExplainerEvidence(
            kind="policy",
            label=policy.name,
            pointer=policy.id,
            snippet=f"{policy.rule} ({policy.severity.value.lower()})",
        )
        for policy in policies[:4]
    ]
    for finding in violations[:2]:
        evidence.append(_finding_evidence(finding))
    suggestions = [
        "Keep policy names plain and specific so evaluators can understand them quickly.",
        "Start with a small set of high-value rules such as no cycles and no hard-coded service URLs.",
        "Treat policy violations as architecture review signals, not automatic proof of failure.",
    ]
    return AIExplainerResponse(
        intent=AIExplainerIntent.GOVERNANCE_POLICY_HELP,
        title="Governance policy guidance",
        answer=answer,
        evidence=evidence,
        suggestions=suggestions,
        follow_up_questions=[
            "Which policy violation is most urgent?",
            "How do I write better policy rules?",
            "Summarize this scan.",
        ],
        limitations=[
            "Governance checks depend on the rules you configured for the project."
        ],
        confidence=(
            AIExplainerConfidence.HIGH if policies else AIExplainerConfidence.MODERATE
        ),
    )


def _policy_draft_answer(
    result: AnalysisResult | None, policies: list[PolicyRecord]
) -> AIExplainerResponse:
    findings = result.findings if result else []
    draft_lines = ["policies:"]
    seen_ids: set[str] = set()
    suggestions: list[str] = []

    for policy in policies[:5]:
        seen_ids.add(policy.id)
        draft_lines.extend(
            [
                f"  - id: {policy.id}",
                f"    name: {policy.name}",
                f"    rule: {policy.rule}",
                f"    severity: {policy.severity.value.lower()}",
                f"    enabled: {'true' if policy.enabled else 'false'}",
            ]
        )
        if policy.description:
            draft_lines.append(f"    description: {policy.description}")

    for finding in _prioritized_findings(findings)[:4]:
        proposal = _policy_proposal_for_finding(finding)
        if proposal is None or proposal["id"] in seen_ids:
            continue
        seen_ids.add(proposal["id"])
        draft_lines.extend(
            [
                f"  - id: {proposal['id']}",
                f"    name: {proposal['name']}",
                f"    rule: {proposal['rule']}",
                f"    severity: {proposal['severity']}",
                f"    description: {proposal['description']}",
            ]
        )
        suggestions.append(f"Review draft rule: {proposal['name']}")

    if len(draft_lines) == 1:
        draft_lines.extend(
            [
                "  - id: no-cycles",
                "    name: No cyclic dependencies",
                "    rule: dependency_cycle_count == 0",
                "    severity: critical",
                "    description: Prevent direct service dependency cycles.",
            ]
        )
        suggestions.append(
            "Start with one or two high-value policy rules before adding more."
        )

    return AIExplainerResponse(
        intent=AIExplainerIntent.POLICY_WRITING_ASSISTANCE,
        title="Suggested governance policy draft",
        answer=(
            "I generated a governance policy draft from the current project context. "
            "Review the rules before saving them because governance thresholds should match your architecture goals."
        ),
        evidence=[
            AIExplainerEvidence(
                kind="policy",
                label="Existing policies",
                pointer="policies",
                snippet=f"{len(policies)} existing policies loaded.",
            ),
            AIExplainerEvidence(
                kind="scan",
                label="Finding-driven rule suggestions",
                pointer="summary.findings",
                snippet=f"{len(findings)} findings were considered when drafting rules.",
            ),
        ],
        suggestions=suggestions
        or [
            "Validate whether each threshold reflects a real architectural constraint for this project.",
            "Keep rule names short and understandable for evaluators.",
        ],
        follow_up_questions=[
            "Explain these policy suggestions.",
            "Which draft policy should I enable first?",
            "Summarize this scan.",
        ],
        limitations=[
            "Draft policy rules are suggestions and may need project-specific thresholds.",
            "Policy drafts should be reviewed by a human before enforcement.",
        ],
        policy_document="\n".join(draft_lines) + "\n",
        confidence=(
            AIExplainerConfidence.MODERATE if findings else AIExplainerConfidence.LOW
        ),
    )


def _doc_answer(payload: AIExplainerRequest) -> AIExplainerResponse:
    query = (payload.doc_query or payload.question or "MESA overview").strip()
    docs = _search_docs(query)
    if not docs:
        return AIExplainerResponse(
            intent=AIExplainerIntent.DOC_QA,
            title="No matching docs found",
            answer=f"I could not find documentation matching '{query}'.",
            evidence=[],
            suggestions=[
                "Try broader terms such as findings, health score, governance, or public repo scan."
            ],
            follow_up_questions=[
                "How do I run a scan?",
                "How do I read findings?",
                "How does health scoring work?",
            ],
            limitations=[
                "Documentation search only covers markdown files inside this MESA workspace."
            ],
            confidence=AIExplainerConfidence.LOW,
        )

    primary = docs[0]
    answer = f"{primary.title}: {_doc_summary(primary.content)}"
    if len(docs) > 1:
        answer += f" Related reading: {', '.join(doc.title for doc in docs[1:3])}."
    return AIExplainerResponse(
        intent=AIExplainerIntent.DOC_QA,
        title=f"Documentation answer for '{query}'",
        answer=answer,
        evidence=[
            AIExplainerEvidence(
                kind="doc",
                label=doc.title,
                pointer=doc.path,
                snippet=_doc_summary(doc.content),
            )
            for doc in docs[:3]
        ],
        suggestions=[f"Open {doc.path}" for doc in docs[:3]],
        follow_up_questions=[
            "Show me the evaluator quick start.",
            "How do I scan a public repository?",
            "Explain the findings guide.",
        ],
        limitations=[
            "This answer summarizes local MESA documentation and may omit details from longer pages."
        ],
        confidence=AIExplainerConfidence.HIGH,
    )


def _missing_scan_response(
    intent: AIExplainerIntent, question: str
) -> AIExplainerResponse:
    docs = _search_docs(question or "user guide")
    evidence = [
        AIExplainerEvidence(
            kind="doc",
            label=doc.title,
            pointer=doc.path,
            snippet=_doc_summary(doc.content),
        )
        for doc in docs[:2]
    ]
    return AIExplainerResponse(
        intent=intent,
        title="Scan context required",
        answer="I need a completed scan to answer that grounded question correctly.",
        evidence=evidence,
        suggestions=[
            "Run or load a scan first, then ask for a summary, fix priority, or health explanation.",
            "Use the documentation tab if you want setup guidance before scanning.",
        ],
        follow_up_questions=[
            "How do I run a scan?",
            "How do I scan a public repository?",
        ],
        limitations=["No persisted scan result was attached to this request."],
        confidence=AIExplainerConfidence.LOW,
    )


def _find_finding(findings: list[Finding], finding_id: str | None) -> Finding | None:
    if finding_id:
        for finding in findings:
            if finding.id == finding_id:
                return finding
    return _prioritized_findings(findings)[0] if findings else None


def _prioritized_findings(findings: list[Finding]) -> list[Finding]:
    return sorted(
        findings,
        key=lambda finding: (
            _SEVERITY_WEIGHT[finding.severity],
            round(finding.confidence * 100),
            len(finding.services),
        ),
        reverse=True,
    )


def _resolve_score(
    payload: AIExplainerRequest, scores: list[HealthScore], result: AnalysisResult
) -> HealthScore | None:
    if scores:
        if payload.score_target:
            for score in scores:
                if (
                    score.target == payload.score_target
                    or f"{score.scope}:{score.target}" == payload.score_target
                ):
                    return score
        if payload.service_name:
            return _score_for(scores, "service", payload.service_name)
        return _score_for(scores, "system", "system") or (scores[0] if scores else None)
    system = _summary_system_score(result)
    if payload.score_target in (None, "", "system"):
        return system
    return None


def _score_for(
    scores: list[HealthScore], scope: str, target: str
) -> HealthScore | None:
    for score in scores:
        if score.scope == scope and score.target == target:
            return score
    return None


def _summary_system_score(result: AnalysisResult) -> HealthScore | None:
    data = result.summary.get("health_scores", {}).get("system")
    return HealthScore.model_validate(data) if data else None


def _finding_evidence(finding: Finding) -> AIExplainerEvidence:
    return AIExplainerEvidence(
        kind="finding",
        label=_plain_title(finding),
        pointer=finding.id,
        snippet=(
            f"{finding.severity.value} severity, {finding.confidence:.0%} confidence, "
            f"services: {', '.join(finding.services)}."
        ),
    )


def _finding_supporting_evidence(finding: Finding) -> list[AIExplainerEvidence]:
    references: list[AIExplainerEvidence] = []
    for index, item in enumerate(finding.evidence[:3], start=1):
        snippet = _compact_evidence_item(item)
        if not snippet:
            continue
        references.append(
            AIExplainerEvidence(
                kind="evidence",
                label=f"Detector evidence {index}",
                pointer=f"{finding.id}.evidence[{index - 1}]",
                snippet=snippet,
            )
        )
    return references


def _compact_evidence_item(item: object) -> str:
    if not isinstance(item, dict):
        return ""
    values = []
    for key, value in item.items():
        if isinstance(value, (str, int, float, bool)):
            values.append(f"{_pretty_label(key)}: {value}")
        elif isinstance(value, dict):
            nested_bits = []
            for nested_key, nested_value in value.items():
                if isinstance(nested_value, (str, int, float, bool)):
                    nested_bits.append(f"{_pretty_label(nested_key)}: {nested_value}")
                if len(nested_bits) == 2:
                    break
            if nested_bits:
                values.append(f"{_pretty_label(key)} -> " + ", ".join(nested_bits))
        if len(values) == 3:
            break
    return " | ".join(values)


def _plain_title(finding: Finding) -> str:
    mapping = {
        "GOD_SERVICE": "An overloaded service boundary",
        "CHATTY_SERVICE": "A chatty service interaction",
        "SHARED_DATABASE": "A shared database ownership risk",
        "HARD_CODED_SERVICE_DEPENDENCY": "A hard-coded service dependency",
        "CYCLIC_DEPENDENCY": "A dependency cycle",
        "GOVERNANCE_POLICY_VIOLATION": "A governance policy violation",
    }
    return mapping.get(finding.type.value, finding.type.value.replace("_", " ").title())


def _finding_impact_text(finding: Finding) -> str:
    if "GOD" in finding.type.value:
        return "It suggests one service may be carrying too many responsibilities, making change harder and riskier."
    if "CHATTY" in finding.type.value:
        return "It suggests this workflow may rely on too many synchronous cross-service calls."
    if "SHARED" in finding.type.value or "DATABASE" in finding.type.value:
        return "It suggests service boundaries around data ownership may be weak."
    if "HARD_CODED" in finding.type.value:
        return "It suggests deployments may be fragile because endpoints are embedded directly in code or config."
    if "CYCLIC" in finding.type.value:
        return "It suggests deployment and change independence may be reduced by a dependency loop."
    return "It suggests an architecture risk worth reviewing."


def _short_evidence_phrase(finding: Finding) -> str:
    sample = _compact_evidence_item(finding.evidence[0]) if finding.evidence else ""
    return (
        sample.lower()
        if sample
        else "the detector found supporting static evidence in the scanned files"
    )


def _top_suggestions_from_findings(
    findings: list[Finding], limit: int = 3
) -> list[str]:
    suggestions: list[str] = []
    for finding in findings:
        if finding.recommendations:
            for step in finding.recommendations[0].refactoring_steps:
                if step not in suggestions:
                    suggestions.append(step)
                if len(suggestions) >= limit:
                    return suggestions
        elif finding.recommendation not in suggestions:
            suggestions.append(finding.recommendation)
        if len(suggestions) >= limit:
            return suggestions
    return suggestions


def _policy_proposal_for_finding(finding: Finding) -> dict[str, str] | None:
    if finding.type.value == "CYCLIC_DEPENDENCY":
        return {
            "id": "no-cycles",
            "name": "No cyclic dependencies",
            "rule": "dependency_cycle_count == 0",
            "severity": "critical",
            "description": "Prevent direct service dependency cycles.",
        }
    if finding.type.value == "HARD_CODED_SERVICE_DEPENDENCY":
        return {
            "id": "no-hardcoded-service-urls",
            "name": "No hard-coded service URLs",
            "rule": "hard_coded_service_url_count == 0",
            "severity": "high",
            "description": "Keep service endpoint resolution outside source code.",
        }
    if finding.type.value == "SHARED_DATABASE":
        return {
            "id": "no-shared-database-ownership",
            "name": "No shared database ownership",
            "rule": "shared_database_count == 0",
            "severity": "high",
            "description": "Require one clear owner per database boundary.",
        }
    if finding.type.value == "CHATTY_SERVICE":
        return {
            "id": "limit-chatty-interactions",
            "name": "Limit chatty service interactions",
            "rule": "chatty_service_finding_count == 0",
            "severity": "medium",
            "description": "Reduce repeated synchronous cross-service call patterns.",
        }
    return None


def _confidence_bucket(confidence: float) -> AIExplainerConfidence:
    if confidence >= 0.8:
        return AIExplainerConfidence.HIGH
    if confidence >= 0.55:
        return AIExplainerConfidence.MODERATE
    return AIExplainerConfidence.LOW


def _confidence_limitation(confidence: float) -> str:
    if confidence >= 0.8:
        return "The detector signal is strong, but architecture decisions should still be validated with code and domain review."
    if confidence >= 0.55:
        return "The detector signal is moderate, so review the evidence before planning refactoring work."
    return "The detector signal is limited, so treat this as an early warning rather than a confirmed architecture issue."


def _pretty_label(value: str) -> str:
    return value.replace("_", " ").strip().title()


@lru_cache(maxsize=1)
def _load_docs() -> tuple[_DocPage, ...]:
    docs_root = Path(__file__).resolve().parents[3] / "docs"
    pages = []
    for path in sorted(docs_root.rglob("*.md")):
        content = path.read_text(encoding="utf-8")
        title = _extract_doc_title(content, path.stem)
        pages.append(
            _DocPage(
                path=str(path.relative_to(docs_root.parent)).replace("\\", "/"),
                title=title,
                category=path.parent.name.replace("_", " ").title(),
                content=content,
            )
        )
    return tuple(pages)


def _extract_doc_title(content: str, fallback: str) -> str:
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return fallback.replace("_", " ").title()


def _search_docs(query: str, limit: int = 3) -> list[_DocPage]:
    tokens = [token for token in re.findall(r"[a-z0-9]+", query.lower()) if token]
    scored: list[tuple[int, _DocPage]] = []
    for doc in _load_docs():
        haystack = f"{doc.title} {doc.path} {doc.content[:4000]}".lower()
        score = sum(haystack.count(token) for token in tokens) if tokens else 1
        if score > 0:
            scored.append((score, doc))
    scored.sort(key=lambda item: (-item[0], item[1].title))
    return [doc for _, doc in scored[:limit]]


def _doc_summary(content: str) -> str:
    cleaned = re.sub(r"```.*?```", " ", content, flags=re.DOTALL)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    cleaned = re.sub(r"^#+\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\s*[-*]\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned:
        return "No summary available."
    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    return " ".join(sentences[:2])[:320].strip()


# --- Anthropic (Claude) provider ------------------------------------------
# Selected with MESA_AI_PROVIDER=anthropic. Same grounding packet, schema and
# fallback behaviour as the OpenAI path: any failure or refusal returns the
# grounded answer, so the explainer never blocks on the live model.

_ANTHROPIC_SYSTEM_STRUCTURED = (
    "You are MESA's architecture explainer. Use only the provided grounding packet. "
    "Do not invent findings, files, services, metrics, policies, or docs. "
    "Keep the answer user-friendly and concrete. Preserve uncertainty and limitations."
)
_ANTHROPIC_SYSTEM_STREAM = (
    "You are MESA's architecture explainer. Use only the provided grounding packet. "
    "Return only a plain-text answer. Do not invent findings or evidence."
)


def _ai_provider() -> str:
    return os.getenv("MESA_AI_PROVIDER", "openai").strip().lower()


def _anthropic_api_key() -> str | None:
    key = os.getenv("MESA_ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
    return key.strip() if key else None


def _anthropic_model() -> str:
    return os.getenv("MESA_ANTHROPIC_EXPLAINER_MODEL", "claude-opus-5-5")


def _anthropic_client(api_key: str):
    import anthropic

    timeout_seconds = float(os.getenv("MESA_ANTHROPIC_TIMEOUT_SECONDS", "60"))
    return anthropic.Anthropic(api_key=api_key, timeout=timeout_seconds, max_retries=1)


def _anthropic_request(prompt: str, system: str) -> dict:
    return {
        "model": _anthropic_model(),
        "max_tokens": 8000,
        # Low effort keeps live explanations fast and cheap; the task is a rewrite
        # of evidence MESA already found, not open-ended reasoning.
        "output_config": {"effort": os.getenv("MESA_ANTHROPIC_EFFORT", "low")},
        "system": system,
        "messages": [{"role": "user", "content": prompt}],
    }


def _anthropic_fallback(
    grounded_response: AIExplainerResponse, reason: str
) -> AIExplainerResponse:
    logger.warning(
        "MESA AI fallback: Claude request failed for intent=%s model=%s error=%s",
        grounded_response.intent.value,
        _anthropic_model(),
        reason,
    )
    return grounded_response.model_copy(
        update={
            "source": "mesa-grounded-explainer-fallback",
            "limitations": grounded_response.limitations
            + [f"Live AI fallback was used because the Claude request failed: {reason}"],
        }
    )


def _missing_anthropic_key(grounded_response: AIExplainerResponse) -> AIExplainerResponse:
    return grounded_response.model_copy(
        update={
            "limitations": grounded_response.limitations
            + ["Live AI mode is enabled, but no Anthropic API key was configured."],
        }
    )


def _finalize_with_anthropic(
    payload: AIExplainerRequest, grounded_response: AIExplainerResponse
) -> AIExplainerResponse:
    api_key = _anthropic_api_key()
    if not api_key:
        return _missing_anthropic_key(grounded_response)
    try:
        request = _anthropic_request(
            _build_live_ai_prompt(payload, grounded_response), _ANTHROPIC_SYSTEM_STRUCTURED
        )
        request["output_config"]["format"] = {"type": "json_schema", "schema": _LIVE_AI_SCHEMA}
        response = _anthropic_client(api_key).messages.create(**request)
        if response.stop_reason == "refusal":
            return _anthropic_fallback(grounded_response, "Claude declined the request")
        text = next((block.text for block in response.content if block.type == "text"), "")
        if not text:
            return _anthropic_fallback(grounded_response, "no structured response")
        result = _apply_live_ai_json(
            json.loads(text), grounded_response, f"anthropic-hybrid:{_anthropic_model()}"
        )
    except Exception as error:
        return _anthropic_fallback(grounded_response, str(error)[:240])
    logger.info(
        "MESA AI answered via Claude intent=%s model=%s",
        grounded_response.intent.value,
        _anthropic_model(),
    )
    return result


def _stream_with_anthropic(
    payload: AIExplainerRequest, grounded_response: AIExplainerResponse
) -> tuple[AIExplainerResponse, list[str]]:
    api_key = _anthropic_api_key()
    if not api_key:
        fallback = _missing_anthropic_key(grounded_response)
        return fallback, list(_chunk_text(fallback.answer))
    chunks: list[str] = []
    try:
        request = _anthropic_request(
            _build_live_ai_stream_prompt(payload, grounded_response), _ANTHROPIC_SYSTEM_STREAM
        )
        with _anthropic_client(api_key).messages.stream(**request) as stream:
            for text in stream.text_stream:
                chunks.append(text)
            final_message = stream.get_final_message()
        if final_message.stop_reason == "refusal":
            raise RuntimeError("Claude declined the request")
    except Exception as error:
        fallback = _anthropic_fallback(grounded_response, str(error)[:240])
        return fallback, list(_chunk_text(fallback.answer))
    answer = "".join(chunks).strip()
    final_response = grounded_response.model_copy(
        update={
            "answer": answer or grounded_response.answer,
            "source": f"anthropic-hybrid:{_anthropic_model()}",
        }
    )
    logger.info(
        "MESA AI answered via Claude streaming intent=%s model=%s",
        grounded_response.intent.value,
        _anthropic_model(),
    )
    return final_response, (chunks or list(_chunk_text(final_response.answer)))


def _anthropic_status(*, probe: bool) -> AIExplainerStatus:
    mode = os.getenv("MESA_AI_MODE", "grounded").lower()
    model = _anthropic_model()
    api_key = _anthropic_api_key()
    base = {
        "mode": mode,
        "live_enabled": True,
        "api_key_configured": bool(api_key),
        "api_key_hint": _api_key_hint(api_key),
        "model": model,
        "base_url": "https://api.anthropic.com",
    }
    if not api_key:
        return AIExplainerStatus(
            **base,
            state=AIConnectionState.MISSING_API_KEY,
            message="Hybrid AI is enabled with Claude, but no Anthropic API key was configured.",
        )
    if not probe:
        return AIExplainerStatus(
            **base,
            state=AIConnectionState.READY,
            message="Hybrid AI (Claude) appears configured. Probe was skipped.",
        )
    import anthropic

    try:
        _anthropic_client(api_key).models.retrieve(model)
        state, message = (
            AIConnectionState.READY,
            f"Live AI is ready. Anthropic accepted the configured key for model {model}.",
        )
    except anthropic.AuthenticationError:
        state, message = AIConnectionState.INVALID_API_KEY, "Anthropic rejected the configured API key."
    except anthropic.PermissionDeniedError:
        state, message = AIConnectionState.ACCESS_DENIED, "Anthropic denied access to this model or account."
    except anthropic.NotFoundError:
        state, message = (
            AIConnectionState.MODEL_UNAVAILABLE,
            f"The configured model '{model}' was not available from Anthropic.",
        )
    except anthropic.APIStatusError as error:
        state, message = AIConnectionState.CONNECTION_ERROR, f"Anthropic probe failed with HTTP {error.status_code}."
    except anthropic.APIConnectionError as error:
        state, message = AIConnectionState.CONNECTION_ERROR, f"Could not reach Anthropic: {error}"
    return AIExplainerStatus(**base, state=state, message=message)
