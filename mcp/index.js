const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const { zodToJsonSchema } = require("zod-to-json-schema");
const { z } = require("zod");
const fs = require("fs");
const path = require("path");
const { globSync } = require("glob");

// Configuration
const DOCS_DIR = path.resolve(__dirname, "../docs");

const server = new Server(
  {
    name: "ory-nestjs-docs",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List all available documentation files.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_docs",
        description: "List all available documentation files for ory-nestjs.",
        inputSchema: zodToJsonSchema(z.object({})),
      },
      {
        name: "read_doc",
        description: "Read the content of a specific documentation file.",
        inputSchema: zodToJsonSchema(
          z.object({
            filePath: z.string().description("The relative path of the doc file (e.g., 'usage/quick-start.md')"),
          })
        ),
      },
      {
        name: "search_docs",
        description: "Search for a keyword or phrase across all documentation files.",
        inputSchema: zodToJsonSchema(
          z.object({
            query: z.string().description("The search query"),
          })
        ),
      },
    ],
  };
});

/**
 * Handle tool calls.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "list_docs": {
      const files = globSync("**/*.md", { cwd: DOCS_DIR });
      return {
        content: [
          {
            type: "text",
            text: files.join("\n"),
          },
        ],
      };
    }

    case "read_doc": {
      const { filePath } = args;
      const fullPath = path.join(DOCS_DIR, filePath);

      if (!fullPath.startsWith(DOCS_DIR)) {
        throw new Error("Invalid path");
      }

      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error reading file: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "search_docs": {
      const { query } = args;
      const files = globSync("**/*.md", { cwd: DOCS_DIR });
      const results = [];

      for (const file of files) {
        const content = fs.readFileSync(path.join(DOCS_DIR, file), "utf-8");
        if (content.toLowerCase().includes(query.toLowerCase())) {
          results.push(file);
        }
      }

      return {
        content: [
          {
            type: "text",
            text: results.length > 0 
              ? `Found matches in:\n${results.join("\n")}`
              : "No matches found.",
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

/**
 * Start the server.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ory-nestjs MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
