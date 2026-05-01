export type TaskStatus = 'open' | 'merged' | 'closed' | 'review' | 'in_progress';
export type TaskTab = 'active' | 'archived' | 'suggested';
export type MainTab = 'dashboard' | 'integrations' | 'automation' | 'insights' | 'settings';
export type GitHubOpType = 'create_issue' | 'list_issues' | 'agent';

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  language: string | null;
  updated_at: string;
  owner: { login: string };
}

export interface Task {
  id: string;
  title: string;
  repo: string;
  repoUrl: string;
  status: TaskStatus;
  createdAt: string;
  sessionId?: string;
  additions?: number;
  deletions?: number;
  prUrl?: string;
  prNumber?: number;
  contributors?: number;
}

export interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  state: string;
  body: string | null;
}

export interface GitHubInstallation {
  id: number;
  app_slug: string;
  app_id: number;
  account: { login: string } | null;
}

export interface ActiveGitHubOp {
  task: Task;
  opType: Exclude<GitHubOpType, 'agent'>;
  suggestedTitle: string;
  result?: GitHubIssue;
  issues?: GitHubIssue[];
  error?: string;
  running: boolean;
}
