# ory-nestjs-docs MCP server — local/dev

**For end users**: use the remote server at `https://ory-nestjs-docs.vercel.app/mcp` — see [docs/mcp-server.md](../docs/mcp-server.md). No clone needed.

This directory contains the local stdio implementation kept for contributors who want to run/extend the MCP server while iterating on the docs. The production (remote) equivalent lives at [`../api/mcp.js`](../api/mcp.js) and is deployed as a Vercel serverless function behind the URL above.

## Local dev

```bash
git clone https://github.com/TabsAndSpaces-Software-Solutions/ory-nestjs-docs.git
cd ory-nestjs-docs/mcp
npm install
```

Requirements: Node.js 18+.

## Wiring into an AI tool (local stdio)

Claude Code:

```bash
claude mcp add ory-nestjs-docs-local node /absolute/path/to/ory-nestjs-docs/mcp/index.js
```

Claude Desktop / Cursor / VS Code / etc. — standard stdio entry:

```json
{
  "mcpServers": {
    "ory-nestjs-docs-local": {
      "command": "node",
      "args": ["/absolute/path/to/ory-nestjs-docs/mcp/index.js"]
    }
  }
}
```

On Windows, escape backslashes: `"C:\\Users\\you\\dev\\ory-nestjs-docs\\mcp\\index.js"`.

## Tools

| Tool | Input | Output |
|---|---|---|
| `list_docs` | — | Newline-separated list of every `.md` under `docs/`. |
| `read_doc` | `{ filePath: string }` — relative to `docs/` | Full Markdown content. |
| `search_docs` | `{ query: string }` | Paths whose body contains the (case-insensitive) query. |

## Implementation parity

`mcp/index.js` (stdio, local) and `api/mcp.js` (Streamable HTTP, Vercel) expose the same three tools with identical semantics. When you change one, mirror the change in the other.
