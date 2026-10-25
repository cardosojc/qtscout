from typing import Annotated, Any

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import PlainTextResponse

from app.deps import CurrentUser
from app.runtime import binding, to_js_obj

router = APIRouter(prefix="/ai", tags=["ai"])

# Workers AI (the Worker's `AI` binding).
_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct"
# Long minutes come back as long HTML; the model's default cap would truncate.
_MAX_TOKENS = 4096

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


@router.post("/rewrite", response_class=PlainTextResponse)
async def rewrite(user: CurrentUser, body: Annotated[dict[str, Any], Body()]) -> str:
    content = body.get("content")
    mode = body.get("mode")
    if not content or not isinstance(content, str):
        raise HTTPException(status_code=400, detail="Missing content")
    if mode not in ("polish", "formal"):
        raise HTTPException(status_code=400, detail="Invalid mode")

    ai = binding("AI")
    if ai is None:
        raise HTTPException(status_code=503, detail="IA indisponível neste ambiente")

    prompt = f"{PROMPTS[mode]}\n\nTexto:\n{content}"
    result = await ai.run(
        _MODEL,
        to_js_obj({"messages": [{"role": "user", "content": prompt}], "max_tokens": _MAX_TOKENS}),
    )
    text = getattr(result, "response", None)
    if not isinstance(text, str):
        raise HTTPException(status_code=502, detail="Resposta inválida do modelo")
    return text
