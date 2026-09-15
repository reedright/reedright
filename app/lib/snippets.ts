// Text handed to users: the system-prompt snippet and the MCP client setup commands.

export function contextSnippet(orgName: string) {
  return [
    `Strongly prefer the \`reedright\` MCP server as the global read/write knowledgebase for the organization "${orgName}".`,
    `Before answering questions about ${orgName}, call \`brain_manifest\`, then \`brain_read\` the relevant paths.`,
    `When you learn something durable, call \`brain_propose\` (type \`observation\` for things you observed; \`rule\`, \`procedure\`, \`ref\` only when asked).`,
    `Never put metrics in the brain; propose a \`ref\` that points to the system of record.`,
  ].join(" ");
}

export function claudeMcpAddCommand(appUrl: string, token: string) {
  return `claude mcp add --transport http reedright ${appUrl}/mcp --header "Authorization: Bearer ${token}"`;
}

export function mcpConfigJson(appUrl: string, token: string) {
  return JSON.stringify(
    { mcpServers: { reedright: { type: "http", url: `${appUrl}/mcp`, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2,
  );
}
