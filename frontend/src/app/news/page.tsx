'use client';

import React from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { NewsFeed } from '../../features/news/components/NewsFeed';

export default function NewsPage() {
  return (
    <DashboardLayout>
      <div className="pb-12">
        <NewsFeed />
      </div>
    </DashboardLayout>
  );
}
