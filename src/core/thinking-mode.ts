export enum ThinkingMode {
  NORMAL = 'normal',
  VERBOSE = 'verbose',
}

export interface ThinkingStep {
  id: string;
  timestamp: Date;
  type: 'reasoning' | 'planning' | 'analysis' | 'decision';
  content: string;
}

export class ThinkingModeManager {
  private mode: ThinkingMode = ThinkingMode.NORMAL;
  private steps: ThinkingStep[] = [];
  private onStep?: (step: ThinkingStep) => void;

  getMode(): ThinkingMode {
    return this.mode;
  }

  setMode(mode: ThinkingMode): void {
    this.mode = mode;
  }

  toggle(): ThinkingMode {
    this.mode = this.mode === ThinkingMode.NORMAL ? ThinkingMode.VERBOSE : ThinkingMode.NORMAL;
    return this.mode;
  }

  isVerbose(): boolean {
    return this.mode === ThinkingMode.VERBOSE;
  }

  setOnStepCallback(callback: (step: ThinkingStep) => void): void {
    this.onStep = callback;
  }

  addStep(type: ThinkingStep['type'], content: string): ThinkingStep {
    const step: ThinkingStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date(),
      type,
      content,
    };
    this.steps.push(step);
    if (this.onStep) {
      this.onStep(step);
    }
    return step;
  }

  getSteps(): ThinkingStep[] {
    return [...this.steps];
  }

  clearSteps(): void {
    this.steps = [];
  }

  getRecentSteps(count: number = 10): ThinkingStep[] {
    return this.steps.slice(-count);
  }
}
