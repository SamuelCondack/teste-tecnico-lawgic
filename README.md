# Mini-LIA

API Node.js + MongoDB que recebe um PDF judicial, pede os campos da empresa à IA (LIA Mock), limpa a resposta, aplica regras de exibição e grava o formulário. Inclui uma tela React em tema escuro para conferir o fluxo.

O enunciado original está em [`ENUNCIADO.md`](./ENUNCIADO.md).

## Como rodar

### Com Docker (entrega)

```bash
docker compose up --build
```

Sobe MongoDB, LIA Mock e a API na porta **3000**, com o seed automático. A interface fica no mesmo endereço: [http://localhost:3000](http://localhost:3000).

```bash
# listar campos
curl http://localhost:3000/companies/acme-edu/fields

# extrair o PDF curto
curl -X POST http://localhost:3000/companies/acme-edu/extractions \
  -F "file=@data/documents/processo-curto.pdf"

# extrair o PDF longo (RAG)
curl -X POST http://localhost:3000/companies/rodovia-sul/extractions \
  -F "file=@data/documents/processo-longo.pdf"
```

### Sem Docker

Na raiz, depois de `npm install` (e `cd web && npm install && npm run build`):

```bash
npm run dev:local
```

Sobe o LIA Mock, um Mongo em memória, o seed e a API em [http://localhost:3000](http://localhost:3000). Os dados somem ao encerrar o processo.

Se preferir um MongoDB instalado:

1. Suba o LIA Mock (`cd lia-mock && node src/server.js`) e o Mongo em `mongodb://localhost:27017/mini-lia`.
2. Copie `.env.example` para `.env`.
3. `npm run seed && npm start`.
4. Front em desenvolvimento: `cd web && npm run dev` (proxy para a API).

Variáveis: `MONGO_URI`, `LIA_BASE_URL`, `PORT` (padrão 3000).

## Endpoints

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/companies` | Lista empresas (usado pela tela) |
| `GET` | `/companies/:companyKey/fields` | Campos ordenados por `order`. `404` se a empresa não existir |
| `POST` | `/companies/:companyKey/extractions` | PDF em `multipart/form-data` no campo `file`. `201` |
| `GET` | `/extractions/:id` | Extração gravada. `404` se não existir |
| `GET` | `/health` | Saúde da API |

Erros do `POST`: `400` sem arquivo ou arquivo que não é PDF; `404` empresa inexistente; `502` se a IA falhar (incluindo timeout, 413 e mock fora do ar).

## Decisões

**Organização.** Rotas só HTTP; regras em `src/services`; Mongo em `src/models`; LIA Mock isolado em `liaClient`. Nada no código depende de `acme-edu` ou `rodovia-sul`: uma terceira empresa em `data/` entra só com seed.

**Seed.** `npm run seed` faz upsert pela chave natural (`key` da empresa; `companyKey + key` do campo). Rodar de novo atualiza labels/opções e não duplica. As frases de `queries.json` ficam embutidas na empresa — não precisei de uma coleção extra.

**PDF ≤ 5 páginas.** Texto inteiro vai no prompt (`strategy: fullContent`, `usedChunks: 0`).

**PDF > 5 páginas (RAG).** Chunks de 800 caracteres com overlap de 160; embeddings no mock; similaridade de cosseno (norma zero vira 0); **topK = 2 por frase** de busca; trechos sem repetir, recolocados na ordem do documento; se ainda assim o prompt passar de 15.500 caracteres, caem os de menor nota. `queries.json` não traz `topK`, então 2 foi a escolha: cobre as evidências do PDF longo sem estourar o limite de 16.000 do mock.

**Pós-processamento.** JSON no meio do texto ou em ` ```json `; chaves desconhecidas descartadas; `INDEFINIDO` / `NÃO SE APLICA` / `N/A` / vazio → `null`; datas `DD/MM/AAAA` ou `AAAA-MM-DD` gravadas em ISO, inválidas → `null`; select casa `value` **ou** `label` sem acento e sem caixa, sem chute por semelhança.

**Regras `attached`.** Campo visível só se **todas** as condições valem. `formData` tem só os visíveis; `missingRequired` só os `required` visíveis e vazios.

**Front.** Bônus: React em tema escuro fixo, no mesmo compose. A tela aplica as regras de exibição ao vivo (mudar um select mostra/esconde campos). Extra: `GET /companies` para popular o seletor.

**O que não fiz de propósito.** Não gravei `createdAt` na resposta (o contrato não pede). Id inválido de extração responde `404`, não `400`.

## Com mais tempo

- Testes de regressão contra mais PDFs da correção, com `MOCK_DEBUG` no CI.
- Ajuste fino de chunk/topK por tamanho de prompt, em vez de constantes.
- Histórico de extrações na API e na tela.
- Confiança por campo (trecho que comprovou o valor).

## Testes locais

```bash
npm run test:unit
npm run test:e2e
npm run test:delivery
```

O e2e confere os dois PDFs. O `test:delivery` replica o boot da entrega: `node src/seed.js && node src/index.js` em processos separados, como o `docker compose up`.

No GitHub Actions, o mesmo `docker compose up --build` sobe o stack e confere o contrato HTTP.
