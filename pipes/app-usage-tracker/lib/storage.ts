export interface UserGoal {
  id: string;
  type: 'screen_time' | 'app_limit' | 'focus_time' | 'content_limit' | 'custom';
  description: string;
  target: number;  // hours
  period: 'daily' | 'weekly' | 'monthly';
  apps?: string[];
  categories?: string[];
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
}

const STORAGE_KEY = 'app_usage_tracker_goals';

export function getUserGoals(): UserGoal[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading goals:', error);
    return [];
  }
}

export function saveUserGoals(goals: UserGoal[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch (error) {
    console.error('Error saving goals:', error);
  }
}

export function addGoal(goal: Omit<UserGoal, 'id' | 'createdAt'>): UserGoal {
  const newGoal: UserGoal = {
    ...goal,
    id: Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString(),
  };

  const goals = getUserGoals();
  goals.push(newGoal);
  saveUserGoals(goals);

  return newGoal;
}

export function updateGoal(id: string, updates: Partial<UserGoal>): void {
  const goals = getUserGoals();
  const index = goals.findIndex(g => g.id === id);

  if (index !== -1) {
    goals[index] = { ...goals[index], ...updates };
    saveUserGoals(goals);
  }
}

export function deleteGoal(id: string): void {
  const goals = getUserGoals();
  const filtered = goals.filter(g => g.id !== id);
  saveUserGoals(filtered);
}

// Server-side goal retrieval for API routes
export async function getUserGoalsServer(): Promise<UserGoal[]> {
  // For now, return empty array. In production, you'd fetch from a database
  // or read from a server-side storage mechanism
  return [];
}
