const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const {
  StreamableHTTPServerTransport,
} = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

const DOCS_DIR = path.resolve(process.cwd(), 'docs');

function buildServer() {
  const server = new Server(
    { name: 'ory-nestjs-docs', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'list_docs',
        description: 'List every documentation page for ory-nestjs.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'read_doc',
        description:
          "Read the full Markdown of a documentation page. Pass filePath relative to docs/, e.g. 'usage/quick-start.md'.",
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: "Relative path under docs/, e.g. 'usage/quick-start.md'.",
            },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'search_docs',
        description: 'Case-insensitive keyword search across every documentation page.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Text to search for.' },
          },
          required: ['query'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    if (name === 'list_docs') {
      const files = globSync('**/*.md', { cwd: DOCS_DIR });
      return { content: [{ type: 'text', text: files.join('\n') }] };
    }

    if (name === 'read_doc') {
      const filePath = String(args.filePath || '');
      const full = path.join(DOCS_DIR, filePath);
      const resolved = path.resolve(full);
      if (!resolved.startsWith(DOCS_DIR + path.sep) && resolved !== DOCS_DIR) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Invalid path: must resolve under docs/.' }],
        };
      }
      try {
        return {
          content: [{ type: 'text', text: fs.readFileSync(resolved, 'utf-8') }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error reading file: ${err.message}` }],
        };
      }
    }

    if (name === 'search_docs') {
      const query = String(args.query || '').toLowerCase();
      if (!query) {
        return { content: [{ type: 'text', text: 'Empty query.' }] };
      }
      const files = globSync('**/*.md', { cwd: DOCS_DIR });
      const results = files.filter((f) =>
        fs.readFileSync(path.join(DOCS_DIR, f), 'utf-8').toLowerCase().includes(query),
      );
      return {
        content: [
          {
            type: 'text',
            text: results.length
              ? `Found matches in:\n${results.join('\n')}`
              : 'No matches found.',
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Authorization',
  );
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, Mcp-Protocol-Version');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: `Internal error: ${err.message}` },
        id: null,
      });
    }
  }
};
