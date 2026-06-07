/**
 * 小模型代码质量增强系统 - 架构定义
 * 
 * 核心理念：让本地小模型也能输出高质量、可运行的代码
 * 
 * 架构组成：
 * 1. SnippetLibrary - 代码模板库系统
 * 2. ExampleDrivenGenerator - 示例驱动生成
 * 3. ProgressiveGenerator - 渐进式复杂度生成
 * 4. MultiRoleReviewer - 多角色审查系统
 * 5. ConstraintDrivenGenerator - 约束驱动生成
 * 6. FailurePatternLearner - 失败模式学习系统
 * 7. CodeEnhancer - 统一入口，整合所有增强机制
 */

import type { LLMAdapter } from '../../llm/base.js';

/**
 * 代码块
 */
export interface CodeBlock {
  language: string;
  code: string;
  filePath?: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  score?: number;  // 0-100
}

/**
 * 代码模板
 */
export interface CodeSnippet {
  id: string;
  name: string;
  description: string;
  language: string;
  category: string;  // 'utility' | 'api' | 'class' | 'hook' | 'component' | 'test'
  code: string;
  tags: string[];
  variables: string[];  // 模板变量，如 {{functionName}}, {{className}}
  usage: string;  // 使用说明
  lastModified: string;
}

/**
 * 示例代码
 */
export interface CodeExample {
  source: string;  // 来源文件路径
  code: string;
  language: string;
  description: string;
  similarity: number;  // 与请求的相似度 0-1
  tags: string[];
}

/**
 * 生成约束
 */
export interface GenerationConstraints {
  mustUse?: string[];      // 必须使用的库/模式
  mustNotUse?: string[];   // 禁止使用的库/模式
  mustFollow?: string[];   // 必须遵循的规范
  mustHandle?: string[];   // 必须处理的边界情况
  maxComplexity?: number;  // 最大圈复杂度
  maxLines?: number;       // 最大行数
}

/**
 * 失败模式记录
 */
export interface FailurePattern {
  id: string;
  request: string;
  generatedCode: string;
  failureReason: string;
  failureType: 'syntax' | 'logic' | 'security' | 'performance' | 'context';
  fixStrategy: string;
  fixCode: string;
  timestamp: string;
  occurrenceCount: number;
}

/**
 * 渐进式生成步骤
 */
export interface ProgressiveStep {
  stepNumber: number;
  name: string;
  description: string;
  prompt: string;
  expectedOutput: string;
}

/**
 * 审查角色
 */
export interface ReviewRole {
  name: string;
  systemPrompt: string;
  focusAreas: string[];
}

/**
 * 增强配置
 */
export interface EnhancerConfig {
  llm: LLMAdapter;
  snippetDir?: string;
  exampleDir?: string;
  failureLogPath?: string;
  maxReviewCycles?: number;
  maxRetries?: number;
  enableSnippetLibrary?: boolean;
  enableExampleDriven?: boolean;
  enableProgressiveGeneration?: boolean;
  enableMultiRoleReview?: boolean;
  enableConstraintDriven?: boolean;
  enableFailureLearning?: boolean;
}

/**
 * 增强结果
 */
export interface EnhancementResult {
  code: string;
  steps: string[];
  reviews: Array<{ role: string; result: ValidationResult }>;
  validation: ValidationResult;
  usedSnippets: string[];
  usedExamples: string[];
  appliedConstraints: GenerationConstraints | null;
  retryCount: number;
  success: boolean;
}
