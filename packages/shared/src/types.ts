export interface Overview {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  currency: string;
  batches: BatchSummary[];
  funnel: {
    stage1: number;
    stage2: number;
    stage3: number;
  };
  milestones: Milestone[];
}

export interface BatchSummary {
  id: number;
  status: "preparing" | "open" | "closed";
  applicants: number;
  approved: number;
  openDate?: string;
}

export interface Milestone {
  name: string;
  achievedDate?: string;
}

export interface BudgetReport {
  committed: number;
  spent: number;
  remaining: number;
  currency: string;
  byStage: Record<string, number>;
  byCategory: Record<string, number>;
  transactions: Transaction[];
}

export interface Transaction {
  date: string;
  payee: string;
  narration: string;
  account: string;
  amount: number;
  currency: string;
}

export interface StageInfo {
  id: string;
  title: string;
  content: string;
}

export interface PolicyInfo {
  name: string;
  title: string;
  content: string;
}

export interface ChangelogEntry {
  id: string;
  date: string;
  change: string;
  reason: string;
  scope: string;
  effective: string;
}

export interface ProjectInfo {
  name: string;
  description: string;
  url: string;
  stars: number;
  owner: string;
  language?: string;
}
