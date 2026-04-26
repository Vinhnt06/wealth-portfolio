'use client';

import { useEffect, useRef, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, ColorType, CandlestickSeries, LineSeries, AreaSeries, BarSeries } from 'lightweight-charts';
import { motion } from 'framer-motion';

interface TradingViewChartProps {
    data: CandlestickData[];
    chartType?: 'candlestick' | 'line' | 'area' | 'bar';
    height?: number;
    showGrid?: boolean;
    showVolume?: boolean;
}

export function TradingViewChart({
    data,
    chartType = 'candlestick',
    height = 400,
    showGrid = true,
    showVolume = false,
}: TradingViewChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<any>(null);

    // Vibrant candlestick colors
    const candleColors = useMemo(() => ({
        bull: '#10B981', // Emerald green
        bear: '#F43F5E', // Deep rose
        wick: '#6B7280', // Subtle gray
        bullBody: '#10B981',
        bullShadow: '#059669',
        bearBody: '#F43F5E',
        bearShadow: '#E11D48',
    }), []);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Create chart with dark theme
        chartRef.current = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#0A0A0A' },
                textColor: '#E5E5E5',
            },
            width: chartContainerRef.current.clientWidth,
            height: height,
            grid: {
                vertLines: { color: showGrid ? '#1F1F1F' : 'transparent', style: 1 },
                horzLines: { color: showGrid ? '#1F1F1F' : 'transparent', style: 1 },
            },
            crosshair: {
                mode: 1, // CrosshairMode.Normal
                vertLine: {
                    color: '#373737',
                    width: 1,
                    style: 0, // LineStyle.Solid
                    visible: true,
                    labelVisible: true,
                },
                horzLine: {
                    color: '#373737',
                    width: 1,
                    style: 0,
                    visible: true,
                    labelVisible: true,
                },
            },
            rightPriceScale: {
                borderColor: 'rgba(199, 199, 199, 0.2)',
                scaleMargins: {
                    top: 0.3,
                    bottom: 0.1,
                },
            },
            timeScale: {
                borderColor: 'rgba(199, 199, 199, 0.2)',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        // Create series based on chart type
        let series: any;
        if (chartType === 'candlestick') {
            series = chartRef.current.addSeries(CandlestickSeries, {
                upColor: candleColors.bull,
                downColor: candleColors.bear,
                borderVisible: false,
                wickUpColor: candleColors.wick,
                wickDownColor: candleColors.wick,
                priceScaleId: '',
            });
        } else if (chartType === 'line') {
            series = chartRef.current.addSeries(LineSeries, {
                color: candleColors.bull,
                lineWidth: 2,
                priceScaleId: '',
            });
        } else if (chartType === 'area') {
            series = chartRef.current.addSeries(AreaSeries, {
                topColor: candleColors.bull,
                bottomColor: 'rgba(16, 185, 129, 0.1)',
                lineColor: candleColors.bull,
                lineWidth: 2,
                priceScaleId: '',
            });
        } else if (chartType === 'bar') {
            series = chartRef.current.addSeries(BarSeries, {
                upColor: candleColors.bull,
                downColor: candleColors.bear,
                priceScaleId: '',
            });
        }

        seriesRef.current = series;

        // Area/Line series expect { time, value } format, not OHLC
        if (chartType === 'area' || chartType === 'line') {
            const lineData = data.map(d => ({ time: d.time, value: d.close }));
            series.setData(lineData);
        } else {
            series.setData(data);
        }

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.resize(chartContainerRef.current.clientWidth, height);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            chartRef.current?.remove();
        };
    }, [data, chartType, height, showGrid, candleColors]);

    // Update data when it changes
    useEffect(() => {
        if (seriesRef.current && data.length > 0) {
            if (chartType === 'area' || chartType === 'line') {
                const lineData = data.map(d => ({ time: d.time, value: d.close }));
                seriesRef.current.setData(lineData);
            } else {
                seriesRef.current.setData(data);
            }
        }
    }, [data, chartType]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full"
        >
            <div
                ref={chartContainerRef}
                className="rounded-[2rem] overflow-hidden border border-white/10 bg-zinc-900/50 backdrop-blur-sm"
            />
        </motion.div>
    );
}
