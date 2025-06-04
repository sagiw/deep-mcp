import dotenv from "dotenv";
import { fetch } from "undici";
/**
 * Example FastMCP server implementing deep functions for Google and Perplexity.
 *
 * Features demonstrated:
 * - google-deep function implementation
 * - perplexity-deep function implementation
 */
import { z } from "zod";

// Load environment variables from .env file
dotenv.config();

import { FastMCP } from "../FastMCP.js";

const server = new FastMCP({
  name: "Deep Functions",
  ping: {
    intervalMs: 10000,
    logLevel: "debug",
  },
  roots: {},
  version: "1.0.0",
});

// --- Google Deep Function ---
const GoogleDeepParams = z.object({
  depth: z.number().optional().describe("Controls the creativity of the response (0-10, higher values increase temperature)"),
  maxOutputTokens: z.number().optional().describe("Maximum number of tokens to generate (default: 2048)"),
  query: z.string().describe("The prompt to send to Google Gemini API"),
});

server.addTool({
  annotations: {
    openWorldHint: true, // This tool interacts with external systems
    readOnlyHint: true, // This tool doesn't modify anything
    title: "Google Deep",
  },
  description: "Conduct in-depth research and generate high-quality content using the Google Gemini API. The MCP tool automates the research process by integrating with Gemini to analyze, summarize, and synthesize large volumes of data efficiently.",
  execute: async (args, { log }) => {
    const apiKey = "AIzaSyDKxIYxr3iaHTp_4MiE0LIgNZeb3rOYbuw" //process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY environment variable is not set");
    }
    
    // Calculate temperature from depth parameter (0-10 scale to 0-1 scale)
    const temperature = args.depth ? Math.min(Math.max(args.depth / 10, 0), 1) : 0.7;
    
    const modelName = 'gemini-2.0-flash'; // Updated model name
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    // Mask API key for logging
    const maskedApiKey = apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}` : 'undefined';
    const maskedUrl = url.replace(/(key=)[^&]+/, `key=${maskedApiKey}`);
    
    // Log request information
    log.info('='.repeat(40));
    log.info('GEMINI API REQUEST');
    log.info('='.repeat(40));
    log.info(`🔗 ENDPOINT: POST ${maskedUrl}`);
    log.info(`🔐 API Key: ${maskedApiKey}`);
    log.info(`🤖 Model: ${modelName}`);
    log.info(`🌡️ Temperature: ${temperature}`);
    
    try {
      const requestBody = {
        contents: [{
          parts: [{
            text: args.query
          }]
        }],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: temperature,
        }
      };

      // Prepare and log the request body with truncated prompt
      const promptPreview = args.query.length > 100 
        ? `${args.query.substring(0, 100)}... [Full prompt length: ${args.query.length} chars]`
        : args.query;
      log.info(`📝 Prompt: ${promptPreview}`);
      log.info('🔄 Sending request to Gemini API...');
      
      const response = await fetch(url, {
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error?.message || `HTTP error ${response.status}`;
        log.error(`❌ Gemini API error: ${errorMessage}`);
        throw new Error(`Failed to generate content: ${errorMessage}`);
      }
      
      const responseData = await response.json();
      const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || 'No content generated';
      
      log.info('='.repeat(40));
      log.info('GEMINI API RESPONSE');
      log.info('='.repeat(40));
      log.info(`✅ Status: ${response.status}`);
      log.info(`📊 Response length: ${generatedText.length} chars`);
      
      return {
        content: [
          {
            text: generatedText,
            type: "text",
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ Error calling Google Generative AI API: ${errorMessage}`);
      throw new Error(`Failed to generate content: ${errorMessage}`);
    }
  },
  name: "google-deep",
  parameters: GoogleDeepParams,
});

// --- Perplexity Deep Function ---
// Define Perplexity parameters using Zod to match Google parameter style
const PerplexityDeepParams = z.object({
  messages: z.array(
    z.object({
      content: z.string().describe("The content of the message"),
      role: z.enum(["system", "user", "assistant"]).describe("Role of the message")
    })
  ).optional().describe("Array of conversation messages (if provided, will override query)"),
  mode: z.enum(["research", "analysis", "creative"]).default("research").describe("The processing mode"),
  query: z.string().describe("The query to process")
});

server.addTool({
  annotations: {
    openWorldHint: true, // This tool interacts with external systems
    readOnlyHint: true, // This tool doesn't modify anything
    title: "Perplexity Deep Research",
  },
  description: "Perform deep research and analysis using the Perplexity API. This tool provides comprehensive, well-researched answers by leveraging Perplexity's advanced AI models.",
  execute: async (args, { log }) => {
    const apiKey = "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"//process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error("PERPLEXITY_API_KEY environment variable is not set");
    }

    // Model mapping based on mode
    const MODEL_MAP = {
      analysis: "sonar-pro",
      creative: "sonar-pro",
      default: "sonar-deep-research",
      research: "sonar-deep-research"
    };

    // System prompts based on mode
    const SYSTEM_PROMPTS = {
      analysis: "You are an analytical assistant that provides detailed analysis and insights.",
      creative: "You are a creative assistant that provides imaginative and expressive responses.",
      default: "You are a research assistant that provides comprehensive information with citations."
    };

    // Log minimal request info
    const maskedApiKey = `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}`;
    log.info(`🔐 API Key: ${maskedApiKey} | Mode: ${args.mode || 'default'}`);

    // Select model based on mode
    const model = MODEL_MAP[args.mode as keyof typeof MODEL_MAP] || MODEL_MAP.default;
    
    // Prepare messages array
    const messages = Array.isArray(args.messages) ? args.messages : [
      {
        content: SYSTEM_PROMPTS[args.mode as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.default,
        role: "system" as const
      },
      {
        content: args.query,
        role: "user" as const
      }
    ];

    // Log query preview if not using predefined messages
    if (!Array.isArray(args.messages) && args.query) {
      const { length } = args.query;
      log.info(`📝 Query: ${length > 100 ? `${args.query.substring(0, 100)}... [${length} chars]` : args.query}`);
    }

    // Setup request with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        body: JSON.stringify({ messages, model }),
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: controller.signal
      });
      
      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "No error details");
        log.error(`❌ API Error: ${response.status} ${response.statusText}`);
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error("Invalid response format from API");
      }

      let messageContent = data.choices[0].message.content;
      
      // Add citations if available
      const citations = data.citations;
      if (Array.isArray(citations) && citations.length > 0) {
        messageContent += citations.reduce(
          (acc, citation, idx) => `${acc}\n[${idx + 1}] ${citation}`,
          "\n\nCitations:"
        );
      }
      
      log.info(`✅ Response received (${messageContent.length} chars)`);
      
      return {
        content: [{ text: messageContent, type: "text" }],
      };
    } catch (error) {
      clearTimeout(timeout);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error(`❌ Request failed: ${errorMessage}`);
      throw new Error(`Content generation failed: ${errorMessage}`);
    }
  },
  name: "perplexity-deep",
  parameters: PerplexityDeepParams,
});

// ... (rest of the code remains the same)
const transportType = process.argv.includes("--http-stream")
  ? "httpStream"
  : "stdio";

if (transportType === "httpStream") {
  // Start the server with SSE transport
  server.start({
    httpStream: {
      port: 3000  // Port to run the server on
    },
    transportType: "httpStream"
  });
  
  console.log("Server started with SSE transport on http://localhost:3000/stream");
} else {
  // Start with stdio transport
  server.start({
    stdio: {
      requireOnlyMandatoryParams: true
    },
    transportType: "stdio",
  });

  console.log("Started stdio transport with only mandatory params required");
}