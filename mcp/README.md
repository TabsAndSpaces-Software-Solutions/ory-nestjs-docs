# ory-nestjs-docs MCP server

Model Context Protocol (MCP) server that exposes the [ory-nestjs](https://www.npmjs.com/package/ory-nestjs) documentation (sourced from this repo's `docs/` directory, hosted at https://ory-nestjs-docs.vercel.app/) to AI coding tools.

Consumers of the `ory-nestjs` library can point Claude Code, Claude Desktop, Cursor, Windsurf, Zed, or VS Code (Continue/Cline) at this server to get accurate, version-aligned answers about module registration, guards, decorators, multi-tenancy, testing, and more.

## Tools

| Tool | Input | Output |
|---|---|---|
| `list_docs` | — | Newline-separated list of every `.md` path under `docs/`. |
| `read_doc` | `{ filePath: string }` (relative to `docs/`, e.g. `usage/quick-start.md`) | The file's full Markdown content. |
| `search_docs` | `{ query: string }` | Paths of docs whose body contains the (case-insensitive) query. |

## Install

```bash
git clone https://github.com/TabsAndSpaces-Software-Solutions/ory-nestjs-docs.git
cd ory-nestjs-docs/mcp
npm install
```

Requirements: Node.js 18+.

## Connect from an AI tool

The server is stdio-only. Every client takes the same server definition — only the config file location differs.

```json title="Standard entry"
{
  "mcpServers": {
    "ory-nestjs-docs": {
      "command": "node",
      "args": ["/absolute/path/to/ory-nestjs-docs/mcp/index.js"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add ory-nestjs-docs node /absolute/path/to/ory-nestjs-docs/mcp/index.js
```

Or commit a `.mcp.json` containing the standard entry at a project root to share across contributors.

### Claude Desktop

Paste the standard entry into:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

### Cursor

- UI: **Settings → MCP → + Add New MCP Server**. Name `ory-nestjs-docs`, Type `stdio`, Command `node /absolute/path/to/ory-nestjs-docs/mcp/index.js`.
- File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project).

### Windsurf

`~/.codeium/windsurf/mcp_config.json` — standard entry.

### VS Code (Continue / Cline)

- Continue: Command Palette → *Continue: Open config.json* → add the standard entry.
- Cline: Cline panel → Settings icon → *Edit MCP settings* → add the standard entry.

### Zed

`~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "ory-nestjs-docs": {
      "command": {
        "path": "node",
        "args": ["/absolute/path/to/ory-nestjs-docs/mcp/index.js"]
      }
    }
  }
}
```

## Windows paths

Escape backslashes in JSON:

```json
"args": ["C:\\Users\\you\\dev\\ory-nestjs-docs\\mcp\\index.js"]
```

## Updating

```bash
cd ory-nestjs-docs && git pull
cd mcp && npm install   # only if deps changed
```

Restart the MCP server in your client to pick up new docs.

## Troubleshooting

- **Server not detected**: absolute paths only; some clients don't inherit shell PATH, so use the full `node` binary path if `command: "node"` fails.
- **Logs**:
  - Claude Desktop — macOS `~/Library/Logs/Claude/mcp.log`, Windows `%APPDATA%\Claude\logs\mcp.log`
  - Claude Code — `claude mcp logs ory-nestjs-docs`
  - Cursor — *Output* panel → **MCP Logs**
