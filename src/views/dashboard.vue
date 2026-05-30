<template>
  <div class="dashboard">
    <div class="stats-grid">
      <div v-for="stat in stats" :key="stat.title" class="stat-card glass-panel">
        <div class="stat-icon">{{ stat.icon }}</div>
        <div class="stat-info">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-title">{{ stat.title }}</div>
        </div>
      </div>
    </div>
    <div class="charts-grid">
      <div class="chart-card glass-panel">
        <h3 class="chart-title">用户趋势</h3>
        <div ref="lineChartRef" class="chart-container"></div>
      </div>
      <div class="chart-card glass-panel">
        <h3 class="chart-title">访问分布</h3>
        <div ref="pieChartRef" class="chart-container"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import * as echarts from 'echarts';

const stats = [
  { icon: '👥', title: '总用户数', value: '12,846' },
  { icon: '📄', title: '文章总数', value: '3,291' },
  { icon: '💬', title: '评论总数', value: '28,492' },
  { icon: '👁️', title: '今日访问', value: '1,024' }
];

const lineChartRef = ref<HTMLElement | null>(null);
const pieChartRef = ref<HTMLElement | null>(null);

onMounted(() => {
  console.log('[Dashboard] Initializing charts');
  
  if (lineChartRef.value) {
    const lineChart = echarts.init(lineChartRef.value);
    lineChart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' } },
        axisLabel: { color: 'rgba(255,255,255,0.7)' }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' } },
        axisLabel: { color: 'rgba(255,255,255,0.7)' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
      },
      series: [{
        data: [120, 200, 150, 80, 70, 110, 130],
        type: 'line',
        smooth: true,
        itemStyle: { color: '#667eea' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(102,126,234,0.5)' },
            { offset: 1, color: 'rgba(102,126,234,0)' }
          ])
        }
      }]
    });
  }

  if (pieChartRef.value) {
    const pieChart = echarts.init(pieChartRef.value);
    pieChart.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        itemStyle: {
          borderRadius: 8,
          borderColor: 'rgba(0,0,0,0.2)',
          borderWidth: 2
        },
        data: [
          { value: 1048, name: '直接访问' },
          { value: 735, name: '邮件营销' },
          { value: 580, name: '联盟广告' },
          { value: 484, name: '视频广告' }
        ],
        label: { color: 'rgba(255,255,255,0.7)' }
      }]
    });
  }
});
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.dashboard {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: $spacing-md;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-lg;
}

.stat-icon {
  font-size: 40px;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #fff;
}

.stat-title {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: $spacing-lg;
}

.chart-card {
  padding: $spacing-lg;
}

.chart-title {
  color: #fff;
  font-size: 16px;
  margin-bottom: $spacing-md;
}

.chart-container {
  width: 100%;
  height: 300px;
}
</style>