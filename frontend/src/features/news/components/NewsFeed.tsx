'use client';

import React, { useState } from 'react';
import { Newspaper, ArrowSquareOut, Funnel, Clock, Sparkle, Globe } from '@phosphor-icons/react';
import newsDatabase from '../../market/data/newsDatabase.json';

const SOURCES = ['Tất cả', 'CafeF', 'Vietstock', 'VnExpress', 'Tuổi Trẻ', 'Báo Đầu Tư', 'Thời Báo Tài Chính'];

export const NewsFeed: React.FC = () => {
  const [selectedSource, setSelectedSource] = useState('Tất cả');

  const filteredNews = selectedSource === 'Tất cả'
    ? newsDatabase
    : newsDatabase.filter((item) => item.source === selectedSource);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Newspaper className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono font-black text-xl text-zinc-100 tracking-tight">TIN TỨC CHỨNG KHOÁN & TÀI CHÍNH</h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                VNSTOCK NEWS 21+ SOURCES
              </span>
            </div>
            <p className="text-xs text-zinc-400">Tin tức tài chính, vĩ mô và doanh nghiệp từ 21 báo điện tử hàng đầu Việt Nam</p>
          </div>
        </div>

        {/* Source Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
          <Funnel className="w-4 h-4 text-zinc-500 mr-1 shrink-0" />
          {SOURCES.map((src) => (
            <button
              key={src}
              onClick={() => setSelectedSource(src)}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded-xl transition-all shrink-0 ${
                selectedSource === src
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800'
              }`}
            >
              {src}
            </button>
          ))}
        </div>
      </div>

      {/* News Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredNews.map((article) => (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group p-5 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl transition-all duration-200 flex flex-col justify-between backdrop-blur-sm hover:shadow-[0_0_20px_rgba(16,185,129,0.05)]"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                  {article.source}
                </span>
                <span className="text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {article.publishedAt}
                </span>
              </div>

              <h3 className="font-semibold text-base text-zinc-100 group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">
                {article.title}
              </h3>

              <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                {article.description}
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-zinc-800/60 flex items-center justify-between text-xs font-mono text-zinc-400 group-hover:text-zinc-200">
              <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">{article.category}</span>
              <div className="flex items-center gap-1 text-emerald-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Đọc bài gốc</span>
                <ArrowSquareOut className="w-4 h-4" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};
