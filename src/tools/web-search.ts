/**
 * WebSearchTool - 网络搜索工具
 * 
 * 学习笔记：
 * Agent 需要获取实时信息时（如最新文档、API 变更、错误解决方案），
 * 需要搜索网络。由于我们是本地 Agent，使用免费的搜索方案：
 * 
 * 1. DuckDuckGo HTML 搜索（免费，无需 API key）
 * 2. 通过解析 HTML 提取搜索结果
 * 
 * Claude Code 中也有 web_search 工具，用于获取实时信息。
 */

import type { Tool, ToolResult } from '../tools/types.js';

interface WebSearchParams {
  query: string;
  limit?: number;
}

export const WebSearchTool: Tool = {
  name: 'web_search',
  description: `Search the web for information.

Use this when:
- You need up-to-date information not in your training data
- You need to look up documentation or APIs
- You need to find solutions to errors
- You need current news or data

Returns a list of search results with titles, URLs, and snippets.`,

  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
        default: 5,
      },
    },
    required: ['query'],
  },

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { query, limit = 5 } = params as unknown as WebSearchParams;

    try {
      // DuckDuckGo HTML 搜索
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) MiniAgent/0.1.0',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          content: `Search failed: HTTP ${response.status}`,
          error: `HTTP ${response.status}`,
        };
      }

      const html = await response.text();
      const results = parseDuckDuckgoResults(html, limit);

      if (results.length === 0) {
        return {
          success: true,
          content: `No results found for: "${query}"`,
        };
      }

      const output = results.map((r, i) => 
        `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`
      ).join('\n\n');

      return {
        success: true,
        content: `Search results for "${query}":\n\n${output}`,
        metadata: {
          query,
          resultCount: results.length,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        content: `Search error: ${message}`,
        error: message,
      };
    }
  },
};

/**
 * 从 DuckDuckGo HTML 中解析搜索结果
 */
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function parseDuckDuckgoResults(html: string, limit: number): SearchResult[] {
  const results: SearchResult[] = [];

  // 提取每个结果块
  const resultBlocks = html.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi);
  
  if (resultBlocks) {
    for (let i = 0; i < Math.min(resultBlocks.length, limit); i++) {
      const block = resultBlocks[i];
      
      // 提取 URL
      const urlMatch = block.match(/href="([^"]*)"/i);
      const url = urlMatch ? urlMatch[1] : '';
      
      // 提取标题
      const titleMatch = block.match(/>(.*?)<\/a>/i);
      const title = titleMatch ? stripHtml(titleMatch[1]) : '';
      
      // 提取摘要（查找相邻的 snippet）
      const snippetMatch = html.substring(html.indexOf(block)).match(/class="result__snippet[^"]*"[^>]*>(.*?)<\/div>/is);
      const snippet = snippetMatch ? stripHtml(snippetMatch[1]).substring(0, 200) : '';
      
      results.push({ title, url, snippet });
    }
  }

  return results;
}

/**
 * 移除 HTML 标签
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
}
