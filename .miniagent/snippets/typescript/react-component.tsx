// React 功能组件模板
import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '@/utils/logger';

interface Props {
  // 组件属性定义
  title: string;
  initialCount?: number;
  onCountChange?: (count: number) => void;
}

interface State {
  // 组件状态定义
  count: number;
  loading: boolean;
  error: string | null;
}

export const Component: React.FC<Props> = ({
  title,
  initialCount = 0,
  onCountChange,
}) => {
  // 状态管理
  const [count, setCount] = useState<State['count']>(initialCount);
  const [loading, setLoading] = useState<State['loading']>(false);
  const [error, setError] = useState<State['error']>(null);

  // 计算属性
  const isEven = count % 2 === 0;

  // 事件处理
  const handleIncrement = useCallback(() => {
    logger.debug('Incrementing count', { currentCount: count });
    const newCount = count + 1;
    setCount(newCount);
    onCountChange?.(newCount);
  }, [count, onCountChange]);

  const handleDecrement = useCallback(() => {
    logger.debug('Decrementing count', { currentCount: count });
    const newCount = count - 1;
    setCount(newCount);
    onCountChange?.(newCount);
  }, [count, onCountChange]);

  const handleReset = useCallback(() => {
    logger.debug('Resetting count');
    setCount(0);
    onCountChange?.(0);
  }, [onCountChange]);

  // 生命周期
  useEffect(() => {
    logger.info('Component mounted');

    return () => {
      logger.info('Component unmounted');
    };
  }, []);

  useEffect(() => {
    logger.debug('Count changed', { count });
  }, [count]);

  // 渲染
  if (error) {
    return (
      <div className="error-container">
        <h3>出错了</h3>
        <p>{error}</p>
        <button onClick={() => setError(null)}>重试</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <div className="component-container">
      <h1>{title}</h1>

      <div className="count-display">
        <p>当前计数: {count}</p>
        <p>状态: {isEven ? '偶数' : '奇数'}</p>
      </div>

      <div className="button-group">
        <button onClick={handleDecrement} disabled={count <= 0}>
          - 减少
        </button>
        <button onClick={handleReset}>重置</button>
        <button onClick={handleIncrement}>
          + 增加
        </button>
      </div>
    </div>
  );
};

Component.displayName = 'Component';
