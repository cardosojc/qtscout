import json
from collections.abc import AsyncIterator
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.deps import CurrentUser

router = APIRouter(prefix="/ai", tags=["ai"])

settings = get_settings()

_MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"

PROMPTS = {
    "polish": (
        "És um assistente que melhora atas de reuniões de uma organização de escuteiros "
        "portuguesa.\nReescreve o seguinte texto para corrigir a gramática, melhorar a clareza "
        "e torná-lo mais profissional.\nMantém o mesmo idioma (Português de Portugal), preserva "
        "toda a informação e devolve apenas HTML válido,\nusando as mesmas tags do input "
        "(p, strong, em, ul, ol, li, h1, h2, h3, blockquote).\nNão incluas explicações, markdown "
        "ou blocos de código — devolve apenas o HTML."
    ),
    "formal": (
        "És um assistente que melhora atas de reuniões de uma organização de escuteiros "
        "portuguesa.\nReescreve o seguinte texto para o tornar mais conciso e formal, adequado "
        "para atas oficiais.\nMantém o mesmo idioma (Português de Portugal), preserva a informação "
        "essencial e devolve apenas HTML válido,\nusando as mesmas tags do input "
        "(p, strong, em, ul, ol, li, h1, h2, h3, blockquote).\nNão incluas explicações, markdown "
        "ou blocos de código — devolve apenas o HTML."
    ),
}


@router.post("/rewrite")
async def rewrite(user: CurrentUser, body: Annotated[dict[str, Any], Body()]) -> StreamingResponse:
    content = body.get("content")
    mode = body.get("mode")
    if not content or not isinstance(content, str):
        raise HTTPException(status_code=400, detail="Missing content")
    if mode not in ("polish", "formal"):
        raise HTTPException(status_code=400, detail="Invalid mode")

    prompt = f"{PROMPTS[mode]}\n\nTexto:\n{content}"

    async def stream() -> AsyncIterator[str]:
        payload = {
            "model": "mistral-small-latest",
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
        }
        headers = {
            "Authorization": f"Bearer {settings.mistral_api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", _MISTRAL_URL, headers=headers, json=payload) as resp:
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[len("data:") :].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except ValueError:
                        continue
                    delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content")
                    if delta:
                        yield delta

    return StreamingResponse(stream(), media_type="text/plain; charset=utf-8")
