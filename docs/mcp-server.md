# AI & MCP Server

`ory-nestjs` provides a **Model Context Protocol (MCP)** server that exposes the entire documentation set to AI agents like Claude, Gemini, and Cursor.

Whether you are a **developer using the library** to secure your application or a **contributor working on the library itself**, you can connect your AI tools to this server to get much more accurate, context-aware assistance.

## Benefits

- **For Consumers**: Ask your AI "How do I implement multi-tenancy?" or "Show me how to use `@RequireRole`," and it will answer using the actual library documentation rather than general (and potentially outdated) knowledge.
- **For Contributors**: Get help with architectural decisions, understanding the Zero-Ory-leakage contract, or following the internal development workflow.
- **Real-time Search**: AI agents can use the `search_docs` tool to find specific decorators, services, or configuration options across all documentation pages.

## Installation

The MCP server is located in the `mcp/` directory of the repository. You need to install its dependencies once:

```bash
cd packages/ory-nestjs/mcp
npm install
```

## Configuration

The server communicates via standard I/O (`stdio`). You need to configure your AI tool with the absolute path to the server's entry point.

### Claude Desktop

Add the `ory-nestjs` server to your configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json title="claude_desktop_config.json"
{
  "mcpServers": {
    "ory-nestjs": {
      "command": "node",
      "args": [
        "/absolute/path/to/ory-nestjs/mcp/index.js"
      ]
    }
  }
}
```

### Cursor

1. Go to **Cursor Settings** > **General** > **MCP**.
2. Click **+ Add New MCP Server**.
3. **Name**: `ory-nestjs`
4. **Type**: `stdio`
5. **Command**: `node /absolute/path/to/ory-nestjs/mcp/index.js`

## Available Tools

Once connected, your AI agent will have access to:

- `list_docs`: Discover all documentation pages.
- `read_doc`: Read the full content of any page.
- `search_docs`: Search for keywords across the entire documentation set.

## Troubleshooting

- **Absolute Paths**: Always use absolute paths in the configuration.
- **Node.js**: Ensure Node.js 18+ is installed.
- **Logs**: Check Claude Desktop logs if the server fails:
  - macOS: `~/Library/Logs/Claude/mcp.log`
  - Windows: `%APPDATA%\Claude\logs\mcp.log`
