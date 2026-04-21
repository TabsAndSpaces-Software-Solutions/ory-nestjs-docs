# AI & MCP Server

`ory-nestjs` publishes a **remote Model Context Protocol (MCP)** server so your AI coding tools (Claude Code, Claude Desktop, Cursor, Windsurf, Zed, VS Code + Continue/Cline) can answer questions using this documentation — with zero local setup.

Once connected, your AI can answer things like *"How do I configure multi-tenancy?"* or *"What's the contract of `@RequireRole`?"* against the real, current docs instead of training-data guesses.

- **MCP endpoint**: `https://ory-nestjs-docs.vercel.app/mcp`
- **Transport**: Streamable HTTP (stateless, no sessions to manage)
- **Docs site** (human-readable): https://ory-nestjs-docs.vercel.app/

## Tools exposed

| Tool | Input | Output |
|---|---|---|
| `list_docs` | — | Every doc page, newline-separated. |
| `read_doc` | `{ filePath: string }` (relative to `docs/`, e.g. `usage/quick-start.md`) | Full Markdown of that page. |
| `search_docs` | `{ query: string }` | Paths whose content matches (case-insensitive). |

## Client configuration

Pick the snippet for your tool. All point at the same remote URL — nothing to clone, nothing to install.

### Claude Code

One command:

```bash
claude mcp add --transport http ory-nestjs-docs https://ory-nestjs-docs.vercel.app/mcp
```

Or commit a project-scoped `.mcp.json` to share with your team:

```json title=".mcp.json"
{
  "mcpServers": {
    "ory-nestjs-docs": {
      "type": "http",
      "url": "https://ory-nestjs-docs.vercel.app/mcp"
    }
  }
}
```

Verify with `claude mcp list`.

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project):

```json
{
  "mcpServers": {
    "ory-nestjs-docs": {
      "url": "https://ory-nestjs-docs.vercel.app/mcp"
    }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "ory-nestjs-docs": {
      "serverUrl": "https://ory-nestjs-docs.vercel.app/mcp"
    }
  }
}
```

### Zed

`~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "ory-nestjs-docs": {
      "url": "https://ory-nestjs-docs.vercel.app/mcp"
    }
  }
}
```

### Stdio-only clients (Claude Desktop, Cline, older integrations)

Some clients don't yet speak remote MCP natively — use Anthropic's `mcp-remote` bridge. It proxies the remote URL over stdio. No clone, no build — `npx` fetches it on demand.

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows, `~/.config/Claude/claude_desktop_config.json` on Linux):

```json
{
  "mcpServers": {
    "ory-nestjs-docs": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://ory-nestjs-docs.vercel.app/mcp"]
    }
  }
}
```

The same bridge pattern works for Cline, Continue, or any stdio-only MCP client — replace the client's config path accordingly.

Requires Node.js 18+ on the machine running the stdio client.

## Troubleshooting

- **Tools not appearing**: restart your AI client after editing its config. Most clients load MCP configuration at startup only.
- **`mcp-remote` not found**: ensure `node` and `npx` are on the client process's PATH. Some macOS/Windows GUI clients don't inherit shell PATH — put the full path to `npx` in `command`.
- **Stale results**: the server reads from the currently-deployed docs; after a docs push, Vercel needs to finish redeploying. Typical lag is under a minute.
- **Logs**:
  - Claude Code — `claude mcp logs ory-nestjs-docs`
  - Claude Desktop — macOS `~/Library/Logs/Claude/mcp.log`, Windows `%APPDATA%\Claude\logs\mcp.log`
  - Cursor — *Output* panel → **MCP Logs**

## Running locally (optional, contributors only)

If you're hacking on the docs or the MCP server itself, a stdio server lives in the docs repo at `mcp/index.js`. See the [README](https://github.com/TabsAndSpaces-Software-Solutions/ory-nestjs-docs/tree/main/mcp) in that directory for local-dev instructions.
