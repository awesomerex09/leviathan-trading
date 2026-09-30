import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';

/**
 * Chart.jsx - TradingView Lightweight Charts v5 K線圖
 * v5 breaking change: 使用 chart.addSeries(CandlestickSeries, options) 取代 addCandlestickSeries()
 */
const Chart = ({ data = [], markers = [], title }) => {
  const chartContainerRef = useRef();
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 420,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: 'rgba(0, 0, 0, 0.05)' },
        horzLines: { color: 'rgba(0, 0, 0, 0.05)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });
    chartRef.current = chart;

    // v5 API: addSeries(SeriesType, options)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444',       // 紅漲（台灣習慣）
      downColor: '#22c55e',     // 綠跌（台灣習慣）
      borderVisible: false,
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    });
    seriesRef.current = candlestickSeries;

    if (data && data.length > 0) {
      candlestickSeries.setData(data);
    }

    if (markers && markers.length > 0) {
      candlestickSeries.setMarkers(markers);
    }

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []); // 只在 mount 時初始化一次

  // 資料更新時才 setData，不重新建立 chart
  useEffect(() => {
    if (seriesRef.current && data && data.length > 0) {
      seriesRef.current.setData(data);
    }
  }, [data]);

  useEffect(() => {
    if (seriesRef.current && markers) {
      seriesRef.current.setMarkers(markers);
    }
  }, [markers]);

  return (
    <div style={{ margin: '1rem 0' }}>
      {title && (
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>{title}</h3>
      )}
      {(!data || data.length === 0) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '200px', color: '#aaa', fontSize: '0.9rem', flexDirection: 'column', gap: '0.5rem'
        }}>
          <span style={{ fontSize: '2rem' }}>📊</span>
          <span>尚無 K 線資料，後端伺服器上線後自動同步</span>
        </div>
      )}
      <div
        ref={chartContainerRef}
        style={{
          width: '100%',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.8)',
          display: data && data.length > 0 ? 'block' : 'none',
        }}
      />
    </div>
  );
};

export default Chart;
