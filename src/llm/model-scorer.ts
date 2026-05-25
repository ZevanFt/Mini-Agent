/**
 * 模型推荐和评分系统
 * 
 * 为本地 Ollama 模型提供评分、推荐和对比功能
 * 评分基于：
 * 1. 代码生成能力（语法正确性、逻辑完整性）
 * 2. 工具调用准确性
 * 3. 响应速度
 * 4. 资源消耗（内存/CPU）
 * 5. 上下文理解能力
 */

import { logger } from '@/utils/logger';
import type { LLMAdapter } from '@/llm/base.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface ModelScore {
  modelName: string;
  overallScore: number;       // 0-100
  codeGenerationScore: number; // 代码生成能力
  toolCallScore: number;       // 工具调用准确性
  speedScore: number;          // 响应速度
  resourceScore: number;       // 资源效率
  contextScore: number;        // 上下文理解
  testDate: string;
  testCount: number;
}

export interface ModelRecommendation {
  recommendedModel: string;
  reason: string;
  alternatives: Array<{
    model: string;
    score: number;
    useCase: string;
  }>;
}

export interface TestResult {
  modelName: string;
  testType: 'code_generation' | 'tool_call' | 'speed' | 'context';
  score: number;
  details: string;
  timestamp: string;
}

const TEST_PROMPTS = {
  codeGeneration: [
    {
      prompt: 'Write a TypeScript function that calculates the factorial of a number. Include error handling.',
      expected: 'function|factorial|error|handling|throw',
    },
    {
      prompt: 'Write a Python class for a simple Todo list with add, remove, and list methods.',
      expected: 'class|Todo|add|remove|list|def',
    },
    {
      prompt: 'Write a JavaScript function that fetches data from a URL and handles errors.',
      expected: 'fetch|async|await|try|catch|error',
    },
  ],
  toolCall: [
    {
      prompt: 'Read the file package.json and show me its content.',
      expected: 'file_read|readFile|package.json',
    },
    {
      prompt: 'List all TypeScript files in the current directory.',
      expected: 'glob|list|*.ts|typescript',
    },
  ],
  context: [
    {
      prompt: 'I have a bug in my code. Here is the error: TypeError: Cannot read property "name" of undefined. How do I fix it?',
      expected: 'undefined|null|check|optional|chaining|?.',
    },
  ],
};

export class ModelScorer {
  private scores: Map<string, ModelScore> = new Map();
  private testResults: TestResult[] = [];
  private storagePath: string;

  constructor(storagePath: string = '.miniagent/model-scores.json') {
    this.storagePath = storagePath;
    this.loadScores();
  }

  /**
   * 加载已保存的评分
   */
  private loadScores(): void {
    if (existsSync(this.storagePath)) {
      try {
        const data = JSON.parse(readFileSync(this.storagePath, 'utf-8'));
        for (const score of data) {
          this.scores.set(score.modelName, score);
        }
        logger.info(`Loaded ${this.scores.size} model scores`);
      } catch (error) {
        logger.warn('Failed to load model scores:', error);
      }
    }
  }

  /**
   * 保存评分到本地文件
   */
  saveScores(): void {
    const dir = join(this.storagePath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const data = Array.from(this.scores.values());
    writeFileSync(this.storagePath, JSON.stringify(data, null, 2));
    logger.info(`Saved ${data.length} model scores`);
  }

  /**
   * 测试并评分单个模型
   */
  async testModel(modelName: string, llm: LLMAdapter): Promise<ModelScore> {
    logger.info(`Testing model: ${modelName}`);

    const codeGenScore = await this.testCodeGeneration(modelName, llm);
    const toolCallScore = await this.testToolCall(modelName, llm);
    const contextScore = await this.testContext(modelName, llm);
    const speedScore = await this.testSpeed(modelName, llm);
    const resourceScore = this.estimateResourceUsage(modelName);

    const overallScore = Math.round(
      codeGenScore * 0.35 +
      toolCallScore * 0.25 +
      contextScore * 0.20 +
      speedScore * 0.10 +
      resourceScore * 0.10
    );

    const score: ModelScore = {
      modelName,
      overallScore,
      codeGenerationScore: codeGenScore,
      toolCallScore: toolCallScore,
      speedScore: speedScore,
      resourceScore: resourceScore,
      contextScore: contextScore,
      testDate: new Date().toISOString(),
      testCount: this.getTestCount(modelName) + 1,
    };

    this.scores.set(modelName, score);
    this.saveScores();

    logger.info(`Model ${modelName} scored: ${overallScore}/100`);
    return score;
  }

  /**
   * 测试代码生成能力
   */
  private async testCodeGeneration(modelName: string, llm: LLMAdapter): Promise<number> {
    let totalScore = 0;
    let testCount = 0;

    for (const test of TEST_PROMPTS.codeGeneration) {
      try {
        const result = await llm.chatOnce({
          messages: [{ role: 'user', content: test.prompt }],
          maxTokens: 512,
        });

        const score = this.evaluateCodeResponse(result.content, test.expected);
        totalScore += score;
        testCount++;

        this.addTestResult({
          modelName,
          testType: 'code_generation',
          score,
          details: `Prompt: ${test.prompt.substring(0, 50)}...`,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.warn(`Code generation test failed for ${modelName}:`, error);
        totalScore += 0;
        testCount++;
      }
    }

    return testCount > 0 ? Math.round((totalScore / testCount) * 100) : 0;
  }

  /**
   * 测试工具调用能力
   */
  private async testToolCall(modelName: string, llm: LLMAdapter): Promise<number> {
    let totalScore = 0;
    let testCount = 0;

    for (const test of TEST_PROMPTS.toolCall) {
      try {
        const result = await llm.chatOnce({
          messages: [{ role: 'user', content: test.prompt }],
          maxTokens: 256,
        });

        const score = this.evaluateToolCallResponse(result.content, test.expected);
        totalScore += score;
        testCount++;
      } catch (error) {
        totalScore += 0;
        testCount++;
      }
    }

    return testCount > 0 ? Math.round((totalScore / testCount) * 100) : 0;
  }

  /**
   * 测试上下文理解能力
   */
  private async testContext(modelName: string, llm: LLMAdapter): Promise<number> {
    let totalScore = 0;
    let testCount = 0;

    for (const test of TEST_PROMPTS.context) {
      try {
        const result = await llm.chatOnce({
          messages: [{ role: 'user', content: test.prompt }],
          maxTokens: 512,
        });

        const score = this.evaluateContextResponse(result.content, test.expected);
        totalScore += score;
        testCount++;
      } catch (error) {
        totalScore += 0;
        testCount++;
      }
    }

    return testCount > 0 ? Math.round((totalScore / testCount) * 100) : 0;
  }

  /**
   * 测试响应速度
   */
  private async testSpeed(modelName: string, llm: LLMAdapter): Promise<number> {
    const start = Date.now();
    try {
      await llm.chatOnce({
        messages: [{ role: 'user', content: 'Say "Hello" in one sentence.' }],
        maxTokens: 64,
      });
      const elapsed = Date.now() - start;
      
      // 速度评分：1秒内 100 分，每多 1 秒减 20 分
      return Math.max(0, Math.min(100, 100 - (elapsed - 1000) / 100));
    } catch (error) {
      return 0;
    }
  }

  /**
   * 估算资源消耗（基于模型大小）
   */
  private estimateResourceUsage(modelName: string): number {
    // 从模型名称中提取参数大小（如 qwen2.5:7b -> 7）
    const sizeMatch = modelName.match(/(\d+)[bB]/);
    if (!sizeMatch) return 50; // 未知大小，给中等分数

    const sizeGB = parseInt(sizeMatch[1]);
    
    // 小模型（<7B）资源效率高，大模型效率低
    if (sizeGB <= 3) return 90;
    if (sizeGB <= 7) return 70;
    if (sizeGB <= 14) return 50;
    return 30;
  }

  /**
   * 评估代码生成响应
   */
  private evaluateCodeResponse(response: string, expectedKeywords: string): number {
    const lowerResponse = response.toLowerCase();
    const keywords = expectedKeywords.split('|').map(k => k.toLowerCase());
    
    let matchCount = 0;
    for (const keyword of keywords) {
      if (lowerResponse.includes(keyword)) {
        matchCount++;
      }
    }

    const matchRate = matchCount / keywords.length;
    
    // 检查是否有代码块
    const hasCodeBlock = response.includes('```');
    
    // 基础分 + 代码块加分
    let score = matchRate * 70;
    if (hasCodeBlock) score += 30;

    return Math.min(100, Math.round(score));
  }

  /**
   * 评估工具调用响应
   */
  private evaluateToolCallResponse(response: string, expectedKeywords: string): number {
    const lowerResponse = response.toLowerCase();
    const keywords = expectedKeywords.split('|').map(k => k.toLowerCase());
    
    let matchCount = 0;
    for (const keyword of keywords) {
      if (lowerResponse.includes(keyword)) {
        matchCount++;
      }
    }

    return Math.round((matchCount / keywords.length) * 100);
  }

  /**
   * 评估上下文理解响应
   */
  private evaluateContextResponse(response: string, expectedKeywords: string): number {
    const lowerResponse = response.toLowerCase();
    const keywords = expectedKeywords.split('|').map(k => k.toLowerCase());
    
    let matchCount = 0;
    for (const keyword of keywords) {
      if (lowerResponse.includes(keyword)) {
        matchCount++;
      }
    }

    const matchRate = matchCount / keywords.length;
    
    // 检查是否有解决方案
    const hasSolution = response.includes('fix') || response.includes('solution') || 
                        response.includes('check') || response.includes('handle');
    
    let score = matchRate * 60;
    if (hasSolution) score += 40;

    return Math.min(100, Math.round(score));
  }

  /**
   * 获取模型评分
   */
  getScore(modelName: string): ModelScore | undefined {
    return this.scores.get(modelName);
  }

  /**
   * 获取所有评分
   */
  getAllScores(): ModelScore[] {
    return Array.from(this.scores.values()).sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * 推荐最佳模型
   */
  recommendModel(useCase: string = 'general'): ModelRecommendation {
    const allScores = this.getAllScores();
    
    if (allScores.length === 0) {
      return {
        recommendedModel: 'qwen2.5:7b',
        reason: 'No test data available. Default recommendation: qwen2.5:7b (good balance of quality and speed)',
        alternatives: [
          { model: 'llama3.2:3b', score: 0, useCase: 'Fast response, low resource' },
          { model: 'deepseek-coder:6.7b', score: 0, useCase: 'Code-focused tasks' },
        ],
      };
    }

    const best = allScores[0];
    const alternatives = allScores.slice(1, 4).map(s => ({
      model: s.modelName,
      score: s.overallScore,
      useCase: this.getUseCaseDescription(s),
    }));

    return {
      recommendedModel: best.modelName,
      reason: `Best overall score: ${best.overallScore}/100 (Code: ${best.codeGenerationScore}, Tool: ${best.toolCallScore}, Context: ${best.contextScore})`,
      alternatives,
    };
  }

  /**
   * 获取模型用例描述
   */
  private getUseCaseDescription(score: ModelScore): string {
    if (score.codeGenerationScore > 80) return 'Excellent code generation';
    if (score.speedScore > 80) return 'Fast response';
    if (score.resourceScore > 70) return 'Low resource usage';
    return 'General purpose';
  }

  /**
   * 获取测试次数
   */
  private getTestCount(modelName: string): number {
    const existing = this.scores.get(modelName);
    return existing?.testCount || 0;
  }

  /**
   * 添加测试结果
   */
  private addTestResult(result: TestResult): void {
    this.testResults.push(result);
  }

  /**
   * 获取测试历史
   */
  getTestHistory(modelName: string): TestResult[] {
    return this.testResults.filter(r => r.modelName === modelName);
  }

  /**
   * 对比两个模型
   */
  compareModels(modelA: string, modelB: string): string {
    const scoreA = this.scores.get(modelA);
    const scoreB = this.scores.get(modelB);

    if (!scoreA && !scoreB) {
      return `No test data for either model: ${modelA}, ${modelB}`;
    }

    if (!scoreA) {
      return `No test data for ${modelA}. ${modelB} score: ${scoreB?.overallScore || 'N/A'}/100`;
    }

    if (!scoreB) {
      return `${modelA} score: ${scoreA.overallScore}/100. No test data for ${modelB}`;
    }

    const diff = scoreA.overallScore - scoreB.overallScore;
    const winner = diff > 0 ? modelA : diff < 0 ? modelB : 'Tie';

    return `
Model Comparison:
${modelA}: ${scoreA.overallScore}/100 (Code: ${scoreA.codeGenerationScore}, Tool: ${scoreA.toolCallScore}, Context: ${scoreA.contextScore})
${modelB}: ${scoreB.overallScore}/100 (Code: ${scoreB.codeGenerationScore}, Tool: ${scoreB.toolCallScore}, Context: ${scoreB.contextScore})

Winner: ${winner} (difference: ${Math.abs(diff)} points)
`.trim();
  }

  /**
   * 重置评分
   */
  resetScore(modelName: string): void {
    this.scores.delete(modelName);
    this.saveScores();
  }

  /**
   * 重置所有评分
   */
  resetAllScores(): void {
    this.scores.clear();
    this.saveScores();
  }
}
