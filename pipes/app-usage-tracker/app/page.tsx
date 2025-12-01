'use client';

import { useState, useEffect } from 'react';
import { formatDuration } from '@/lib/utils';

export default function Home() {
  const [timeRange, setTimeRange] = useState('today');
  const [usageData, setUsageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [showAddGoal, setShowAddGoal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch usage data
      const usageResponse = await fetch(`/api/usage?timeRange=${timeRange}`);
      const usage = await usageResponse.json();
      setUsageData(usage);

      // Fetch goals
      const goalsResponse = await fetch('/api/goals');
      const goalsData = await goalsResponse.json();
      setGoals(goalsData.goals || []);

      // Fetch AI insights if goals exist
      if (goalsData.goals && goalsData.goals.length > 0) {
        try {
          const aiResponse = await fetch('/api/ai-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeRange, goals: goalsData.goals })
          });
          const ai = await aiResponse.json();
          setAiInsights(ai);
        } catch (e) {
          console.log('AI analysis not available');
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addGoal = async (goal: any) => {
    try {
      await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goal)
      });
      fetchData();
      setShowAddGoal(false);
    } catch (error) {
      console.error('Error adding goal:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold">App Usage Tracker</h1>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        {/* AI Insights */}
        {aiInsights && (
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-2">🤖 AI Behavioral Analysis</h2>
            <div className="text-5xl font-bold my-4">{aiInsights.alignmentScore}%</div>
            <p className="text-lg">{aiInsights.summary}</p>
            <div className="mt-4 text-sm">
              Trend: {aiInsights.weeklyTrend === 'improving' ? '📈' :
                      aiInsights.weeklyTrend === 'declining' ? '📉' : '➡️'} {aiInsights.weeklyTrend}
            </div>
          </div>
        )}

        {/* Summary */}
        {usageData && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Summary</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-gray-600">Total Screen Time</div>
                <div className="text-3xl font-bold">{formatDuration(usageData.summary.totalScreenTime)}</div>
              </div>
              <div>
                <div className="text-gray-600">Most Used App</div>
                <div className="text-2xl font-semibold">{usageData.summary.mostUsedApp?.name || 'N/A'}</div>
                <div className="text-sm text-gray-500">
                  {usageData.summary.mostUsedApp && formatDuration(usageData.summary.mostUsedApp.duration)}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Active Apps</div>
                <div className="text-3xl font-bold">{usageData.summary.activeApps}</div>
              </div>
            </div>
          </div>
        )}

        {/* Top Applications */}
        {usageData && usageData.apps && usageData.apps.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Top Applications</h2>
            <div className="space-y-3">
              {usageData.apps.slice(0, 10).map((app: any, index: number) => (
                <div key={app.name} className="flex items-center gap-3">
                  <span className="text-gray-500 w-8">{index + 1}.</span>
                  <span className="flex-1 font-medium">{app.name}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-blue-500 h-4 rounded-full"
                      style={{ width: `${app.percentage}%` }}
                    />
                  </div>
                  <span className="w-24 text-right">{formatDuration(app.duration)}</span>
                  <span className="w-16 text-right text-gray-500">
                    {app.percentage.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goals Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">My Goals</h2>
            <button
              onClick={() => setShowAddGoal(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              + Add Goal
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No goals set yet. Add your first goal to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map(goal => (
                <div key={goal.id} className="p-4 border rounded-lg">
                  <div className="font-semibold">{goal.description}</div>
                  <div className="text-sm text-gray-600">
                    Target: {goal.target}h per {goal.period} • Priority: {goal.priority}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Recommendations */}
        {aiInsights && aiInsights.recommendations && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">🎯 AI Recommendations</h2>
            <div className="space-y-4">
              {aiInsights.recommendations.map((rec: any, i: number) => (
                <div
                  key={i}
                  className={`p-4 rounded-lg border-l-4 ${
                    rec.priority === 'high' ? 'border-red-500 bg-red-50' :
                    rec.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                    'border-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">
                      {rec.priority === 'high' ? '🔥' :
                       rec.priority === 'medium' ? '⚡' : '💡'}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-semibold">{rec.action}</h4>
                      <p className="text-sm text-gray-600 mt-1">{rec.reason}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        <strong>Expected impact:</strong> {rec.impact}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Goal Modal */}
        {showAddGoal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Add New Goal</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                addGoal({
                  description: formData.get('description'),
                  type: formData.get('type'),
                  target: Number(formData.get('target')),
                  period: formData.get('period'),
                  priority: formData.get('priority')
                });
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <input
                      name="description"
                      type="text"
                      required
                      placeholder="e.g., Limit YouTube to 2 hours per day"
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select name="type" className="w-full px-3 py-2 border rounded">
                      <option value="screen_time">Screen Time Limit</option>
                      <option value="app_limit">App Limit</option>
                      <option value="focus_time">Focus Time</option>
                      <option value="content_limit">Content Limit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Target (hours)</label>
                    <input
                      name="target"
                      type="number"
                      required
                      min="0"
                      step="0.5"
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Period</label>
                    <select name="period" className="w-full px-3 py-2 border rounded">
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Priority</label>
                    <select name="priority" className="w-full px-3 py-2 border rounded">
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddGoal(false)}
                    className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Add Goal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
