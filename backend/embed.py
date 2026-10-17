import re, zlib, numpy as np
import config as C, cache, llm

STOP = set("with that this from your their using uses based system project application which projects platform "
           "about into have will more make users user data app web for and the".split())

def local(t, dim=1024):  # offline hashing embedding: keeps the app alive without Gemini
    v = np.zeros(dim)
    for w in re.findall(r"[a-z]{3,}", t.lower()):
        if w not in STOP: v[zlib.crc32(w.encode()) % dim] += 1
    return v

def _gemini(cl, texts, with_task):
    from google.genai import types
    kw = {"config": types.EmbedContentConfig(task_type="SEMANTIC_SIMILARITY")} if with_task else {}
    vecs = []
    for i in range(0, len(texts), 90):
        r = cl.models.embed_content(model=C.EMBED_MODEL, contents=texts[i:i+90], **kw)
        vecs += [e.values for e in r.embeddings]
    return vecs

def embed(texts):
    """-> (matrix, mode) where mode is 'gemini' or 'local'."""
    k = cache.key("emb", C.EMBED_MODEL, texts)
    if (c := cache.get(k)): return np.array(c), "gemini"
    cl = llm.client()
    if cl:
        for with_task in (True, False):   # some embedding models reject task_type: retry without it
            try:
                vecs = _gemini(cl, texts, with_task); cache.put(k, vecs); return np.array(vecs), "gemini"
            except Exception as e: print(f"EMBED error (task_type={with_task})", str(e)[:120])
    return np.array([local(t) for t in texts]), "local"
