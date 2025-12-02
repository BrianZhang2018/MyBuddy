'use client';

import { useState, useEffect } from 'react';
import { formatDuration } from '@/lib/utils';
import { DomainPieChart } from './DomainPieChart';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AppBreakdownProps {
  app: {
    name: string;
    duration: number;
    percentage: number;
  };
  index: number;
  timeRange: string;
}

interface SubcategoryData {
  name: string;
  duration: number;
  percentage: number;
  windowCount: number;
}

interface DomainData {
  domain: string;
  duration: number;
  percentage: number;
  windowCount: number;
  subcategories?: SubcategoryData[];
}

export function AppBreakdown({ app, index, timeRange }: AppBreakdownProps) {
  const [expanded, setExpanded] = useState(false);
  const [breakdown, setBreakdown] = useState<DomainData[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  // Only fetch breakdown when expanded
  useEffect(() => {
    if (expanded && breakdown.length === 0) {
      fetchBreakdown();
    }
  }, [expanded]);

  const fetchBreakdown = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/breakdown?app=${encodeURIComponent(app.name)}&timeRange=${timeRange}`
      );
      const data = await response.json();
      setBreakdown(data.breakdown || []);
    } catch (error) {
      console.error('Error fetching breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  const isBrowser = app.name.toLowerCase().includes('chrome') ||
                   app.name.toLowerCase().includes('firefox') ||
                   app.name.toLowerCase().includes('safari') ||
                   app.name.toLowerCase().includes('edge');

  const toggleDomain = (domain: string) => {
    const newExpanded = new Set(expandedDomains);
    if (newExpanded.has(domain)) {
      newExpanded.delete(domain);
    } else {
      newExpanded.add(domain);
    }
    setExpandedDomains(newExpanded);
  };

  return (
    <div className="border rounded-lg">
      {/* Main app row */}
      <div
        className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
        onClick={() => isBrowser && setExpanded(!expanded)}
      >
        <span className="text-gray-500 w-8">{index + 1}.</span>
        {isBrowser && (
          <button className="text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </button>
        )}
        <span className="flex-1 font-medium">{app.name}</span>
        <div className="flex-1 bg-gray-200 rounded-full h-4">
          <div
            className="bg-blue-500 h-4 rounded-full transition-all"
            style={{ width: `${app.percentage}%` }}
          />
        </div>
        <span className="w-24 text-right">{formatDuration(app.duration)}</span>
        <span className="w-16 text-right text-gray-500">
          {app.percentage.toFixed(1)}%
        </span>
      </div>

      {/* Expanded breakdown */}
      {expanded && isBrowser && (
        <div className="border-t p-4 bg-gray-50">
          {loading ? (
            <div className="text-center py-4 text-gray-500">Loading breakdown...</div>
          ) : breakdown.length > 0 ? (
            <div className="grid grid-cols-2 gap-6">
              {/* Pie chart */}
              <div>
                <h4 className="font-semibold mb-2">Website Distribution</h4>
                <DomainPieChart data={breakdown} />
              </div>

              {/* Domain list */}
              <div>
                <h4 className="font-semibold mb-2">Detailed Breakdown</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {breakdown.map((domain) => {
                    const hasSubcategories = domain.subcategories && domain.subcategories.length > 0;
                    const isDomainExpanded = expandedDomains.has(domain.domain);

                    return (
                      <div key={domain.domain} className="space-y-1">
                        <div
                          className={`flex items-center justify-between p-2 bg-white rounded border ${
                            hasSubcategories ? 'cursor-pointer hover:bg-gray-50' : ''
                          }`}
                          onClick={() => hasSubcategories && toggleDomain(domain.domain)}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            {hasSubcategories && (
                              <button className="text-gray-400 hover:text-gray-600">
                                {isDomainExpanded ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                )}
                              </button>
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-sm">{domain.domain}</div>
                              <div className="text-xs text-gray-500">
                                {domain.windowCount} {domain.windowCount === 1 ? 'tab' : 'tabs'}
                                {hasSubcategories && (
                                  <span className="ml-1 text-blue-500">
                                    ({domain.subcategories!.length} categories)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-sm">
                              {formatDuration(domain.duration)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {domain.percentage.toFixed(1)}%
                            </div>
                          </div>
                        </div>

                        {/* Show subcategories when expanded */}
                        {hasSubcategories && isDomainExpanded && (
                          <div className="ml-4 pl-3 border-l-2 border-gray-200 space-y-1">
                            {domain.subcategories!.map((sub) => (
                              <div
                                key={sub.name}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
                              >
                                <div className="flex-1">
                                  <div className="font-medium">{sub.name}</div>
                                  <div className="text-gray-500">
                                    {sub.windowCount} {sub.windowCount === 1 ? 'item' : 'items'}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold">
                                    {formatDuration(sub.duration)}
                                  </div>
                                  <div className="text-gray-500">
                                    {sub.percentage.toFixed(1)}%
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              No detailed breakdown available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
