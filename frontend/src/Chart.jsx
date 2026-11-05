import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';

/**
 * Chart.jsx - TradingView Lightweight Charts v5 K線圖元件
 * - 支援繁中台灣習慣顏色（紅漲綠跌）
 * - 使用 ResizeObserver 自動適配容器寬度，解決切換 Tab 或載入時寬度為 0 導致空白的問題
 * - 支援懸停十字線顯示 OHLC 數值與漲跌幅
 * - 支援進出場訊號 Marker 標記（買入/加碼/出場）
 */
const Chart = ({ data = [], markers = [], title, subtitle }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const markersPluginRef = useRef(null);
  const resizeObserverRef = useRef(null);

  const [hoverInfo, setHoverInfo] = useState(null);

  // 初始化 Chart 與 Series
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const initialWidth = container.clientWidth || container.parentElement?.clientWidth || 700;

    const chart = createChart(container, {
      width: Math.max(initialWidth, 300),
      height: 420,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#888888',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(128, 128, 128, 0.08)' },
        horzLines: { color: 'rgba(128, 128, 128, 0.08)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(128, 128, 128, 0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(128, 128, 128, 0.3)', width: 1, style: 2 },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(128, 128, 128, 0.15)',
      },
      rightPriceScale: {
        borderColor: 'rgba(128, 128, 128, 0.15)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.15,
        },
      },
    });
    chartRef.current = chart;

    // v5 API: addSeries(SeriesType, options)
    // 台灣習慣：紅漲綠跌
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderVisible: false,
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    });
    seriesRef.current = candlestickSeries;

    // 設定初始資料
    if (data && data.length > 0) {
      try {
        candlestickSeries.setData(data);
        chart.timeScale().fitContent();
      } catch (err) {
        console.warn('Initial setData error:', err);
      }
    }

    // 設定初始 Markers
    if (markers && markers.length > 0) {
      try {
        const sorted = [...markers].sort((a, b) => a.time - b.time);
        markersPluginRef.current = createSeriesMarkers(candlestickSeries, sorted);
      } catch (err) {
        console.warn('Initial createSeriesMarkers error:', err);
      }
    }

    // 十字線懸停事件，即時顯示當前 K 棒資訊
    chart.subscribeCrosshairMove(param => {
      if (!param || !param.time || !param.seriesData) {
        setHoverInfo(null);
        return;
      }
      const bar = param.seriesData.get(candlestickSeries);
      if (bar) {
        const dateStr = typeof param.time === 'number'
          ? new Date(param.time * 1000).toLocaleDateString('zh-TW')
          : String(param.time);
        const change = bar.close - bar.open;
        const changePct = bar.open ? (change / bar.open) * 100 : 0;
        setHoverInfo({
          date: dateStr,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          change,
          changePct,
        });
      } else {
        setHoverInfo(null);
      }
    });

    // 使用 ResizeObserver 確保任何時候容器寬度變動都即時重繪
    const ro = new ResizeObserver(entries => {
      if (!entries || !entries.length) return;
      const entry = entries[0];
      const newWidth = entry.contentRect.width;
      if (newWidth > 0 && chartRef.current) {
        chartRef.current.applyOptions({ width: newWidth });
        chartRef.current.timeScale().fitContent();
      }
    });
    ro.observe(container);
    resizeObserverRef.current = ro;

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      markersPluginRef.current = null;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []); // 只在 mount 時建立一次 chart

  // 資料更新時 setData
  useEffect(() => {
    if (!seriesRef.current || !data) return;

    if (data.length > 0) {
      try {
        // 確保寬度非 0
        if (chartRef.current && chartContainerRef.current) {
          const w = chartContainerRef.current.clientWidth;
          if (w > 0) chartRef.current.applyOptions({ width: w });
        }
        seriesRef.current.setData(data);
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      } catch (e) {
        console.warn('Chart setData error:', e);
      }
    }
  }, [data]);

  // Markers 更新
  useEffect(() => {
    if (!seriesRef.current) return;
    const sorted = (markers || []).slice().sort((a, b) => a.time - b.time);

    try {
      if (!markersPluginRef.current) {
        if (sorted.length > 0) {
          markersPluginRef.current = createSeriesMarkers(seriesRef.current, sorted);
        }
      } else {
        markersPluginRef.current.setMarkers(sorted);
      }
    } catch (e) {
      console.warn('Update markers error:', e);
    }
  }, [markers]);

  return (
    <div style={{ margin: '1rem 0' }}>
      {/* 標題與最新報價資訊 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          {title && (
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {title}
            </h3>
          )}
          {subtitle && (
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* 懸停 K 棒資訊 */}
        {hoverInfo ? (
          <div style={{
            display: 'flex', gap: '0.75rem', fontSize: '0.82rem',
            background: 'var(--card-bg)', padding: '0.35rem 0.75rem',
            borderRadius: '0.5rem', border: '1px solid var(--border)',
            alignItems: 'center', flexWrap: 'wrap',
          }}>
            <span style={{ color: 'var(--text-muted)' }}>{hoverInfo.date}</span>
            <span>開: <strong>{hoverInfo.open.toFixed(2)}</strong></span>
            <span>高: <strong>{hoverInfo.high.toFixed(2)}</strong></span>
            <span>低: <strong>{hoverInfo.low.toFixed(2)}</strong></span>
            <span>收: <strong>{hoverInfo.close.toFixed(2)}</strong></span>
            <span style={{
              color: hoverInfo.change >= 0 ? '#ef4444' : '#22c55e',
              fontWeight: 700,
            }}>
              {hoverInfo.change >= 0 ? '+' : ''}{hoverInfo.change.toFixed(2)} ({hoverInfo.changePct >= 0 ? '+' : ''}{hoverInfo.changePct.toFixed(2)}%)
            </span>
          </div>
        ) : data && data.length > 0 ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0.35rem 0' }}>
            最新收盤價: <strong style={{ color: 'var(--text)' }}>{data[data.length - 1].close.toFixed(2)}</strong>
          </div>
        ) : null}
      </div>

      {/* 圖表容器 */}
      <div
        ref={chartContainerRef}
        style={{
          width: '100%',
          height: 420,
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          background: 'rgba(255, 255, 255, 0.02)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          position: 'relative',
        }}
      />
    </div>
  );
};

export default Chart;
