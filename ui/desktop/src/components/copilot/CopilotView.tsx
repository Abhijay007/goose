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
  Key,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { MainPanelLayout } from '../Layout/MainPanelLayout';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { useModelAndProvider } from '../ModelAndProviderContext';
import { SwitchModelModal } from '../settings/models/subcomponents/SwitchModelModal';
import { useNavigation } from '../../hooks/useNavigation';
import TaskRunView from './TaskRunView';

const GITHUB_TOKEN_KEY = 'copilot_github_token';
const GITHUB_USER_KEY = 'copilot_github_user';
const TASKS_KEY = 'copilot_tasks';
const SELECTED_REPO_KEY = 'copilot_selected_repo';
// Bot mode: private key is stored encrypted in main process (safeStorage), never in renderer

type TaskStatus = 'open' | 'merged' | 'closed' | 'review' | 'in_progress';
type TaskTab = 'active' | 'archived' | 'suggested';
type MainTab = 'dashboard' | 'integrations' | 'automation' | 'insights' | 'settings';

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
  sessionId?: string;
  additions?: number;
  deletions?: number;
  prUrl?: string;
  prNumber?: number;
  contributors?: number;
}

type GitHubOpType = 'create_issue' | 'list_issues' | 'agent';

interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  state: string;
  body: string | null;
}

interface ActiveGitHubOp {
  task: Task;
  opType: Exclude<GitHubOpType, 'agent'>;
  suggestedTitle: string;
  result?: GitHubIssue;
  issues?: GitHubIssue[];
  error?: string;
  running: boolean;
}

function detectGitHubOp(task: string): { opType: GitHubOpType; suggestedTitle: string } {
  const t = task.trim();
  // Simple "create issue" — handled with a direct form
  if (/^(create|open|add|file|make|new)\s+(a\s+)?(new\s+)?(github\s+)?(issue|bug report|ticket)[:\s-]*/i.test(t)) {
    const suggestedTitle = t
      .replace(/^(create|open|add|file|make|new)\s+(a\s+)?(new\s+)?(github\s+)?(issue|bug report|ticket)[:\s-]*/i, '')
      .trim() || t;
    return { opType: 'create_issue', suggestedTitle };
  }
  // List / show issues — direct API call, no agent needed
  if (/^(list|show|get|fetch|display)\s+(all\s+|open\s+|closed\s+)?(issues?|bugs?|tickets?)/i.test(t)) {
    return { opType: 'list_issues', suggestedTitle: t };
  }
  // Everything else — PR creation, code review, bug fix, feature implementation → agent
  return { opType: 'agent', suggestedTitle: t };
}

async function githubCreateIssue(
  token: string,
  repo: string,
  title: string,
  body: string
): Promise<GitHubIssue> {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? `GitHub API error ${res.status}`);
  }
  return res.json() as Promise<GitHubIssue>;
}

async function fetchGitHubIssues(
  token: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open'
): Promise<GitHubIssue[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues?state=${state}&per_page=30&sort=updated`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? `GitHub API error ${res.status}`);
  }
  const data = (await res.json()) as GitHubIssue[];
  // Filter out pull requests (GitHub returns PRs in /issues endpoint)
  return data.filter((i) => !('pull_request' in i));
}

interface GitHubInstallation {
  id: number;
  app_slug: string;
  app_id: number;
  account: { login: string } | null;
}

async function fetchUserInstallations(token: string): Promise<GitHubInstallation[]> {
  try {
    const res = await fetch('https://api.github.com/user/installations?per_page=100', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { installations: GitHubInstallation[] };
    return data.installations ?? [];
  } catch {
    return [];
  }
}

async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  return res.json() as Promise<GitHubUser>;
}

async function fetchBranches(token: string, fullName: string): Promise<string[]> {
  try {
    const res = await fetch(`https://api.github.com/repos/${fullName}/branches?per_page=100`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return ['main'];
    const data = (await res.json()) as { name: string }[];
    return data.map((b) => b.name);
  } catch {
    return ['main'];
  }
}

async function fetchGitHubRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) throw new Error(`${res.status}`);
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

function BranchSelector({
  branches,
  selected,
  onSelect,
}: {
  branches: string[];
  selected: string;
  onSelect: (b: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-text-secondary hover:bg-background-secondary transition-colors"
      >
        <GitBranch className="w-3 h-3 shrink-0" />
        <span className="max-w-[120px] truncate">{selected}</span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 w-52 bg-background-primary border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <ScrollArea className="max-h-48">
            {branches.map((b) => (
              <button
                key={b}
                onClick={() => {
                  onSelect(b);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-background-secondary flex items-center justify-between gap-2"
              >
                <span className="truncate font-mono">{b}</span>
                {selected === b && <Check className="w-3 h-3 text-green-500 shrink-0" />}
              </button>
            ))}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}



export default function CopilotView() {
  const { currentModel } = useModelAndProvider();
  // activeTaskRun: the task currently being run by the agent (TaskRunView)
  const [activeTaskRun, setActiveTaskRun] = useState<Task | null>(null);
  const [activeGitHubOp, setActiveGitHubOp] = useState<ActiveGitHubOp | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(GITHUB_TOKEN_KEY));
  const [user, setUser] = useState<GitHubUser | null>(() => {
    const stored = localStorage.getItem(GITHUB_USER_KEY);
    return stored ? (JSON.parse(stored) as GitHubUser) : null;
  });
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceCode, setDeviceCode] = useState<{
    user_code: string;
    verification_uri: string;
    device_code: string;
  } | null>(null);
  const [pollStatus, setPollStatus] = useState<string | null>(null);
  const pollAbortRef = useRef<boolean>(false);
  const [patInput, setPatInput] = useState('');
  const [showPat, setShowPat] = useState(false);
  const [loadingPat, setLoadingPat] = useState(false);

  // GitHub App installation state
  const [appInstalled, setAppInstalled] = useState<boolean | null>(null);
  const [appSlug, setAppSlug] = useState<string | null>(null);

  // Bot-identity mode: credentials live in .env (GITHUB_APP_ID + key), never entered by user
  const [botAppId, setBotAppId] = useState<string | null>(null);
  const [botMode, setBotMode] = useState(false);

  const [mainTab, setMainTab] = useState<MainTab>('dashboard');
  const [taskTab, setTaskTab] = useState<TaskTab>('active');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(() => {
    const stored = localStorage.getItem(SELECTED_REPO_KEY);
    return stored ? (JSON.parse(stored) as GitHubRepo) : null;
  });

  const selectRepo = useCallback(
    (repo: GitHubRepo | null) => {
      setSelectedRepo(repo);
      setSelectedBranch('main');
      setBranches(['main']);
      if (repo) {
        localStorage.setItem(SELECTED_REPO_KEY, JSON.stringify(repo));
        if (token) {
          fetchBranches(token, repo.full_name).then((bs) => {
            setBranches(bs);
            // Use the repo's default branch if available
            const defaultBranch = bs.find((b) => b === 'main') ?? bs[0] ?? 'main';
            setSelectedBranch(defaultBranch);
          });
        }
      } else {
        localStorage.removeItem(SELECTED_REPO_KEY);
      }
    },
    [token]
  );
  const [taskInput, setTaskInput] = useState('');
  const [tasks, setTasks] = useState<Task[]>(() => {
    const stored = localStorage.getItem(TASKS_KEY);
    return stored ? (JSON.parse(stored) as Task[]) : [];
  });
  const [inputFocused, setInputFocused] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [branches, setBranches] = useState<string[]>(['main']);
  const [showModelModal, setShowModelModal] = useState(false);
  const setView = useNavigation();

  const saveTasks = useCallback((t: Task[]) => {
    setTasks(t);
    localStorage.setItem(TASKS_KEY, JSON.stringify(t));
  }, []);

  // On mount, check if GitHub App credentials are configured in .env
  useEffect(() => {
    window.electron.getGitHubAppConfig().then((config) => {
      if (config) {
        setBotAppId(config.appId);
        setBotMode(true);
      }
    });
  }, []);

  // Returns an installation token (bot identity) if configured, otherwise the user OAuth token.
  // All GitHub write operations go through this so attribution is always correct.
  const getApiToken = useCallback(
    async (repoOwner: string): Promise<string> => {
      if (botMode && botAppId) {
        const result = await window.electron.getGitHubInstallationToken(repoOwner);
        if ('token' in result) return result.token;
        // Fall back to user token silently — bot mode best-effort
      }
      if (!token) throw new Error('Not authenticated');
      return token;
    },
    [botMode, botAppId, token]
  );


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
      const [data, installations] = await Promise.all([
        fetchGitHubRepos(tok),
        fetchUserInstallations(tok),
      ]);
      setRepos(data);
      if (installations.length > 0) {
        setAppInstalled(true);
        setAppSlug(installations[0].app_slug);
      } else {
        setAppInstalled(false);
      }
      // Restore previously selected repo if it's still accessible
      setSelectedRepo((prev) => {
        if (!prev) return null;
        const stillExists = data.find((r) => r.id === prev.id);
        if (!stillExists) {
          localStorage.removeItem(SELECTED_REPO_KEY);
          return null;
        }
        // Fetch branches for the restored repo
        fetchBranches(tok, stillExists.full_name).then((bs) => {
          setBranches(bs);
          setSelectedBranch((b) => (bs.includes(b) ? b : (bs[0] ?? 'main')));
        });
        return stillExists;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('401') || msg.includes('Bad credentials') || msg.includes('Unauthorized')) {
        // Token expired — clear it and send user back to sign-in
        localStorage.removeItem(GITHUB_TOKEN_KEY);
        localStorage.removeItem(GITHUB_USER_KEY);
        setToken(null);
        setUser(null);
      }
      // Don't show raw API errors to the user
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  useEffect(() => {
    if (token && repos.length === 0 && !loadingRepos) {
      loadRepos(token);
    }
  }, [token, repos.length, loadingRepos, loadRepos]);

  const startDeviceFlow = async () => {
    // Abort any previous poll loop
    pollAbortRef.current = true;
    await new Promise((r) => setTimeout(r, 50));
    pollAbortRef.current = false;

    setLoadingAuth(true);
    setError(null);
    setDeviceCode(null);
    setPollStatus(null);
    try {
      const flow = await window.electron.startGitHubDeviceFlow();
      if ('error' in flow) throw new Error(flow.error);

      setDeviceCode({
        user_code: flow.user_code,
        verification_uri: flow.verification_uri,
        device_code: flow.device_code,
      });

      // Renderer-driven poll loop — lets us show live status per response
      let intervalSeconds = flow.interval ?? 5;
      const deadline = Date.now() + 10 * 60 * 1000;

      while (Date.now() < deadline) {
        if (pollAbortRef.current) return;

        setPollStatus(`Checking… (next in ${intervalSeconds}s)`);
        await new Promise((r) => setTimeout(r, intervalSeconds * 1000));

        if (pollAbortRef.current) return;

        const data = await window.electron.pollGitHubDeviceTokenOnce(flow.device_code);

        if (data.access_token) {
          setPollStatus('Authorized! Loading your profile…');
          let githubUser: GitHubUser;
          try {
            githubUser = await fetchGitHubUser(data.access_token);
          } catch {
            githubUser = { login: 'github-user', name: null, avatar_url: '', html_url: '' };
          }
          localStorage.setItem(GITHUB_TOKEN_KEY, data.access_token);
          localStorage.setItem(GITHUB_USER_KEY, JSON.stringify(githubUser));
          setToken(data.access_token);
          setUser(githubUser);
          setDeviceCode(null);
          setPollStatus(null);
          await loadRepos(data.access_token);
          return;
        }

        if (data.error === 'slow_down') {
          intervalSeconds = data.interval ?? intervalSeconds + 5;
          setPollStatus(`GitHub rate limit — waiting ${intervalSeconds}s before next check…`);
          continue;
        }

        if (data.error === 'authorization_pending') {
          setPollStatus('Waiting for you to authorize in the browser…');
          continue;
        }

        if (data.error === 'network_error') {
          // Transient — keep trying
          continue;
        }

        throw new Error(data.error_description || data.error || 'Authentication failed');
      }

      throw new Error('Timed out after 10 minutes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setDeviceCode(null);
      setPollStatus(null);
    } finally {
      setLoadingAuth(false);
    }
  };

  const signInWithPat = async () => {
    const pat = patInput.trim();
    if (!pat) return;
    setLoadingPat(true);
    setError(null);
    try {
      let githubUser: GitHubUser;
      try {
        githubUser = await fetchGitHubUser(pat);
      } catch {
        githubUser = { login: 'github-user', name: null, avatar_url: '', html_url: '' };
      }
      localStorage.setItem(GITHUB_TOKEN_KEY, pat);
      localStorage.setItem(GITHUB_USER_KEY, JSON.stringify(githubUser));
      setToken(pat);
      setUser(githubUser);
      setPatInput('');
      setShowPat(false);
      await loadRepos(pat);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid token');
    } finally {
      setLoadingPat(false);
    }
  };

  const createTask = useCallback(() => {
    if (!taskInput.trim() || !selectedRepo) return;

    const taskText = taskInput.trim();
    const repoOwner = selectedRepo.owner.login;
    const newTask: Task = {
      id: Date.now().toString(),
      title: taskText,
      repo: selectedRepo.full_name,
      repoUrl: selectedRepo.html_url,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
    };

    setTaskInput('');

    const { opType, suggestedTitle } = detectGitHubOp(taskText);

    if (opType !== 'agent') {
      if (opType === 'create_issue') {
        saveTasks([newTask, ...tasks]);
        setActiveGitHubOp({ task: newTask, opType, suggestedTitle, running: true });
        getApiToken(repoOwner)
          .then((apiToken) => githubCreateIssue(apiToken, selectedRepo.full_name, suggestedTitle, ''))
          .then((issue) => {
            const updatedTask = { ...newTask, status: 'open' as TaskStatus, prUrl: issue.html_url, prNumber: issue.number };
            saveTasks([updatedTask, ...tasks.filter((t) => t.id !== newTask.id)]);
            setActiveGitHubOp((prev) => prev && { ...prev, result: issue, running: false });
          })
          .catch((err) => {
            saveTasks(tasks.filter((t) => t.id !== newTask.id));
            setActiveGitHubOp((prev) => prev && { ...prev, running: false, error: err instanceof Error ? err.message : 'Failed to create issue' });
          });
      } else if (opType === 'list_issues') {
        saveTasks([newTask, ...tasks]);
        setActiveGitHubOp({ task: newTask, opType, suggestedTitle, running: true });
        saveTasks(tasks.filter((t) => t.id !== newTask.id));
        getApiToken(repoOwner)
          .then((apiToken) => fetchGitHubIssues(apiToken, selectedRepo.full_name))
          .then((issues) => {
            setActiveGitHubOp((prev) => prev && { ...prev, issues, running: false });
          })
          .catch((err) => {
            setActiveGitHubOp((prev) => prev && { ...prev, running: false, error: err instanceof Error ? err.message : 'Failed to load issues' });
          });
      }
      return;
    }

    // Goose agent for complex tasks — open the TaskRunView directly
    saveTasks([newTask, ...tasks]);
    setActiveTaskRun(newTask);
  }, [taskInput, selectedRepo, tasks, saveTasks, getApiToken]);

  const activeTasks = tasks.filter(
    (t) => t.status === 'in_progress' || t.status === 'open' || t.status === 'review'
  );
  const archivedTasks = tasks.filter((t) => t.status === 'merged' || t.status === 'closed');
  const SUGGESTED_TASK_TEMPLATES = [
    'Review open pull requests and post a summary',
    'Find and fix failing tests, then open a PR',
    'Audit dependencies for security vulnerabilities',
    'Improve error handling and add better logging',
    'Write missing unit tests for core modules',
  ];
  const suggestedTasks: Task[] = repos.slice(0, 3).flatMap((r, ri) => [
    {
      id: `suggested-${r.id}`,
      title: SUGGESTED_TASK_TEMPLATES[ri % SUGGESTED_TASK_TEMPLATES.length],
      repo: r.full_name,
      repoUrl: r.html_url,
      status: 'open' as TaskStatus,
      createdAt: r.updated_at,
    },
  ]);

  const displayedTasks =
    taskTab === 'active' ? activeTasks : taskTab === 'archived' ? archivedTasks : suggestedTasks;

  // ─── Direct GitHub operation view (no Goose agent) ───────────────────────
  if (activeGitHubOp) {
    const { task: opTask, opType, result, error, running } = activeGitHubOp;

    const handleBack = () => {
      if (!result) {
        // cancelled — remove in-progress task
        saveTasks(tasks.filter((t) => t.id !== opTask.id));
      }
      setActiveGitHubOp(null);
    };

    return (
      <MainPanelLayout>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
            <Button variant="ghost" size="sm" onClick={handleBack} className="p-1.5 h-auto">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-text-primary">{opTask.title}</p>
              <p className="text-xs text-text-secondary flex items-center gap-1">
                <Github className="w-3 h-3" />
                {opTask.repo}
              </p>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 max-w-xl mx-auto">
              {opType === 'create_issue' && running && (
                <div className="flex flex-col items-center gap-3 py-12 text-sm text-text-secondary">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Creating issue…
                </div>
              )}
              {opType === 'create_issue' && !running && error && (
                <div className="flex flex-col gap-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                  {(error.includes('not accessible') || error.includes('403')) && (
                    <div className="pl-6 flex flex-col gap-2">
                      <p className="text-xs opacity-80">
                        Your GitHub App is not installed on this repository. You need to{' '}
                        <strong>install</strong> it (not just authorize it) before it can create issues or PRs.
                      </p>
                      <Button
                        size="sm"
                        className="h-7 w-fit text-xs bg-red-600 hover:bg-red-700 text-white"
                        onClick={() =>
                          window.electron.openExternal(
                            appSlug
                              ? `https://github.com/apps/${appSlug}/installations/new`
                              : 'https://github.com/settings/installations'
                          )
                        }
                      >
                        Install GitHub App →
                      </Button>
                      <p className="text-xs opacity-70">
                        After installing, come back and try again. No need to sign out.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {opType === 'create_issue' && result && (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-text-primary">Issue created!</p>
                    <p className="text-sm text-text-secondary mt-1">
                      #{result.number} · {result.title}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.electron.openExternal(result.html_url)}
                    className="gap-2"
                  >
                    <Github className="w-4 h-4" />
                    View on GitHub
                  </Button>
                </div>
              )}
              {opType === 'list_issues' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Github className="w-4 h-4" />
                    <span>
                      Open issues in{' '}
                      <span className="font-medium text-text-primary">{opTask.repo}</span>
                    </span>
                  </div>
                  {running && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary py-8 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading issues…
                    </div>
                  )}
                  {error && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      {error}
                    </div>
                  )}
                  {!running && !error && activeGitHubOp?.issues && (
                    activeGitHubOp.issues.length === 0 ? (
                      <p className="text-sm text-text-secondary text-center py-8">No open issues.</p>
                    ) : (
                      <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                        {activeGitHubOp.issues.map((issue) => (
                          <button
                            key={issue.number}
                            onClick={() => window.electron.openExternal(issue.html_url)}
                            className="w-full text-left px-4 py-3 hover:bg-background-secondary transition-colors flex items-start gap-3"
                          >
                            <GitPullRequest className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-primary truncate">
                                {issue.title}
                              </p>
                              <p className="text-xs text-text-secondary mt-0.5">
                                #{issue.number}
                              </p>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-text-secondary mt-0.5 shrink-0" />
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </MainPanelLayout>
    );
  }

  if (activeTaskRun && selectedRepo && token) {
    return (
      <TaskRunView
        task={activeTaskRun}
        userToken={token}
        botMode={botMode}
        botAppId={botAppId ?? undefined}
        repo={selectedRepo}
        branch={selectedBranch}
        onBack={() => setActiveTaskRun(null)}
        onTaskUpdate={(updates) => {
          setActiveTaskRun((prev) => (prev ? { ...prev, ...updates } : prev));
          saveTasks(
            tasks.map((t) =>
              t.id === activeTaskRun.id ? { ...t, ...updates } : t
            )
          );
        }}
      />
    );
  }

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

          {deviceCode ? (
            <div className="flex flex-col items-center gap-3 w-full max-w-sm">
              <p className="text-sm text-text-secondary text-center">
                Enter this code at{' '}
                <button
                  className="underline text-text-primary"
                  onClick={() => window.electron.openExternal(deviceCode.verification_uri)}
                >
                  {deviceCode.verification_uri}
                </button>
              </p>
              <div className="flex items-center gap-2 px-6 py-3 bg-background-secondary border border-border rounded-xl">
                <span className="font-mono text-2xl font-bold tracking-widest text-text-primary select-all">
                  {deviceCode.user_code}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {pollStatus ?? 'Waiting for you to authorize in the browser…'}
              </div>
            </div>
          ) : showPat ? (
            <div className="flex flex-col gap-3 w-full max-w-sm">
              <p className="text-xs text-text-secondary text-center">
                Create a token at{' '}
                <button
                  className="underline text-text-primary"
                  onClick={() =>
                    window.electron.openExternal(
                      'https://github.com/settings/tokens/new?scopes=repo,read:user&description=Goose'
                    )
                  }
                >
                  github.com/settings/tokens
                </button>{' '}
                with <code className="text-xs bg-background-secondary px-1 rounded">repo</code>{' '}
                scope, then paste it below.
              </p>
              <input
                type="password"
                value={patInput}
                onChange={(e) => setPatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && signInWithPat()}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full text-sm px-3 py-2 bg-background-secondary border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-border font-mono"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowPat(false);
                    setPatInput('');
                    setError(null);
                  }}
                  className="flex-1 text-xs"
                >
                  Back
                </Button>
                <Button
                  onClick={signInWithPat}
                  disabled={!patInput.trim() || loadingPat}
                  size="sm"
                  className="flex-1 text-xs flex items-center gap-1.5"
                >
                  {loadingPat && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Connect
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <Button
                onClick={startDeviceFlow}
                disabled={loadingAuth}
                className="w-full flex items-center justify-center gap-2"
              >
                {loadingAuth ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Github className="w-4 h-4" />
                )}
                {loadingAuth ? 'Starting…' : 'Sign in with GitHub'}
              </Button>
              <div className="flex items-center gap-2 w-full">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text-secondary">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPat(true);
                  setError(null);
                }}
                className="w-full flex items-center justify-center gap-2 text-sm"
              >
                <Key className="w-4 h-4" />
                Use a Personal Access Token
              </Button>
            </div>
          )}
        </div>
      </MainPanelLayout>
    );
  }

  return (
    <MainPanelLayout>
      {showModelModal && (
        <SwitchModelModal
          sessionId={null}
          onClose={() => setShowModelModal(false)}
          setView={setView}
          onModelSelected={() => setShowModelModal(false)}
        />
      )}
      <div className="flex flex-col h-full min-h-0">
        {/* Top nav tabs */}
        <div className="flex items-center justify-between px-6 pt-12 pb-0 border-b border-border">
          <div className="flex items-center gap-0">
            {(['dashboard', 'integrations', 'automation', 'insights', 'settings'] as MainTab[]).map(
              (tab) => (
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
              )
            )}
          </div>
          <div className="flex items-center gap-2 pb-2">
            {currentModel && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full bg-background-secondary border border-border text-text-secondary font-mono truncate max-w-[120px]"
                title={currentModel}
              >
                {currentModel}
              </span>
            )}
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

            {/* GitHub App not installed warning */}
            {appInstalled === false && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    GitHub App not installed on any repository
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Authorization alone isn't enough — you need to <strong>install</strong> your GitHub App on
                    the repos you want Goose to access. This is what lets it create issues, push code, and open PRs.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() =>
                        window.electron.openExternal(
                          appSlug
                            ? `https://github.com/apps/${appSlug}/installations/new`
                            : 'https://github.com/settings/installations'
                        )
                      }
                    >
                      Install GitHub App
                    </Button>
                    <button
                      className="text-xs underline text-amber-700 dark:text-amber-400"
                      onClick={() => loadRepos(token!)}
                    >
                      Re-check
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Task creation card — styled like ChatInput */}
            <div
              className={`rounded-2xl border bg-background-primary transition-colors ${
                inputFocused ? 'border-blue-500/70' : 'border-border'
              }`}
            >
              <textarea
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && taskInput.trim() && selectedRepo) {
                    e.preventDefault();
                    createTask();
                  }
                }}
                placeholder={
                  selectedRepo
                    ? `What should Goose do in ${selectedRepo.name}? e.g. "Fix the login bug and open a PR", "Review PR #42", "Create a new auth module"`
                    : 'Select a repository below, then describe a task for Goose…'
                }
                rows={3}
                className="w-full text-sm bg-transparent resize-none focus:outline-none px-4 pt-4 pb-2 placeholder:text-text-secondary/50"
              />
              {/* Bottom bar */}
              <div className="flex items-center gap-1 px-3 pb-3">
                {/* Repo selector */}
                <RepoSelector
                  repos={repos}
                  selected={selectedRepo}
                  onSelect={selectRepo}
                  loading={loadingRepos}
                />
                {/* Branch selector */}
                {selectedRepo && (
                  <BranchSelector
                    branches={branches}
                    selected={selectedBranch}
                    onSelect={setSelectedBranch}
                  />
                )}
                {/* Model pill — click to change */}
                {currentModel && (
                  <button
                    onClick={() => setShowModelModal(true)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-text-secondary hover:bg-background-secondary transition-colors max-w-[160px]"
                    title="Change model"
                  >
                    <span className="text-[10px]">A✳︎</span>
                    <span className="truncate">{currentModel}</span>
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  </button>
                )}
                {/* Send button */}
                <button
                  onClick={createTask}
                  disabled={!taskInput.trim() || !selectedRepo}
                  className="ml-auto w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-text-primary text-background-primary disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
                  title="Start task"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick suggestion chips */}
            {selectedRepo && !taskInput && (
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Review open PRs',
                  'Fix failing tests and create a PR',
                  'Create a new issue',
                  'List open issues',
                  'Refactor for better readability',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setTaskInput(suggestion)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border text-text-secondary hover:text-text-primary hover:bg-background-secondary transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

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
                          <div className="flex items-center gap-2">
                            <StatusBadge status={task.status} />
                            {task.id.startsWith('suggested-') ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-2.5"
                                onClick={() => {
                                  selectRepo(repos.find((r) => r.full_name === task.repo) ?? null);
                                  setTaskInput(task.title);
                                  setTaskTab('active');
                                }}
                              >
                                Use This
                              </Button>
                            ) : task.prUrl ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-2.5 gap-1"
                                onClick={() => window.electron.openExternal(task.prUrl!)}
                              >
                                <ArrowRight className="w-3 h-3" />
                                View PR
                              </Button>
                            ) : task.status === 'in_progress' && selectedRepo ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-2.5"
                                onClick={() => setActiveTaskRun(task)}
                              >
                                View Task
                              </Button>
                            ) : null}
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

        {/* Automation tab */}
        {mainTab === 'automation' && (
          <div className="flex flex-col flex-1 min-h-0 px-6 py-5 gap-4">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">Automation</h1>
              <p className="text-sm text-text-secondary mt-0.5">
                Trigger Goose automatically on GitHub events
              </p>
            </div>

            {/* PR Review trigger */}
            <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center shrink-0">
                  <GitPullRequest className="w-5 h-5 text-text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">Auto-review on PR open</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Goose posts a code review comment whenever a pull request is opened or updated
                    in the selected repository.
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium shrink-0">
                  Coming soon
                </span>
              </div>

              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center shrink-0">
                  <GitMerge className="w-5 h-5 text-text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">Auto-merge on approval</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Automatically merge PRs once Goose's review passes and all checks are green.
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium shrink-0">
                  Coming soon
                </span>
              </div>

              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5 text-text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">Issue triage</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Goose labels and responds to new issues with an initial triage summary.
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium shrink-0">
                  Coming soon
                </span>
              </div>
            </div>

            {/* Webhook setup hint */}
            <div className="border border-dashed border-border rounded-xl p-5 flex flex-col gap-2">
              <p className="text-sm font-medium text-text-primary flex items-center gap-2">
                <Settings className="w-4 h-4 text-text-secondary" />
                How to enable automations
              </p>
              <ol className="text-xs text-text-secondary space-y-1 list-decimal list-inside">
                <li>
                  Go to your GitHub App settings and add a webhook URL pointing to your Goose
                  server.
                </li>
                <li>Select the events you want to trigger (Pull requests, Issues, etc.).</li>
                <li>Goose will listen and respond automatically whenever those events fire.</li>
              </ol>
              <button
                onClick={() => window.electron.openExternal('https://github.com/settings/apps')}
                className="mt-1 text-xs text-blue-500 hover:underline self-start"
              >
                Open GitHub App settings →
              </button>
            </div>
          </div>
        )}

        {/* Insights tab */}
        {mainTab === 'insights' && (
          <div className="flex flex-col flex-1 min-h-0 px-6 py-5 gap-5">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">Insights</h1>
              <p className="text-sm text-text-secondary mt-0.5">
                Activity and metrics across your repositories
              </p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-border rounded-xl p-4 flex flex-col gap-1">
                <p className="text-[10px] uppercase tracking-widest text-text-secondary font-semibold">
                  Tasks created
                </p>
                <p className="text-3xl font-semibold text-text-primary">{tasks.length}</p>
                <p className="text-xs text-text-secondary">all time</p>
              </div>
              <div className="border border-border rounded-xl p-4 flex flex-col gap-1">
                <p className="text-[10px] uppercase tracking-widest text-text-secondary font-semibold">
                  Active
                </p>
                <p className="text-3xl font-semibold text-green-600">
                  {
                    tasks.filter(
                      (t) =>
                        t.status === 'in_progress' || t.status === 'open' || t.status === 'review'
                    ).length
                  }
                </p>
                <p className="text-xs text-text-secondary">in progress or open</p>
              </div>
              <div className="border border-border rounded-xl p-4 flex flex-col gap-1">
                <p className="text-[10px] uppercase tracking-widest text-text-secondary font-semibold">
                  Completed
                </p>
                <p className="text-3xl font-semibold text-purple-600">
                  {tasks.filter((t) => t.status === 'merged').length}
                </p>
                <p className="text-xs text-text-secondary">merged</p>
              </div>
            </div>

            {/* Repos worked on */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium text-text-primary">Repositories worked on</p>
              </div>
              {(() => {
                const repoCounts = tasks.reduce<Record<string, { count: number; repoUrl: string }>>(
                  (acc, t) => {
                    acc[t.repo] = { count: (acc[t.repo]?.count ?? 0) + 1, repoUrl: t.repoUrl };
                    return acc;
                  },
                  {}
                );
                const sorted = Object.entries(repoCounts).sort((a, b) => b[1].count - a[1].count);
                if (sorted.length === 0) {
                  return (
                    <div className="px-4 py-8 text-center text-xs text-text-secondary">
                      No tasks yet — create one from the dashboard.
                    </div>
                  );
                }
                return sorted.map(([repo, { count, repoUrl }]) => (
                  <div
                    key={repo}
                    className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-background-secondary transition-colors"
                  >
                    <Github className="w-4 h-4 text-text-secondary shrink-0" />
                    <button
                      onClick={() => window.electron.openExternal(repoUrl)}
                      className="flex-1 text-sm text-text-primary text-left hover:underline truncate"
                    >
                      {repo}
                    </button>
                    <span className="text-xs text-text-secondary shrink-0">
                      {count} task{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ));
              })()}
            </div>

            {/* Status breakdown */}
            {tasks.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-medium text-text-primary">Status breakdown</p>
                </div>
                <div className="p-4 space-y-3">
                  {(
                    [
                      { label: 'In Progress', key: 'in_progress', color: 'bg-blue-500' },
                      { label: 'Open', key: 'open', color: 'bg-green-500' },
                      { label: 'In Review', key: 'review', color: 'bg-yellow-500' },
                      { label: 'Merged', key: 'merged', color: 'bg-purple-500' },
                      { label: 'Closed', key: 'closed', color: 'bg-gray-400' },
                    ] as { label: string; key: TaskStatus; color: string }[]
                  ).map(({ label, key, color }) => {
                    const count = tasks.filter((t) => t.status === key).length;
                    const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
                    if (count === 0) return null;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <p className="text-xs text-text-secondary w-20 shrink-0">{label}</p>
                        <div className="flex-1 h-2 bg-background-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${color}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-text-secondary w-8 text-right shrink-0">
                          {count}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Connected repo */}
            {selectedRepo && (
              <div className="border border-border rounded-xl p-4 flex items-center gap-3">
                <Github className="w-4 h-4 text-text-secondary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-secondary">Active repository</p>
                  <button
                    onClick={() => window.electron.openExternal(selectedRepo.html_url)}
                    className="text-sm font-medium text-text-primary hover:underline truncate block"
                  >
                    {selectedRepo.full_name}
                  </button>
                </div>
                <div className="flex items-center gap-1 text-xs text-text-secondary">
                  <GitBranch className="w-3.5 h-3.5" />
                  {selectedBranch}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings tab */}
        {mainTab === 'settings' && (
          <ScrollArea className="flex-1">
            <div className="flex flex-col px-6 py-5 gap-6 max-w-2xl">
              <div>
                <h1 className="text-xl font-semibold text-text-primary mb-1">Settings</h1>
                <p className="text-sm text-text-secondary">Manage your Copilot preferences</p>
              </div>

              {/* ── GitHub Account ─────────────────────────────────────── */}
              <div className="border border-border rounded-xl divide-y divide-border">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Github className="w-5 h-5 text-text-secondary" />
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
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-text-secondary" />
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

              {/* ── GitHub App — Bot Identity ───────────────────────────── */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-background-secondary border-b border-border flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Puzzle className="w-4 h-4" />
                      GitHub App — Bot Identity
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Actions appear as <code className="bg-background-primary px-1 rounded">{appSlug ?? 'your-app'}[bot]</code> — like Cursor, Tembo, and Claude Code Review
                    </p>
                  </div>
                  {botMode
                    ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium"><Check className="w-3 h-3" /> Active</span>
                    : <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 font-medium">Not configured</span>
                  }
                </div>

                <div className="p-4">
                  {botMode && botAppId ? (
                    <div className="space-y-1">
                      <p className="text-sm text-text-primary">App ID: <code className="text-text-secondary">{botAppId}</code></p>
                      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        All actions show as <strong>{appSlug ?? 'goose-copilot'}[bot]</strong>
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-text-secondary">
                      Set <code className="bg-background-secondary px-1 rounded">GITHUB_APP_ID</code> and{' '}
                      <code className="bg-background-secondary px-1 rounded">GITHUB_APP_PRIVATE_KEY_PATH</code> in your{' '}
                      <code className="bg-background-secondary px-1 rounded">.env</code> file to enable bot identity.
                      Actions currently show as <strong>@{user?.login}</strong>.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </div>
    </MainPanelLayout>
  );
}
