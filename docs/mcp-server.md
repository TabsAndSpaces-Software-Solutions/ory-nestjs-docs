# AI & MCP Server

`ory-nestjs` ships a **Model Context Protocol (MCP)** server that exposes this documentation site to AI coding tools (Claude Code, Claude Desktop, Cursor, Windsurf, Zed, VS Code + Continue, and any other MCP-compatible client).

Once connected, your AI agent can answer questions like *"How do I configure multi-tenancy?"* or *"What's the contract of `@RequireRole`?"* using the real library documentation instead of stale training data.

Docs site: https://ory-nestjs-docs.vercel.app/
Docs repository: https://github.com/TabsAndSpaces-Software-Solutions/ory-nestjs-docs

## Available tools

The MCP server (name: `ory-nestjs-docs`) provides three tools:

| Tool | Purpose |
|---|---|
| `list_docs` | List every documentation page. |
| `read_doc` | Fetch the full Markdown of a page (`filePath` relative to `docs/`, e.g. `usage/quick-start.md`). |
| `search_docs` | Keyword search across every page; returns matching file paths. |

## Setup

The server runs locally over stdio — clone the docs repo once and point your AI tool at `mcp/index.js`.

```bash
git clone https://github.com/TabsAndSpaces-Software-Solutions/ory-nestjs-docs.git
cd ory-nestjs-docs/mcp
npm install
```

Note the **absolute path** to `mcp/index.js` — every client configuration below needs it. For example, if you cloned into `~/dev`, the path is `/Users/<you>/dev/ory-nestjs-docs/mcp/index.js`.

Requirements: Node.js 18+.

## Client configuration

All MCP-compatible clients accept the same server definition. Only the location of the config file differs.

```json title="Standard MCP server entry"
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

Fastest — one command (user scope):

```bash
claude mcp add ory-nestjs-docs node /absolute/path/to/ory-nestjs-docs/mcp/index.js
```

To share the config with everyone on a repo, commit a `.mcp.json` at the project root with the standard entry above — Claude Code picks it up automatically and prompts each user to approve it on first use.

Confirm with `claude mcp list`.

### Claude Desktop

Edit the config file (create it if missing), paste the standard entry, and restart Claude Desktop.

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### Cursor

Either:
- **UI**: Settings → MCP → **+ Add New MCP Server**, then set Name `ory-nestjs-docs`, Type `stdio`, Command `node /absolute/path/to/ory-nestjs-docs/mcp/index.js`.
- **File**: put the standard entry in `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` at your project root (per-project).

### Windsurf

Add the standard entry to `~/.codeium/windsurf/mcp_config.json`.

### VS Code — Continue / Cline

Add the standard entry to Continue's `config.json` (Command Palette → *Continue: Open config.json*) or Cline's MCP settings (Cline pane → Settings icon → *Edit MCP settings*).

### Zed

In `~/.config/zed/settings.json`, add:

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

### Other MCP clients

Any client conforming to the Model Context Protocol works — pass the same `node /absolute/path/to/ory-nestjs-docs/mcp/index.js` command over stdio.

## Windows paths

On Windows, escape backslashes in JSON:

```json
"args": ["C:\\Users\\you\\dev\\ory-nestjs-docs\\mcp\\index.js"]
```

## Troubleshooting

- **Server not appearing / silently failing**: confirm the path is absolute and `node` is on your PATH (`which node` / `where node`). Some clients don't inherit shell PATH — use the full node path in `command` if needed.
- **Stale docs**: `git pull` inside `ory-nestjs-docs` to fetch the latest markdown; restart the MCP server in your client.
- **Logs**:
  - Claude Desktop — macOS `~/Library/Logs/Claude/mcp.log`, Windows `%APPDATA%\Claude\logs\mcp.log`
  - Claude Code — `claude mcp logs ory-nestjs-docs`
  - Cursor — *Output* panel → **MCP Logs**

## Updating

```bash
cd ory-nestjs-docs
git pull
cd mcp && npm install   # only needed if deps changed
```
