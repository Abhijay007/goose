import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Github,
  LogOut,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  GitPullRequest,
  GitMerge,
  Eye,
  Plus,
  Check,
  X,
  Settings,
  Puzzle,
  Loader2,
  GitBranch,
} from 'lucide-react';
import { MainPanelLayout } from '../Layout/MainPanelLayout';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';

const GITHUB_TOKEN_KEY = 'copilot_github_token';
const GITHUB_USER_KEY = 'copilot_github_user';
const TASKS_KEY = 'copilot_tasks';

type TaskStatus = 'open' | 'merged' | 'closed' | 'review' | 'in_progress';
type TaskTab = 'active' | 'archived' | 'suggested';
type MainTab = 'dashboard' | 'integrations' | 'settings';

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

interface GitHubRepo {
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

interface Task {
  id: string;
  title: string;
  repo: string;
  repoUrl: string;
  status: TaskStatus;
  createdAt: string;
  additions?: number;
  deletions?: number;
  prUrl?: string;
  prNumber?: number;
  contributors?: number;
}

async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  return res.json() as Promise<GitHubUser>;
}

async function fetchGitHubRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
    const batch = (await res.json()) as GitHubRepo[];
    repos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return repos;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

function StatusBadge({ status }: { status: TaskStatus }) {
  if (status === 'merged')
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
        <GitMerge className="w-3 h-3" /> Merged
      </span>
    );
  if (status === 'open')
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
        <GitPullRequest className="w-3 h-3" /> Open
      </span>
    );
  if (status === 'review')
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium">
        <Eye className="w-3 h-3" /> In Review
      </span>
    );
  if (status === 'in_progress')
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
        <Loader2 className="w-3 h-3 animate-spin" /> In Progress
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium">
      <X className="w-3 h-3" /> Closed
    </span>
  );
}

function RepoSelector({
  repos,
  selected,
  onSelect,
  loading,
}: {
  repos: GitHubRepo[];
  selected: GitHubRepo | null;
  onSelect: (r: GitHubRepo | null) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = repos.filter((r) => r.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-border bg-background-primary hover:bg-background-secondary transition-colors"
      >
        <Github className="w-3.5 h-3.5 text-text-secondary" />
        <span className="text-text-secondary">
          {loading ? 'Loading repos…' : selected ? selected.full_name : 'Select repositories'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-text-secondary" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-background-primary border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repositories…"
              className="w-full text-sm px-2 py-1.5 bg-background-secondary rounded-md focus:outline-none"
            />
          </div>
          <ScrollArea className="max-h-56">
            {filtered.length === 0 ? (
              <p className="text-xs text-text-secondary text-center py-4">No repos found</p>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    onSelect(r);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-background-secondary flex items-center justify-between gap-2"
                >
                  <span className="truncate">{r.full_name}</span>
                  {selected?.id === r.id && (
                    <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  )}
                </button>
              ))
            )}
          </ScrollArea>
          {selected && (
            <div className="p-2 border-t border-border">
              <button
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className="w-full text-xs text-text-secondary hover:text-text-primary text-center py-1"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CopilotView() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(GITHUB_TOKEN_KEY));
  const [user, setUser] = useState<GitHubUser | null>(() => {
    const stored = localStorage.getItem(GITHUB_USER_KEY);
    return stored ? (JSON.parse(stored) as GitHubUser) : null;
  });
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mainTab, setMainTab] = useState<MainTab>('dashboard');
  const [taskTab, setTaskTab] = useState<TaskTab>('active');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [taskInput, setTaskInput] = useState('');
  const [tasks, setTasks] = useState<Task[]>(() => {
    const stored = localStorage.getItem(TASKS_KEY);
    return stored ? (JSON.parse(stored) as Task[]) : [];
  });
  const [creatingTask, setCreatingTask] = useState(false);

  const saveTasks = useCallback((t: Task[]) => {
    setTasks(t);
    localStorage.setItem(TASKS_KEY, JSON.stringify(t));
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(GITHUB_TOKEN_KEY);
    localStorage.removeItem(GITHUB_USER_KEY);
    setToken(null);
    setUser(null);
    setRepos([]);
    setError(null);
  }, []);

  const loadRepos = useCallback(async (tok: string) => {
    setLoadingRepos(true);
    try {
      const data = await fetchGitHubRepos(tok);
      setRepos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  useEffect(() => {
    if (token && repos.length === 0 && !loadingRepos) {
      loadRepos(token);
    }
  }, [token, repos.length, loadingRepos, loadRepos]);

  const startOAuth = async () => {
    setLoadingAuth(true);
    setError(null);
    try {
      const result = await window.electron.startGitHubOAuth();
      if ('error' in result) throw new Error(result.error);
      const githubUser = await fetchGitHubUser(result.token);
      localStorage.setItem(GITHUB_TOKEN_KEY, result.token);
      localStorage.setItem(GITHUB_USER_KEY, JSON.stringify(githubUser));
      setToken(result.token);
      setUser(githubUser);
      await loadRepos(result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoadingAuth(false);
    }
  };

  const createTask = useCallback(() => {
    if (!taskInput.trim() || !selectedRepo) return;
    setCreatingTask(true);

    const newTask: Task = {
      id: Date.now().toString(),
      title: taskInput.trim(),
      repo: selectedRepo.full_name,
      repoUrl: selectedRepo.html_url,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
    };

    const updated = [newTask, ...tasks];
    saveTasks(updated);
    setTaskInput('');
    setCreatingTask(false);

    window.electron.createChatWindow({
      query:
        `You are working on the GitHub repository: ${selectedRepo.full_name} (${selectedRepo.html_url})\n\n` +
        `Task: ${taskInput.trim()}\n\n` +
        `Please help me with this task. You can create PRs, review code, and perform other GitHub operations as needed.`,
    });
  }, [taskInput, selectedRepo, tasks, saveTasks]);

  const activeTasks = tasks.filter(
    (t) => t.status === 'in_progress' || t.status === 'open' || t.status === 'review'
  );
  const archivedTasks = tasks.filter((t) => t.status === 'merged' || t.status === 'closed');
  const suggestedTasks: Task[] = repos.slice(0, 3).map((r) => ({
    id: `suggested-${r.id}`,
    title: `Review open pull requests in ${r.name}`,
    repo: r.full_name,
    repoUrl: r.html_url,
    status: 'open' as TaskStatus,
    createdAt: r.updated_at,
  }));

  const displayedTasks =
    taskTab === 'active' ? activeTasks : taskTab === 'archived' ? archivedTasks : suggestedTasks;

  if (!token) {
    return (
      <MainPanelLayout>
        <div className="flex flex-col items-center justify-center h-full gap-6 text-text-secondary px-8">
          <Github className="w-16 h-16 opacity-70" />
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-light text-text-primary">Connect GitHub</h2>
            <p className="text-sm opacity-70 max-w-sm">
              Sign in with GitHub to manage repositories, create PRs, and review code with Goose.
            </p>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg max-w-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Button
            onClick={startOAuth}
            disabled={loadingAuth}
            className="flex items-center gap-2 px-6"
          >
            {loadingAuth ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Github className="w-4 h-4" />
            )}
            {loadingAuth ? 'Signing in…' : 'Sign in with GitHub'}
          </Button>
          <p className="text-xs opacity-50 max-w-sm text-center">
            This will open your browser to authorize Goose to manage your repositories.
          </p>
        </div>
      </MainPanelLayout>
    );
  }

  return (
    <MainPanelLayout>
      <div className="flex flex-col h-full min-h-0">
        {/* Top nav tabs */}
        <div className="flex items-center justify-between px-6 pt-12 pb-0 border-b border-border">
          <div className="flex items-center gap-0">
            {(['dashboard', 'integrations', 'settings'] as MainTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setMainTab(tab)}
                className={`px-4 py-3 text-sm capitalize font-medium border-b-2 transition-colors ${
                  mainTab === tab
                    ? 'border-text-primary text-text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pb-2">
            {user?.avatar_url && (
              <img src={user.avatar_url} alt={user.login} className="w-6 h-6 rounded-full" />
            )}
            <span className="text-xs text-text-secondary">{user?.login}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="h-6 w-6 p-0 text-text-secondary"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Dashboard tab */}
        {mainTab === 'dashboard' && (
          <div className="flex flex-col flex-1 min-h-0 px-6 py-5 gap-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold text-text-primary">Overview</h1>
                <p className="text-sm text-text-secondary mt-0.5">
                  Your most recent and/or active tasks
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-xs"
                onClick={() => setMainTab('integrations')}
              >
                <Plus className="w-3.5 h-3.5" /> Add Integration
              </Button>
            </div>

            {/* Task creation card */}
            <div className="border border-border rounded-xl p-4 bg-background-primary space-y-3">
              <textarea
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) createTask();
                }}
                placeholder="Assign a task to Goose…"
                rows={2}
                className="w-full text-sm bg-transparent resize-none focus:outline-none placeholder:text-text-secondary/50"
              />
              <div className="flex items-center justify-between">
                <RepoSelector
                  repos={repos}
                  selected={selectedRepo}
                  onSelect={setSelectedRepo}
                  loading={loadingRepos}
                />
                <Button
                  onClick={createTask}
                  disabled={!taskInput.trim() || !selectedRepo || creatingTask}
                  size="sm"
                  className="flex items-center gap-1.5 text-xs"
                >
                  {creatingTask ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Create a Task
                </Button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Task tabs */}
            <div className="flex items-center gap-1">
              {(['active', 'archived', 'suggested'] as TaskTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTaskTab(tab)}
                  className={`px-3 py-1.5 text-sm rounded-full capitalize transition-colors ${
                    taskTab === tab
                      ? 'bg-background-secondary text-text-primary font-medium'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Task list */}
            <ScrollArea className="flex-1 min-h-0">
              {loadingRepos && taskTab === 'suggested' ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="border border-border rounded-lg p-4 flex gap-3 animate-pulse"
                    >
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : displayedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-text-secondary gap-3">
                  <GitBranch className="w-10 h-10 opacity-30" />
                  <p className="text-sm">
                    {taskTab === 'active'
                      ? 'No active tasks yet. Create one above!'
                      : taskTab === 'archived'
                        ? 'No archived tasks'
                        : 'No suggestions available'}
                  </p>
                </div>
              ) : (
                <div className="space-y-px pb-6">
                  {displayedTasks.map((task, idx) => {
                    const isNewDay =
                      idx === 0 ||
                      new Date(task.createdAt).toDateString() !==
                        new Date(displayedTasks[idx - 1].createdAt).toDateString();
                    const isToday =
                      new Date(task.createdAt).toDateString() === new Date().toDateString();

                    return (
                      <div key={task.id}>
                        {isNewDay && (
                          <p className="text-[10px] uppercase tracking-widest text-text-secondary font-semibold pt-4 pb-2 px-1">
                            {isToday
                              ? 'Today'
                              : new Date(task.createdAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                          </p>
                        )}
                        <div className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-background-secondary transition-colors group">
                          <div className="w-8 h-8 rounded-full bg-background-secondary border border-border flex items-center justify-center shrink-0">
                            <GitPullRequest className="w-4 h-4 text-text-secondary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-text-secondary">
                              <span>{timeAgo(task.createdAt)}</span>
                              <span>·</span>
                              <button
                                onClick={() => window.electron.openExternal(task.repoUrl)}
                                className="flex items-center gap-1 hover:text-text-primary"
                              >
                                <Github className="w-3 h-3" />
                                {task.repo}
                              </button>
                              {task.additions !== undefined && (
                                <>
                                  <span>·</span>
                                  <span className="text-green-600">+{task.additions}</span>
                                  <span className="text-red-500">-{task.deletions ?? 0}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <StatusBadge status={task.status} />
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2.5"
                              onClick={() => {
                                if (task.prUrl) window.electron.openExternal(task.prUrl);
                              }}
                            >
                              View Task
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 group-hover:hidden">
                            <StatusBadge status={task.status} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Integrations tab */}
        {mainTab === 'integrations' && (
          <div className="flex flex-col flex-1 min-h-0 px-6 py-5">
            <h1 className="text-xl font-semibold text-text-primary mb-1">Integrations</h1>
            <p className="text-sm text-text-secondary mb-6">
              Connect tools to enhance Goose's capabilities
            </p>
            <div className="border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center">
                <Github className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">GitHub</p>
                <p className="text-xs text-text-secondary">Connected as @{user?.login}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <Check className="w-3.5 h-3.5" /> Connected
              </div>
            </div>
            <div className="mt-3 border border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 text-text-secondary">
              <Puzzle className="w-8 h-8 opacity-40" />
              <p className="text-sm">More integrations coming soon</p>
            </div>
          </div>
        )}

        {/* Settings tab */}
        {mainTab === 'settings' && (
          <div className="flex flex-col flex-1 min-h-0 px-6 py-5">
            <h1 className="text-xl font-semibold text-text-primary mb-1">Settings</h1>
            <p className="text-sm text-text-secondary mb-6">Manage your Copilot preferences</p>
            <div className="space-y-4">
              <div className="border border-border rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-text-secondary" />
                  <div>
                    <p className="text-sm font-medium">GitHub Account</p>
                    <p className="text-xs text-text-secondary">@{user?.login}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="flex items-center gap-1.5 text-xs text-red-500 border-red-200 hover:bg-red-50"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </Button>
              </div>
              <div className="border border-border rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Github className="w-5 h-5 text-text-secondary" />
                  <div>
                    <p className="text-sm font-medium">Repositories</p>
                    <p className="text-xs text-text-secondary">{repos.length} repos loaded</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => token && loadRepos(token)}
                  disabled={loadingRepos}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRepos ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainPanelLayout>
  );
}
