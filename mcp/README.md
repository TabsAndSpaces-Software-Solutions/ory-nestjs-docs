# ory-nestjs MCP Server

This is a Model Context Protocol (MCP) server that exposes the `ory-nestjs` documentation to AI agents. It allows tools like Claude, Gemini, and Cursor to navigate and understand the documentation directly.

## Features

- `list_docs`: Discover all available documentation pages.
- `read_doc`: Retrieve the full Markdown content of a specific page.
- `search_docs`: Perform a keyword search across all documentation.

## Installation

Before configuring your AI tool, ensure you have installed the dependencies for the MCP server:

```bash
cd ory-nestjs/mcp
npm install
```

## Configuration

The MCP server runs via `stdio`. You must provide the **absolute path** to the `index.js` file in your configuration.

### 1. Claude Desktop

Add the following to your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json` (if applicable)

#### Example Configuration (macOS/Linux)
```json
{
  "mcpServers": {
    "ory-nestjs": {
      "command": "node",
      "args": [
        "/absolute/path/to/your/project/packages/ory-nestjs/mcp/index.js"
      ]
    }
  }
}
```

#### Example Configuration (Windows)
```json
{
  "mcpServers": {
    "ory-nestjs": {
      "command": "node",
      "args": [
        "C:\\absolute\\path\\to\\your\\project\\packages\\ory-nestjs\\mcp\\index.js"
      ]
    }
  }
}
```

### 2. Cursor

1.  Open **Cursor Settings** (Cmd+, or Ctrl+,).
2.  Navigate to **General** > **MCP**.
3.  Click **+ Add New MCP Server**.
4.  **Name**: `ory-nestjs`
5.  **Type**: `stdio`
6.  **Command**: `node /absolute/path/to/ory-nestjs/mcp/index.js` (Use the actual absolute path for your OS).

## Troubleshooting

- **Absolute Paths**: Most MCP clients require absolute paths to the server script and the `node` executable if it's not in your system PATH.
- **Node.js Version**: Ensure you are using Node.js 18 or higher.
- **Logs**: Claude Desktop logs can be found at:
    - macOS: `~/Library/Logs/Claude/mcp.log`
    - Windows: `%APPDATA%\Claude\logs\mcp.log`
