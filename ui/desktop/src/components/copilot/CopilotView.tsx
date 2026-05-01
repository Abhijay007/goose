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
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { MainPanelLayout } from '../Layout/MainPanelLayout';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { useModelAndProvider } from '../ModelAndProviderContext';
import { SwitchModelModal } from '../settings/models/subcomponents/SwitchModelModal';
import { useNavigation } from '../../hooks/useNavigation';
import { defineMessages, useIntl } from '../../i18n';
import { errorMessage } from '../../utils/conversionUtils';
import TaskRunView from './TaskRunView';
import {
  githubCreateIssue,
  fetchGitHubIssues,
  fetchUserInstallations,
  fetchBranches,
  fetchGitHubRepos,
} from './github';
import type {
  TaskStatus,
  TaskTab,
  MainTab,
  GitHubOpType,
  GitHubUser,
  GitHubRepo,
  Task,
  ActiveGitHubOp,
} from './types';

const i18n = defineMessages({
  // StatusBadge
  statusMerged: { id: 'copilotView.statusMerged', defaultMessage: 'Merged' },
  statusOpen: { id: 'copilotView.statusOpen', defaultMessage: 'Open' },
  statusInReview: { id: 'copilotView.statusInReview', defaultMessage: 'In Review' },
  statusInProgress: { id: 'copilotView.statusInProgress', defaultMessage: 'In Progress' },
  statusClosed: { id: 'copilotView.statusClosed', defaultMessage: 'Closed' },
  // RepoSelector
  loadingRepos: { id: 'copilotView.loadingRepos', defaultMessage: 'Loading repos\u2026' },
  selectRepositories: {
    id: 'copilotView.selectRepositories',
    defaultMessage: 'Select repositories',
  },
  searchRepositoriesPlaceholder: {
    id: 'copilotView.searchRepositoriesPlaceholder',
    defaultMessage: 'Search repositories\u2026',
  },
  noReposFound: { id: 'copilotView.noReposFound', defaultMessage: 'No repos found' },
  clearSelection: { id: 'copilotView.clearSelection', defaultMessage: 'Clear selection' },
  // Auth screen
  connectGitHub: { id: 'copilotView.connectGitHub', defaultMessage: 'Connect GitHub' },
  signInDescription: {
    id: 'copilotView.signInDescription',
    defaultMessage: 'Sign in to manage repositories, create PRs, and review code with Goose.',
  },
  waitingForAuthorization: {
    id: 'copilotView.waitingForAuthorization',
    defaultMessage: 'Waiting for GitHub authorization\u2026',
  },
  cancel: { id: 'copilotView.cancel', defaultMessage: 'Cancel' },
  signInWithGitHub: { id: 'copilotView.signInWithGitHub', defaultMessage: 'Sign in with GitHub' },
  // GitHub op views
  creatingIssue: { id: 'copilotView.creatingIssue', defaultMessage: 'Creating issue\u2026' },
  appNotInstalledHint: {
    id: 'copilotView.appNotInstalledHint',
    defaultMessage:
      'Your GitHub App is not installed on this repository. You need to install it (not just authorize it) before it can create issues or PRs.',
  },
  installGitHubApp: { id: 'copilotView.installGitHubApp', defaultMessage: 'Install GitHub App' },
  installGitHubAppArrow: {
    id: 'copilotView.installGitHubAppArrow',
    defaultMessage: 'Install GitHub App \u2192',
  },
  afterInstallingNote: {
    id: 'copilotView.afterInstallingNote',
    defaultMessage: 'After installing, come back and try again. No need to sign out.',
  },
  issueCreated: { id: 'copilotView.issueCreated', defaultMessage: 'Issue created!' },
  viewOnGitHub: { id: 'copilotView.viewOnGitHub', defaultMessage: 'View on GitHub' },
  openIssuesIn: { id: 'copilotView.openIssuesIn', defaultMessage: 'Open issues in' },
  loadingIssues: { id: 'copilotView.loadingIssues', defaultMessage: 'Loading issues\u2026' },
  noOpenIssues: { id: 'copilotView.noOpenIssues', defaultMessage: 'No open issues.' },
  // App-not-installed warning banner
  appNotInstalledTitle: {
    id: 'copilotView.appNotInstalledTitle',
    defaultMessage: 'GitHub App not installed on any repository',
  },
  appNotInstalledBody: {
    id: 'copilotView.appNotInstalledBody',
    defaultMessage:
      'Authorization alone isn\u2019t enough \u2014 you need to install your GitHub App on the repos you want Goose to access. This is what lets it create issues, push code, and open PRs.',
  },
  recheck: { id: 'copilotView.recheck', defaultMessage: 'Re-check' },
  // Dashboard
  overviewTitle: { id: 'copilotView.overviewTitle', defaultMessage: 'Overview' },
  overviewDescription: {
    id: 'copilotView.overviewDescription',
    defaultMessage: 'Your most recent and/or active tasks',
  },
  addIntegration: { id: 'copilotView.addIntegration', defaultMessage: 'Add Integration' },
  taskPlaceholderRepo: {
    id: 'copilotView.taskPlaceholderRepo',
    defaultMessage:
      'What should Goose do in {repo}? e.g. "Fix the login bug and open a PR", "Review PR #42", "Create a new auth module"',
  },
  taskPlaceholderNoRepo: {
    id: 'copilotView.taskPlaceholderNoRepo',
    defaultMessage: 'Select a repository below, then describe a task for Goose\u2026',
  },
  noActiveTasks: {
    id: 'copilotView.noActiveTasks',
    defaultMessage: 'No active tasks yet. Create one above!',
  },
  noArchivedTasks: { id: 'copilotView.noArchivedTasks', defaultMessage: 'No archived tasks' },
  noSuggestions: { id: 'copilotView.noSuggestions', defaultMessage: 'No suggestions available' },
  today: { id: 'copilotView.today', defaultMessage: 'Today' },
  useThis: { id: 'copilotView.useThis', defaultMessage: 'Use This' },
  viewPR: { id: 'copilotView.viewPR', defaultMessage: 'View PR' },
  viewTask: { id: 'copilotView.viewTask', defaultMessage: 'View Task' },
  // Integrations tab
  integrationsTitle: { id: 'copilotView.integrationsTitle', defaultMessage: 'Integrations' },
  integrationsDescription: {
    id: 'copilotView.integrationsDescription',
    defaultMessage: 'Connect tools to enhance Goose\u2019s capabilities',
  },
  connected: { id: 'copilotView.connected', defaultMessage: 'Connected' },
  connectedAs: { id: 'copilotView.connectedAs', defaultMessage: 'Connected as @{login}' },
  moreIntegrationsSoon: {
    id: 'copilotView.moreIntegrationsSoon',
    defaultMessage: 'More integrations coming soon',
  },
  // Automation tab
  automationTitle: { id: 'copilotView.automationTitle', defaultMessage: 'Automation' },
  automationDescription: {
    id: 'copilotView.automationDescription',
    defaultMessage: 'Trigger Goose automatically on GitHub events',
  },
  autoReviewTitle: { id: 'copilotView.autoReviewTitle', defaultMessage: 'Auto-review on PR open' },
  autoReviewDescription: {
    id: 'copilotView.autoReviewDescription',
    defaultMessage:
      'Goose posts a code review comment whenever a pull request is opened or updated in the selected repository.',
  },
  autoMergeTitle: { id: 'copilotView.autoMergeTitle', defaultMessage: 'Auto-merge on approval' },
  autoMergeDescription: {
    id: 'copilotView.autoMergeDescription',
    defaultMessage:
      'Automatically merge PRs once Goose\u2019s review passes and all checks are green.',
  },
  issueTriageTitle: { id: 'copilotView.issueTriageTitle', defaultMessage: 'Issue triage' },
  issueTriageDescription: {
    id: 'copilotView.issueTriageDescription',
    defaultMessage: 'Goose labels and responds to new issues with an initial triage summary.',
  },
  comingSoon: { id: 'copilotView.comingSoon', defaultMessage: 'Coming soon' },
  howToEnableTitle: {
    id: 'copilotView.howToEnableTitle',
    defaultMessage: 'How to enable automations',
  },
  howToEnableStep1: {
    id: 'copilotView.howToEnableStep1',
    defaultMessage:
      'Go to your GitHub App settings and add a webhook URL pointing to your Goose server.',
  },
  howToEnableStep2: {
    id: 'copilotView.howToEnableStep2',
    defaultMessage: 'Select the events you want to trigger (Pull requests, Issues, etc.).',
  },
  howToEnableStep3: {
    id: 'copilotView.howToEnableStep3',
    defaultMessage: 'Goose will listen and respond automatically whenever those events fire.',
  },
  openGitHubAppSettings: {
    id: 'copilotView.openGitHubAppSettings',
    defaultMessage: 'Open GitHub App settings \u2192',
  },
  // Insights tab
  insightsTitle: { id: 'copilotView.insightsTitle', defaultMessage: 'Insights' },
  insightsDescription: {
    id: 'copilotView.insightsDescription',
    defaultMessage: 'Activity and metrics across your repositories',
  },
  tasksCreated: { id: 'copilotView.tasksCreated', defaultMessage: 'Tasks created' },
  allTime: { id: 'copilotView.allTime', defaultMessage: 'all time' },
  activeLabel: { id: 'copilotView.activeLabel', defaultMessage: 'Active' },
  inProgressOrOpen: { id: 'copilotView.inProgressOrOpen', defaultMessage: 'in progress or open' },
  completedLabel: { id: 'copilotView.completedLabel', defaultMessage: 'Completed' },
  mergedLabel: { id: 'copilotView.mergedLabel', defaultMessage: 'merged' },
  repositoriesWorkedOn: {
    id: 'copilotView.repositoriesWorkedOn',
    defaultMessage: 'Repositories worked on',
  },
  noTasksYet: {
    id: 'copilotView.noTasksYet',
    defaultMessage: 'No tasks yet \u2014 create one from the dashboard.',
  },
  taskCount: {
    id: 'copilotView.taskCount',
    defaultMessage: '{count, plural, one {# task} other {# tasks}}',
  },
  statusBreakdown: { id: 'copilotView.statusBreakdown', defaultMessage: 'Status breakdown' },
  activeRepository: { id: 'copilotView.activeRepository', defaultMessage: 'Active repository' },
  // Settings tab
  settingsTitle: { id: 'copilotView.settingsTitle', defaultMessage: 'Settings' },
  settingsDescription: {
    id: 'copilotView.settingsDescription',
    defaultMessage: 'Manage your Copilot preferences',
  },
  githubAccount: { id: 'copilotView.githubAccount', defaultMessage: 'GitHub Account' },
  signOut: { id: 'copilotView.signOut', defaultMessage: 'Sign out' },
  repositories: { id: 'copilotView.repositories', defaultMessage: 'Repositories' },
  reposLoaded: { id: 'copilotView.reposLoaded', defaultMessage: '{count} repos loaded' },
  refresh: { id: 'copilotView.refresh', defaultMessage: 'Refresh' },
  botIdentityTitle: {
    id: 'copilotView.botIdentityTitle',
    defaultMessage: 'GitHub App \u2014 Bot Identity',
  },
  botIdentityDescription: {
    id: 'copilotView.botIdentityDescription',
    defaultMessage:
      'Actions appear as {appSlug}[bot] \u2014 like Cursor, Tembo, and Claude Code Review',
  },
  botActive: { id: 'copilotView.botActive', defaultMessage: 'Active' },
  botNotConfigured: { id: 'copilotView.botNotConfigured', defaultMessage: 'Not configured' },
  botAppId: { id: 'copilotView.botAppId', defaultMessage: 'App ID: {appId}' },
  botActionsShowAs: {
    id: 'copilotView.botActionsShowAs',
    defaultMessage: 'All actions show as {appSlug}[bot]',
  },
  botSetupHint: {
    id: 'copilotView.botSetupHint',
    defaultMessage:
      'Set {appId} and {keyPath} in your {envFile} file to enable bot identity. Actions currently show as @{login}.',
  },
});

const GITHUB_TOKEN_KEY = 'copilot_github_token';
const GITHUB_USER_KEY = 'copilot_github_user';
const TASKS_KEY = 'copilot_tasks';
const SELECTED_REPO_KEY = 'copilot_selected_repo';

const SUGGESTED_TASK_TEMPLATES = [
  'Review open pull requests and post a summary',
  'Find and fix failing tests, then open a PR',
  'Audit dependencies for security vulnerabilities',
  'Improve error handling and add better logging',
  'Write missing unit tests for core modules',
];

function detectGitHubOp(task: string): { opType: GitHubOpType; suggestedTitle: string } {
  const t = task.trim();
  if (
    /^(create|open|add|file|make|new)\s+(a\s+)?(new\s+)?(github\s+)?(issue|bug report|ticket)[:\s-]*/i.test(
      t
    )
  ) {
    const suggestedTitle =
      t
        .replace(
          /^(create|open|add|file|make|new)\s+(a\s+)?(new\s+)?(github\s+)?(issue|bug report|ticket)[:\s-]*/i,
          ''
        )
        .trim() || t;
    return { opType: 'create_issue', suggestedTitle };
  }
  if (
    /^(list|show|get|fetch|display)\s+(all\s+|open\s+|closed\s+)?(issues?|bugs?|tickets?)/i.test(t)
  ) {
    return { opType: 'list_issues', suggestedTitle: t };
  }
  return { opType: 'agent', suggestedTitle: t };
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
  const intl = useIntl();
  if (status === 'merged')
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
        <GitMerge className="w-3 h-3" /> {intl.formatMessage(i18n.statusMerged)}
      </span>
    );
  if (status === 'open')
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
        <GitPullRequest className="w-3 h-3" /> {intl.formatMessage(i18n.statusOpen)}
      </span>
    );
  if (status === 'review')
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium">
        <Eye className="w-3 h-3" /> {intl.formatMessage(i18n.statusInReview)}
      </span>
    );
  if (status === 'in_progress')
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
        <Loader2 className="w-3 h-3 animate-spin" /> {intl.formatMessage(i18n.statusInProgress)}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium">
      <X className="w-3 h-3" /> {intl.formatMessage(i18n.statusClosed)}
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
  const intl = useIntl();
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

  const triggerLabel = loading
    ? intl.formatMessage(i18n.loadingRepos)
    : selected
      ? selected.full_name
      : intl.formatMessage(i18n.selectRepositories);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-border bg-background-primary hover:bg-background-secondary transition-colors"
      >
        <Github className="w-3.5 h-3.5 text-text-secondary" />
        <span className="text-text-secondary">{triggerLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-text-secondary" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-background-primary border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-border">
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={intl.formatMessage(i18n.searchRepositoriesPlaceholder)}
              className="h-8 text-sm"
            />
          </div>
          <ScrollArea className="max-h-56">
            {filtered.length === 0 ? (
              <p className="text-xs text-text-secondary text-center py-4">
                {intl.formatMessage(i18n.noReposFound)}
              </p>
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
                {intl.formatMessage(i18n.clearSelection)}
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
  const intl = useIntl();
  const { currentModel } = useModelAndProvider();
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
  const [waitingForBrowser, setWaitingForBrowser] = useState(false);

  const [appInstalled, setAppInstalled] = useState<boolean | null>(null);
  const [appSlug, setAppSlug] = useState<string | null>(null);
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
  const pendingAuthCallbackRef = useRef<((url: string) => void) | null>(null);
  const setView = useNavigation();

  const saveTasks = useCallback((t: Task[]) => {
    setTasks(t);
    localStorage.setItem(TASKS_KEY, JSON.stringify(t));
  }, []);

  useEffect(() => {
    window.electron.getGitHubAppConfig().then((config) => {
      if (config) {
        setBotAppId(config.appId);
        setBotMode(true);
      }
    });
  }, []);

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
      // /installation/repositories requires a valid installation token — success proves the app is
      // installed. /user/installations only works with user OAuth tokens, not installation tokens,
      // so it cannot be used to determine installation status here.
      const [data, installations] = await Promise.all([
        fetchGitHubRepos(tok),
        fetchUserInstallations(tok),
      ]);
      setRepos(data);
      setAppInstalled(true);
      if (installations.length > 0) {
        setAppSlug(installations[0].app_slug);
      }
      setSelectedRepo((prev) => {
        if (!prev) return null;
        const stillExists = data.find((r) => r.id === prev.id);
        if (!stillExists) {
          localStorage.removeItem(SELECTED_REPO_KEY);
          return null;
        }
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
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  useEffect(() => {
    if (token && repos.length === 0 && !loadingRepos) {
      loadRepos(token);
    }
  }, [token, repos.length, loadingRepos, loadRepos]);

  const signInWithGitHub = useCallback(async () => {
    setLoadingAuth(true);
    setError(null);
    setWaitingForBrowser(false);

    const result = await window.electron.startGitHubAppInstall();
    if ('error' in result) {
      setError(result.error);
      setLoadingAuth(false);
      return;
    }

    setWaitingForBrowser(true);

    // GitHub redirects to goose://github-auth?installation_id=XXX&setup_action=install
    const handleCallback = async (url: string) => {
      pendingAuthCallbackRef.current = null;
      window.electron.offGitHubAuthCallback(handleCallback);
      setWaitingForBrowser(false);
      try {
        const parsed = new URL(url);
        const installationIdStr = parsed.searchParams.get('installation_id');
        if (!installationIdStr) throw new Error('GitHub did not return an installation ID.');
        const installationId = parseInt(installationIdStr, 10);

        const accountResult = await window.electron.getGitHubInstallationAccount(installationId);
        if ('error' in accountResult) throw new Error(accountResult.error);

        const githubUser: GitHubUser = {
          login: accountResult.login,
          name: accountResult.login,
          avatar_url: accountResult.avatar_url,
          html_url: accountResult.html_url,
        };

        const tokenResult = await window.electron.getGitHubInstallationToken(accountResult.login);
        if ('error' in tokenResult) throw new Error(tokenResult.error);

        localStorage.setItem(GITHUB_TOKEN_KEY, tokenResult.token);
        localStorage.setItem(GITHUB_USER_KEY, JSON.stringify(githubUser));
        setToken(tokenResult.token);
        setUser(githubUser);
        await loadRepos(tokenResult.token);
      } catch (err) {
        setError(errorMessage(err, 'Authorization failed'));
      } finally {
        setLoadingAuth(false);
      }
    };

    pendingAuthCallbackRef.current = handleCallback;
    window.electron.onGitHubAuthCallback(handleCallback);
  }, [loadRepos]);

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
          .then((apiToken) =>
            githubCreateIssue(apiToken, selectedRepo.full_name, suggestedTitle, '')
          )
          .then((issue) => {
            const updatedTask = {
              ...newTask,
              status: 'open' as TaskStatus,
              prUrl: issue.html_url,
              prNumber: issue.number,
            };
            saveTasks([updatedTask, ...tasks.filter((t) => t.id !== newTask.id)]);
            setActiveGitHubOp((prev) => prev && { ...prev, result: issue, running: false });
          })
          .catch((err) => {
            saveTasks(tasks.filter((t) => t.id !== newTask.id));
            setActiveGitHubOp(
              (prev) =>
                prev && {
                  ...prev,
                  running: false,
                  error: errorMessage(err, 'Failed to create issue'),
                }
            );
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
            setActiveGitHubOp(
              (prev) =>
                prev && {
                  ...prev,
                  running: false,
                  error: errorMessage(err, 'Failed to load issues'),
                }
            );
          });
      }
      return;
    }

    saveTasks([newTask, ...tasks]);
    setActiveTaskRun(newTask);
  }, [taskInput, selectedRepo, tasks, saveTasks, getApiToken]);

  const activeTasks = tasks.filter(
    (t) => t.status === 'in_progress' || t.status === 'open' || t.status === 'review'
  );
  const archivedTasks = tasks.filter((t) => t.status === 'merged' || t.status === 'closed');
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

  if (activeGitHubOp) {
    const { task: opTask, opType, result, error, running } = activeGitHubOp;

    const handleBack = () => {
      if (!result) {
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
                  {intl.formatMessage(i18n.creatingIssue)}
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
                        {intl.formatMessage(i18n.appNotInstalledHint)}
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
                        {intl.formatMessage(i18n.installGitHubAppArrow)}
                      </Button>
                      <p className="text-xs opacity-70">
                        {intl.formatMessage(i18n.afterInstallingNote)}
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
                    <p className="text-base font-semibold text-text-primary">
                      {intl.formatMessage(i18n.issueCreated)}
                    </p>
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
                    {intl.formatMessage(i18n.viewOnGitHub)}
                  </Button>
                </div>
              )}
              {opType === 'list_issues' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Github className="w-4 h-4" />
                    <span>
                      {intl.formatMessage(i18n.openIssuesIn)}{' '}
                      <span className="font-medium text-text-primary">{opTask.repo}</span>
                    </span>
                  </div>
                  {running && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary py-8 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {intl.formatMessage(i18n.loadingIssues)}
                    </div>
                  )}
                  {error && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      {error}
                    </div>
                  )}
                  {!running &&
                    !error &&
                    activeGitHubOp?.issues &&
                    (activeGitHubOp.issues.length === 0 ? (
                      <p className="text-sm text-text-secondary text-center py-8">
                        {intl.formatMessage(i18n.noOpenIssues)}
                      </p>
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
                              <p className="text-xs text-text-secondary mt-0.5">#{issue.number}</p>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-text-secondary mt-0.5 shrink-0" />
                          </button>
                        ))}
                      </div>
                    ))}
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
          saveTasks(tasks.map((t) => (t.id === activeTaskRun.id ? { ...t, ...updates } : t)));
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
            <h2 className="text-2xl font-light text-text-primary">
              {intl.formatMessage(i18n.connectGitHub)}
            </h2>
            <p className="text-sm opacity-70 max-w-sm">
              {intl.formatMessage(i18n.signInDescription)}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg max-w-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            {waitingForBrowser ? (
              <div className="flex flex-col items-center gap-3 w-full">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {intl.formatMessage(i18n.waitingForAuthorization)}
                </div>
                <button
                  className="text-xs text-text-secondary underline"
                  onClick={() => {
                    if (pendingAuthCallbackRef.current) {
                      window.electron.offGitHubAuthCallback(pendingAuthCallbackRef.current);
                      pendingAuthCallbackRef.current = null;
                    }
                    setWaitingForBrowser(false);
                    setLoadingAuth(false);
                  }}
                >
                  {intl.formatMessage(i18n.cancel)}
                </button>
              </div>
            ) : (
              <Button
                onClick={signInWithGitHub}
                disabled={loadingAuth}
                className="w-full flex items-center justify-center gap-2"
              >
                {loadingAuth && !waitingForBrowser ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Github className="w-4 h-4" />
                )}
                {intl.formatMessage(i18n.signInWithGitHub)}
              </Button>
            )}
          </div>
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
                <h1 className="text-xl font-semibold text-text-primary">
                  {intl.formatMessage(i18n.overviewTitle)}
                </h1>
                <p className="text-sm text-text-secondary mt-0.5">
                  {intl.formatMessage(i18n.overviewDescription)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-xs"
                onClick={() => setMainTab('integrations')}
              >
                <Plus className="w-3.5 h-3.5" /> {intl.formatMessage(i18n.addIntegration)}
              </Button>
            </div>

            {/* GitHub App not installed warning */}
            {appInstalled === false && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    {intl.formatMessage(i18n.appNotInstalledTitle)}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    {intl.formatMessage(i18n.appNotInstalledBody)}
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
                      {intl.formatMessage(i18n.installGitHubApp)}
                    </Button>
                    <button
                      className="text-xs underline text-amber-700 dark:text-amber-400"
                      onClick={() => loadRepos(token!)}
                    >
                      {intl.formatMessage(i18n.recheck)}
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
                    ? intl.formatMessage(i18n.taskPlaceholderRepo, { repo: selectedRepo.name })
                    : intl.formatMessage(i18n.taskPlaceholderNoRepo)
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
                      ? intl.formatMessage(i18n.noActiveTasks)
                      : taskTab === 'archived'
                        ? intl.formatMessage(i18n.noArchivedTasks)
                        : intl.formatMessage(i18n.noSuggestions)}
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
                              ? intl.formatMessage(i18n.today)
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
                                {intl.formatMessage(i18n.useThis)}
                              </Button>
                            ) : task.prUrl ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-2.5 gap-1"
                                onClick={() => window.electron.openExternal(task.prUrl!)}
                              >
                                <ArrowRight className="w-3 h-3" />
                                {intl.formatMessage(i18n.viewPR)}
                              </Button>
                            ) : task.status === 'in_progress' && selectedRepo ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-2.5"
                                onClick={() => setActiveTaskRun(task)}
                              >
                                {intl.formatMessage(i18n.viewTask)}
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
            <h1 className="text-xl font-semibold text-text-primary mb-1">
              {intl.formatMessage(i18n.integrationsTitle)}
            </h1>
            <p className="text-sm text-text-secondary mb-6">
              {intl.formatMessage(i18n.integrationsDescription)}
            </p>
            <div className="border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center">
                <Github className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">GitHub</p>
                <p className="text-xs text-text-secondary">
                  {intl.formatMessage(i18n.connectedAs, { login: user?.login })}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <Check className="w-3.5 h-3.5" /> {intl.formatMessage(i18n.connected)}
              </div>
            </div>
            <div className="mt-3 border border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 text-text-secondary">
              <Puzzle className="w-8 h-8 opacity-40" />
              <p className="text-sm">{intl.formatMessage(i18n.moreIntegrationsSoon)}</p>
            </div>
          </div>
        )}

        {/* Automation tab */}
        {mainTab === 'automation' && (
          <div className="flex flex-col flex-1 min-h-0 px-6 py-5 gap-4">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">
                {intl.formatMessage(i18n.automationTitle)}
              </h1>
              <p className="text-sm text-text-secondary mt-0.5">
                {intl.formatMessage(i18n.automationDescription)}
              </p>
            </div>

            {/* PR Review trigger */}
            <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center shrink-0">
                  <GitPullRequest className="w-5 h-5 text-text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {intl.formatMessage(i18n.autoReviewTitle)}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {intl.formatMessage(i18n.autoReviewDescription)}
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium shrink-0">
                  {intl.formatMessage(i18n.comingSoon)}
                </span>
              </div>

              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center shrink-0">
                  <GitMerge className="w-5 h-5 text-text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {intl.formatMessage(i18n.autoMergeTitle)}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {intl.formatMessage(i18n.autoMergeDescription)}
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium shrink-0">
                  {intl.formatMessage(i18n.comingSoon)}
                </span>
              </div>

              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5 text-text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {intl.formatMessage(i18n.issueTriageTitle)}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {intl.formatMessage(i18n.issueTriageDescription)}
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium shrink-0">
                  {intl.formatMessage(i18n.comingSoon)}
                </span>
              </div>
            </div>

            {/* Webhook setup hint */}
            <div className="border border-dashed border-border rounded-xl p-5 flex flex-col gap-2">
              <p className="text-sm font-medium text-text-primary flex items-center gap-2">
                <Settings className="w-4 h-4 text-text-secondary" />
                {intl.formatMessage(i18n.howToEnableTitle)}
              </p>
              <ol className="text-xs text-text-secondary space-y-1 list-decimal list-inside">
                <li>{intl.formatMessage(i18n.howToEnableStep1)}</li>
                <li>{intl.formatMessage(i18n.howToEnableStep2)}</li>
                <li>{intl.formatMessage(i18n.howToEnableStep3)}</li>
              </ol>
              <button
                onClick={() => window.electron.openExternal('https://github.com/settings/apps')}
                className="mt-1 text-xs text-blue-500 hover:underline self-start"
              >
                {intl.formatMessage(i18n.openGitHubAppSettings)}
              </button>
            </div>
          </div>
        )}

        {/* Insights tab */}
        {mainTab === 'insights' && (
          <div className="flex flex-col flex-1 min-h-0 px-6 py-5 gap-5">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">
                {intl.formatMessage(i18n.insightsTitle)}
              </h1>
              <p className="text-sm text-text-secondary mt-0.5">
                {intl.formatMessage(i18n.insightsDescription)}
              </p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-border rounded-xl p-4 flex flex-col gap-1">
                <p className="text-[10px] uppercase tracking-widest text-text-secondary font-semibold">
                  {intl.formatMessage(i18n.tasksCreated)}
                </p>
                <p className="text-3xl font-semibold text-text-primary">{tasks.length}</p>
                <p className="text-xs text-text-secondary">{intl.formatMessage(i18n.allTime)}</p>
              </div>
              <div className="border border-border rounded-xl p-4 flex flex-col gap-1">
                <p className="text-[10px] uppercase tracking-widest text-text-secondary font-semibold">
                  {intl.formatMessage(i18n.activeLabel)}
                </p>
                <p className="text-3xl font-semibold text-green-600">
                  {
                    tasks.filter(
                      (t) =>
                        t.status === 'in_progress' || t.status === 'open' || t.status === 'review'
                    ).length
                  }
                </p>
                <p className="text-xs text-text-secondary">
                  {intl.formatMessage(i18n.inProgressOrOpen)}
                </p>
              </div>
              <div className="border border-border rounded-xl p-4 flex flex-col gap-1">
                <p className="text-[10px] uppercase tracking-widest text-text-secondary font-semibold">
                  {intl.formatMessage(i18n.completedLabel)}
                </p>
                <p className="text-3xl font-semibold text-purple-600">
                  {tasks.filter((t) => t.status === 'merged').length}
                </p>
                <p className="text-xs text-text-secondary">
                  {intl.formatMessage(i18n.mergedLabel)}
                </p>
              </div>
            </div>

            {/* Repos worked on */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium text-text-primary">
                  {intl.formatMessage(i18n.repositoriesWorkedOn)}
                </p>
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
                      {intl.formatMessage(i18n.noTasksYet)}
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
                      {intl.formatMessage(i18n.taskCount, { count })}
                    </span>
                  </div>
                ));
              })()}
            </div>

            {/* Status breakdown */}
            {tasks.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-medium text-text-primary">
                    {intl.formatMessage(i18n.statusBreakdown)}
                  </p>
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
                  <p className="text-xs text-text-secondary">
                    {intl.formatMessage(i18n.activeRepository)}
                  </p>
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
                <h1 className="text-xl font-semibold text-text-primary mb-1">
                  {intl.formatMessage(i18n.settingsTitle)}
                </h1>
                <p className="text-sm text-text-secondary">
                  {intl.formatMessage(i18n.settingsDescription)}
                </p>
              </div>

              {/* ── GitHub Account ─────────────────────────────────────── */}
              <div className="border border-border rounded-xl divide-y divide-border">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Github className="w-5 h-5 text-text-secondary" />
                    <div>
                      <p className="text-sm font-medium">
                        {intl.formatMessage(i18n.githubAccount)}
                      </p>
                      <p className="text-xs text-text-secondary">@{user?.login}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={signOut}
                    className="flex items-center gap-1.5 text-xs text-red-500 border-red-200 hover:bg-red-50"
                  >
                    <LogOut className="w-3.5 h-3.5" /> {intl.formatMessage(i18n.signOut)}
                  </Button>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-text-secondary" />
                    <div>
                      <p className="text-sm font-medium">{intl.formatMessage(i18n.repositories)}</p>
                      <p className="text-xs text-text-secondary">
                        {intl.formatMessage(i18n.reposLoaded, { count: repos.length })}
                      </p>
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
                    {intl.formatMessage(i18n.refresh)}
                  </Button>
                </div>
              </div>

              {/* ── GitHub App — Bot Identity ───────────────────────────── */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-background-secondary border-b border-border flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Puzzle className="w-4 h-4" />
                      {intl.formatMessage(i18n.botIdentityTitle)}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {intl.formatMessage(i18n.botIdentityDescription, {
                        appSlug: (
                          <code className="bg-background-primary px-1 rounded">
                            {appSlug ?? 'your-app'}
                          </code>
                        ),
                      })}
                    </p>
                  </div>
                  {botMode ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                      <Check className="w-3 h-3" /> {intl.formatMessage(i18n.botActive)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 font-medium">
                      {intl.formatMessage(i18n.botNotConfigured)}
                    </span>
                  )}
                </div>

                <div className="p-4">
                  {botMode && botAppId ? (
                    <div className="space-y-1">
                      <p className="text-sm text-text-primary">
                        {intl.formatMessage(i18n.botAppId, {
                          appId: <code className="text-text-secondary">{botAppId}</code>,
                        })}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {intl.formatMessage(i18n.botActionsShowAs, {
                          appSlug: <strong>{appSlug ?? 'goose-copilot'}[bot]</strong>,
                        })}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-text-secondary">
                      {intl.formatMessage(i18n.botSetupHint, {
                        appId: (
                          <code className="bg-background-secondary px-1 rounded">
                            GITHUB_APP_ID
                          </code>
                        ),
                        keyPath: (
                          <code className="bg-background-secondary px-1 rounded">
                            GITHUB_APP_PRIVATE_KEY_PATH
                          </code>
                        ),
                        envFile: <code className="bg-background-secondary px-1 rounded">.env</code>,
                        login: <strong>@{user?.login}</strong>,
                      })}
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
