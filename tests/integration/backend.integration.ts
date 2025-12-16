/**
 * Integration tests for backend compatibility.
 * Run manually with: npx tsx tests/integration/backend.integration.ts [check]
 *
 * Example:
 *   npx tsx tests/integration/backend.integration.ts http://localhost:3456
 *   npx tsx tests/integration/backend.integration.ts https://openai.sir-alfred.io
 */

const BACKEND_URL = process.argv[2] || 'http://localhost:3456';
const API_KEY = process.env.TOKTOKEN_KEY || 'dummy';
const VLLM_API_KEY = process.env.VLLM_API_KEY || '';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({name, passed: true, duration: Date.now() - start});
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({name, passed: false, error: errorMsg, duration: Date.now() - start});
    console.log(`❌ ${name}: ${errorMsg}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ============================================================================
// OpenAI Format Tests
// ============================================================================

async function testOpenAISimpleCompletion(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [{role: 'user', content: 'Say "hello" and nothing else'}],
      max_tokens: 10,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const data = await response.json();
  assert(data.choices?.[0]?.message?.content, 'Missing response content');
}

async function testOpenAIWithTools(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [{role: 'user', content: 'What is 2+2? Use the calculator tool.'}],
      max_tokens: 100,
      tools: [{
        type: 'function',
        function: {
          name: 'calculator',
          description: 'Perform arithmetic calculations',
          parameters: {
            type: 'object',
            properties: {
              expression: {type: 'string', description: 'Math expression to evaluate'},
            },
            required: ['expression'],
          },
        },
      }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const data = await response.json();
  assert(data.choices?.[0], 'Missing choices');
}

async function testOpenAIToolResult(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [
        {role: 'user', content: 'What is 2+2?'},
        {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_123',
            type: 'function',
            function: {name: 'calculator', arguments: '{"expression": "2+2"}'},
          }],
        },
        {role: 'tool', tool_call_id: 'call_123', content: '4'},
      ],
      max_tokens: 50,
      tools: [{
        type: 'function',
        function: {
          name: 'calculator',
          description: 'Perform arithmetic calculations',
          parameters: {type: 'object', properties: {expression: {type: 'string'}}},
        },
      }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const data = await response.json();
  assert(data.choices?.[0]?.message?.content, 'Missing response after tool result');
}

// ============================================================================
// Anthropic Format Tests
// ============================================================================

async function testAnthropicSimpleCompletion(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [{role: 'user', content: 'Say "hello" and nothing else'}],
      max_tokens: 10,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const data = await response.json();
  assert(data.content?.[0]?.text !== undefined, 'Missing response content');
}

async function testAnthropicWithTools(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [{role: 'user', content: 'List files in the current directory using bash'}],
      max_tokens: 100,
      tools: [{
        name: 'bash',
        description: 'Run a bash command',
        input_schema: {
          type: 'object',
          properties: {command: {type: 'string', description: 'The command to run'}},
          required: ['command'],
        },
      }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const data = await response.json();
  assert(data.content, 'Missing content');
  // Should either have text or tool_use
  const hasToolUse = data.content.some((c: {type: string}) => c.type === 'tool_use');
  const hasText = data.content.some((c: {type: string}) => c.type === 'text');
  assert(hasToolUse || hasText, 'Response should have tool_use or text');
}

async function testAnthropicToolResult(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [
        {role: 'user', content: 'List files in the current directory'},
        {
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: 'toolu_abc123',
            name: 'bash',
            input: {command: 'ls'},
          }],
        },
        {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: 'toolu_abc123',
            content: 'file1.txt\nfile2.txt\nREADME.md',
          }],
        },
      ],
      max_tokens: 100,
      tools: [{
        name: 'bash',
        description: 'Run a bash command',
        input_schema: {
          type: 'object',
          properties: {command: {type: 'string'}},
          required: ['command'],
        },
      }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const data = await response.json();
  assert(data.content, 'Missing content after tool result');
}

async function testAnthropicMultipleToolCalls(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [
        {role: 'user', content: 'First list files, then show the current directory'},
        {
          role: 'assistant',
          content: [
            {type: 'tool_use', id: 'toolu_001', name: 'bash', input: {command: 'ls'}},
            {type: 'tool_use', id: 'toolu_002', name: 'bash', input: {command: 'pwd'}},
          ],
        },
        {
          role: 'user',
          content: [
            {type: 'tool_result', tool_use_id: 'toolu_001', content: 'file1.txt\nfile2.txt'},
            {type: 'tool_result', tool_use_id: 'toolu_002', content: '/home/user'},
          ],
        },
      ],
      max_tokens: 100,
      tools: [{
        name: 'bash',
        description: 'Run a bash command',
        input_schema: {
          type: 'object',
          properties: {command: {type: 'string'}},
          required: ['command'],
        },
      }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const data = await response.json();
  assert(data.content, 'Missing content after multiple tool results');
}

async function testAnthropicStreaming(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [{role: 'user', content: 'Say hello'}],
      max_tokens: 20,
      stream: true,
    }),
  });

  assert(response.ok, `HTTP ${response.status}`);
  assert(response.body, 'Missing response body for streaming');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedData = false;

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    if (chunk.includes('data:')) {
      receivedData = true;
    }
  }

  assert(receivedData, 'No SSE data received');
}

async function testAnthropicTokenCounting(): Promise<void> {
  // Request exactly 100 words output and verify token count is reasonable
  const response = await fetch(`${BACKEND_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [{role: 'user', content: 'Write exactly 100 words about programming. Count carefully.'}],
      max_tokens: 200,
      stream: true,
    }),
  });

  assert(response.ok, `HTTP ${response.status}`);
  assert(response.body, 'Missing response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let inputTokens = 0;
  let outputTokens = 0;
  let textContent = '';

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      
      try {
        const parsed = JSON.parse(data);
        
        // Extract input_tokens from message_start
        if (parsed.type === 'message_start' && parsed.message?.usage?.input_tokens) {
          inputTokens = parsed.message.usage.input_tokens;
        }
        
        // Extract output_tokens from message_delta
        if (parsed.type === 'message_delta' && parsed.usage?.output_tokens) {
          outputTokens = parsed.usage.output_tokens;
        }
        
        // Collect text content
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          textContent += parsed.delta.text;
        }
      } catch {
        // Skip non-JSON lines
      }
    }
  }

  // Verify we got reasonable token counts
  assert(inputTokens > 0, `input_tokens should be > 0, got ${inputTokens}`);
  assert(outputTokens > 0, `output_tokens should be > 0, got ${outputTokens}`);
  
  // Input should include system prompt (~300 tokens) + user message (~20 tokens)
  assert(inputTokens > 100, `input_tokens should be > 100 (includes system prompt), got ${inputTokens}`);
  
  // Output should be roughly proportional to word count
  // ~100 words ≈ 130-150 tokens typically
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
  assert(wordCount > 50, `Should have generated at least 50 words, got ${wordCount}`);
  assert(outputTokens > 50, `output_tokens should be > 50 for ~100 words, got ${outputTokens}`);
  
  // Token count should be somewhat close to word count (typically 1.3-1.5x)
  const ratio = outputTokens / wordCount;
  assert(ratio > 0.5 && ratio < 3, `Token/word ratio should be 0.5-3, got ${ratio.toFixed(2)} (${outputTokens} tokens / ${wordCount} words)`);
}

// ============================================================================
// Prompt Size Tests (Small / Medium / Big)
// ============================================================================

async function testSmallPrompt(): Promise<void> {
  // ~10 tokens input
  const response = await fetch(`${BACKEND_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [{role: 'user', content: 'Hi'}],
      max_tokens: 10,
    }),
  });

  assert(response.ok, `HTTP ${response.status}`);
  const data = await response.json();
  assert(data.content?.[0], 'Missing content');
}

async function testMediumPrompt(): Promise<void> {
  // ~500 tokens input
  const longText = `Please analyze the following code and provide suggestions for improvement:

\`\`\`typescript
function processData(items: any[]) {
  let result = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].active == true) {
      let newItem = {
        id: items[i].id,
        name: items[i].name.toUpperCase(),
        value: items[i].value * 2
      };
      result.push(newItem);
    }
  }
  return result;
}

async function fetchUsers() {
  const response = await fetch('/api/users');
  const data = response.json();
  return data;
}

class UserManager {
  users = [];
  
  addUser(user) {
    this.users.push(user);
  }
  
  removeUser(id) {
    for (let i = 0; i < this.users.length; i++) {
      if (this.users[i].id == id) {
        this.users.splice(i, 1);
        break;
      }
    }
  }
  
  findUser(id) {
    for (let user of this.users) {
      if (user.id == id) return user;
    }
    return null;
  }
}
\`\`\`

Focus on: type safety, modern syntax, and best practices.`;

  const response = await fetch(`${BACKEND_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [{role: 'user', content: longText}],
      max_tokens: 500,
    }),
  });

  assert(response.ok, `HTTP ${response.status}`);
  const data = await response.json();
  assert(data.content?.[0], 'Missing content');
  assert(data.usage?.input_tokens > 200, `Expected >200 input tokens, got ${data.usage?.input_tokens}`);
}

async function testBigPrompt(): Promise<void> {
  // ~2000 tokens input
  const codeBlocks = Array(10).fill(null).map((_, i) => `
// Module ${i + 1}
export interface Entity${i} {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export class Service${i} {
  private cache = new Map<string, Entity${i}>();
  
  async findById(id: string): Promise<Entity${i} | null> {
    if (this.cache.has(id)) return this.cache.get(id)!;
    const data = await this.fetchFromDB(id);
    if (data) this.cache.set(id, data);
    return data;
  }
  
  private async fetchFromDB(id: string): Promise<Entity${i} | null> {
    // Simulate DB fetch
    return null;
  }
  
  async create(entity: Omit<Entity${i}, 'id'>): Promise<Entity${i}> {
    const id = crypto.randomUUID();
    const newEntity = { ...entity, id } as Entity${i};
    this.cache.set(id, newEntity);
    return newEntity;
  }
}
`).join('\n');

  const response = await fetch(`${BACKEND_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [{role: 'user', content: `Review this codebase and identify patterns:\n${codeBlocks}\n\nSummarize in 50 words.`}],
      max_tokens: 200,
    }),
  });

  assert(response.ok, `HTTP ${response.status}`);
  const data = await response.json();
  assert(data.content?.[0], 'Missing content');
  assert(data.usage?.input_tokens > 1000, `Expected >1000 input tokens, got ${data.usage?.input_tokens}`);
}

// ============================================================================
// Parallel Request Tests
// ============================================================================

async function testParallelSmallRequests(): Promise<void> {
  const numRequests = 5;
  const startTime = Date.now();
  
  const requests = Array(numRequests).fill(null).map((_, i) => 
    fetch(`${BACKEND_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'devstral-small-2-24b',
        messages: [{role: 'user', content: `Say the number ${i + 1}`}],
        max_tokens: 10,
      }),
    })
  );

  const responses = await Promise.all(requests);
  const elapsed = Date.now() - startTime;
  
  let successCount = 0;
  for (const response of responses) {
    if (response.ok) {
      const data = await response.json();
      if (data.content?.[0]) successCount++;
    }
  }
  
  assert(successCount === numRequests, `Only ${successCount}/${numRequests} requests succeeded`);
  console.log(`    (${numRequests} parallel requests in ${elapsed}ms)`);
}

async function testParallelMixedRequests(): Promise<void> {
  const startTime = Date.now();
  
  // Mix of small and medium requests
  const requests = [
    // Small requests
    fetch(`${BACKEND_URL}/v1/messages`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01'},
      body: JSON.stringify({model: 'devstral-small-2-24b', messages: [{role: 'user', content: 'Hi'}], max_tokens: 10}),
    }),
    fetch(`${BACKEND_URL}/v1/messages`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01'},
      body: JSON.stringify({model: 'devstral-small-2-24b', messages: [{role: 'user', content: 'Hello'}], max_tokens: 10}),
    }),
    // Medium request
    fetch(`${BACKEND_URL}/v1/messages`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01'},
      body: JSON.stringify({
        model: 'devstral-small-2-24b',
        messages: [{role: 'user', content: 'Explain the difference between let, const, and var in JavaScript in 3 sentences.'}],
        max_tokens: 150,
      }),
    }),
    // OpenAI format request
    fetch(`${BACKEND_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}`},
      body: JSON.stringify({model: 'devstral-small-2-24b', messages: [{role: 'user', content: 'Say yes'}], max_tokens: 5}),
    }),
  ];

  const responses = await Promise.all(requests);
  const elapsed = Date.now() - startTime;
  
  let successCount = 0;
  for (const response of responses) {
    if (response.ok) successCount++;
  }
  
  assert(successCount === requests.length, `Only ${successCount}/${requests.length} requests succeeded`);
  console.log(`    (${requests.length} mixed parallel requests in ${elapsed}ms)`);
}

async function testParallelStreamingRequests(): Promise<void> {
  const numRequests = 3;
  const startTime = Date.now();
  
  const requests = Array(numRequests).fill(null).map((_, i) => 
    fetch(`${BACKEND_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'devstral-small-2-24b',
        messages: [{role: 'user', content: `Count from 1 to ${i + 3}`}],
        max_tokens: 50,
        stream: true,
      }),
    })
  );

  const responses = await Promise.all(requests);
  
  // Consume all streams in parallel
  const streamPromises = responses.map(async (response, i) => {
    assert(response.ok, `Request ${i} failed: HTTP ${response.status}`);
    assert(response.body, `Request ${i} missing body`);
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let hasData = false;
    
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      if (chunk.includes('data:')) hasData = true;
    }
    
    return hasData;
  });
  
  const results = await Promise.all(streamPromises);
  const elapsed = Date.now() - startTime;
  
  const successCount = results.filter(r => r).length;
  assert(successCount === numRequests, `Only ${successCount}/${numRequests} streams received data`);
  console.log(`    (${numRequests} parallel streaming requests in ${elapsed}ms)`);
}

// ============================================================================
// Token Count Variation Tests
// ============================================================================

async function testMaxTokens10(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [{role: 'user', content: 'Write a long story about a dragon'}],
      max_tokens: 10,
    }),
  });

  assert(response.ok, `HTTP ${response.status}`);
  const data = await response.json();
  assert(data.usage?.output_tokens <= 15, `Expected <=15 output tokens, got ${data.usage?.output_tokens}`);
}

async function testMaxTokens100(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [{role: 'user', content: 'Write a haiku about programming'}],
      max_tokens: 100,
    }),
  });

  assert(response.ok, `HTTP ${response.status}`);
  const data = await response.json();
  assert(data.content?.[0], 'Missing content');
  assert(data.usage?.output_tokens > 5, `Expected >5 output tokens, got ${data.usage?.output_tokens}`);
  assert(data.usage?.output_tokens <= 105, `Expected <=105 output tokens, got ${data.usage?.output_tokens}`);
}

async function testMaxTokens500(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [{role: 'user', content: 'Explain recursion with an example in Python'}],
      max_tokens: 500,
    }),
  });

  assert(response.ok, `HTTP ${response.status}`);
  const data = await response.json();
  assert(data.content?.[0], 'Missing content');
  // Should have substantial output for this topic
  assert(data.usage?.output_tokens > 50, `Expected >50 output tokens, got ${data.usage?.output_tokens}`);
}

async function testMaxTokens1000Streaming(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'devstral-small-2-24b',
      messages: [{role: 'user', content: 'Write a detailed explanation of how async/await works in JavaScript'}],
      max_tokens: 1000,
      stream: true,
    }),
  });

  assert(response.ok, `HTTP ${response.status}`);
  assert(response.body, 'Missing response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let chunkCount = 0;
  let outputTokens = 0;

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    chunkCount++;
    
    // Extract output tokens from message_delta
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.usage?.output_tokens) {
          outputTokens = data.usage.output_tokens;
        }
      } catch { /* ignore */ }
    }
  }

  assert(chunkCount > 5, `Expected >5 chunks, got ${chunkCount}`);
  assert(outputTokens > 100, `Expected >100 output tokens, got ${outputTokens}`);
  console.log(`    (${chunkCount} chunks, ${outputTokens} output tokens)`);
}

// ============================================================================
// Direct vLLM Tests (bypass proxy)
// ============================================================================

async function testDirectVLLMModels(): Promise<void> {
  if (!VLLM_API_KEY) {
    console.log('  ⏭️  Skipped (no VLLM_API_KEY)');
    return;
  }

  const response = await fetch(`${BACKEND_URL}/v1/models`, {
    headers: {'Authorization': `Bearer ${VLLM_API_KEY}`},
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const data = await response.json();
  assert(Array.isArray(data.data), 'Models response should have data array');
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log(`\n🧪 Running integration tests against: ${BACKEND_URL}\n`);
  console.log('─'.repeat(60));

  console.log('\n📦 OpenAI Format Tests\n');
  await runTest('OpenAI: Simple completion', testOpenAISimpleCompletion);
  await runTest('OpenAI: With tools', testOpenAIWithTools);
  await runTest('OpenAI: Tool result continuation', testOpenAIToolResult);

  console.log('\n📦 Anthropic Format Tests\n');
  await runTest('Anthropic: Simple completion', testAnthropicSimpleCompletion);
  await runTest('Anthropic: With tools', testAnthropicWithTools);
  await runTest('Anthropic: Tool result continuation', testAnthropicToolResult);
  await runTest('Anthropic: Multiple tool calls', testAnthropicMultipleToolCalls);
  await runTest('Anthropic: Streaming', testAnthropicStreaming);
  await runTest('Anthropic: Token counting (100 words)', testAnthropicTokenCounting);

  console.log('\n📦 Prompt Size Tests\n');
  await runTest('Prompt: Small (~10 tokens)', testSmallPrompt);
  await runTest('Prompt: Medium (~500 tokens)', testMediumPrompt);
  await runTest('Prompt: Big (~2000 tokens)', testBigPrompt);

  console.log('\n📦 Parallel Request Tests\n');
  await runTest('Parallel: 5 small requests', testParallelSmallRequests);
  await runTest('Parallel: Mixed requests (Anthropic + OpenAI)', testParallelMixedRequests);
  await runTest('Parallel: 3 streaming requests', testParallelStreamingRequests);

  console.log('\n📦 Token Count Variation Tests\n');
  await runTest('MaxTokens: 10 (truncated)', testMaxTokens10);
  await runTest('MaxTokens: 100 (short)', testMaxTokens100);
  await runTest('MaxTokens: 500 (medium)', testMaxTokens500);
  await runTest('MaxTokens: 1000 streaming', testMaxTokens1000Streaming);

  console.log('\n📦 Direct vLLM Tests\n');
  await runTest('vLLM: List models', testDirectVLLMModels);

  // Summary
  console.log('\n' + '─'.repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  - ${r.name}: ${r.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
