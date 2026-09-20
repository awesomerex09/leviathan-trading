import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const Chart = ({ data, markers, title }) => {
  const chartContainerRef = useRef();
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
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
      }
    });
    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#ef4444',     // Red for Up in Taiwan
      downColor: '#22c55e',   // Green for Down in Taiwan
      borderVisible: false,
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    });

    candlestickSeries.setData(data);

    if (markers && markers.length > 0) {
      candlestickSeries.setMarkers(markers);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, markers]);

  return (
    <div style={{ margin: '2rem 0' }}>
      <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 600 }}>{title}</h3>
      <div 
        ref={chartContainerRef} 
        style={{ 
          width: '100%', 
          border: '1px solid rgba(0,0,0,0.1)', 
          borderRadius: '0.5rem', 
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.7)'
        }} 
      />
    </div>
  );
};

export default Chart;
