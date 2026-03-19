import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  X,
  Github,
  GitPullRequest,
  GitMerge,
  AlertCircle,
  Loader2,
  ExternalLink,
  Terminal,
  FileEdit,
  Eye,
  FolderOpen,
} from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { MainPanelLayout } from '../Layout/MainPanelLayout';
import { createSession } from '../../sessions';
import { getInitialWorkingDir } from '../../utils/workingDir';
import { reply } from '../../api';
import { createUserMessage } from '../../types/message';
import type { ToolRequest, ToolResponse } from '../../api';
import { useModelAndProvider } from '../ModelAndProviderContext';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TaskRunStatus = 'open' | 'merged' | 'closed' | 'review' | 'in_progress';

export interface TaskRunTask {
  id: string;
  title: string;
  repo: string;
  repoUrl: string;
  sessionId?: string;
  status?: TaskRunStatus;
  prUrl?: string;
}

export interface GitHubRunRepo {
  full_name: string;
  html_url: string;
  name: string;
}

type StepStatus = 'running' | 'done' | 'error';

interface AgentStep {
  id: string;
  label: string;
  detail?: string;
  status: StepStatus;
  output?: string;
}

// ─── Tool call parsing ───────────────────────────────────────────────────────

function resolveToolCall(
  raw: Record<string, unknown>
): { name: string; arguments: Record<string, unknown> } | null {
  // The server wraps as { status: 'success', value: { name, arguments } }
  // but sometimes sends the raw object directly.
  if (raw?.status === 'success') {
    const v = raw.value as Record<string, unknown> | undefined;
    if (v && typeof v.name === 'string') {
      return { name: v.name, arguments: (v.arguments as Record<string, unknown>) ?? {} };
    }
  }
  if (typeof raw?.name === 'string') {
    return { name: raw.name, arguments: (raw.arguments as Record<string, unknown>) ?? {} };
  }
  return null;
}

function resolveToolResult(
  raw: Record<string, unknown>
): { text?: string; error?: string } {
  // { status: 'success', value: CallToolResult } or { status: 'error', error: string }
  if (raw?.status === 'error') {
    return { error: String(raw.error ?? 'Tool error') };
  }
  const value = (raw?.status === 'success' ? raw.value : raw) as Record<string, unknown>;
  if (value?.content) {
    const parts = value.content as Array<{ type: string; text?: string }>;
    const text = parts
      .filter((p) => p.type === 'text' && p.text)
      .map((p) => p.text)
      .join('\n')
      .trim();
    return { text: text.slice(0, 400) };
  }
  return {};
}

// Extracts just the tool name from "extension__toolname" format
function bareToolName(full: string): string {
  const idx = full.lastIndexOf('__');
  return idx === -1 ? full : full.substring(idx + 2);
}

function describeShellCommand(cmd: string): { label: string; icon: React.ComponentType<{ className?: string }> } {
  const c = cmd.trim();
  if (/^git clone/.test(c)) return { label: 'Cloning repository', icon: FolderOpen };
  if (/^git checkout -b/.test(c)) {
    const branch = c.split('-b')[1]?.trim().split(' ')[0] ?? '';
    return { label: `Creating branch: ${branch}`, icon: GitMerge };
  }
  if (/^git (add|commit|push)/.test(c)) return { label: 'Committing and pushing changes', icon: GitMerge };
  if (/\/pulls/.test(c) && /curl/.test(c)) return { label: 'Creating pull request via GitHub API', icon: GitPullRequest };
  if (/\/issues/.test(c) && /curl/.test(c)) return { label: 'Creating issue via GitHub API', icon: Github };
  if (/curl/.test(c)) return { label: 'Calling GitHub API', icon: Github };
  if (/\b(npm|pnpm|yarn|pip|cargo)\s+(install|add)/.test(c)) return { label: 'Installing dependencies', icon: Terminal };
  if (/\b(jest|pytest|cargo test|go test|npm test|pnpm test)/.test(c)) return { label: 'Running tests', icon: Check };
  if (/^(cat|head|tail|less)\s/.test(c)) return { label: 'Reading file', icon: Eye };
  if (/^(ls|find|tree)\s?/.test(c)) return { label: 'Exploring directory structure', icon: FolderOpen };
  if (/^cd\s/.test(c)) return { label: `Navigating to ${c.slice(3).trim()}`, icon: FolderOpen };
  return { label: 'Running shell command', icon: Terminal };
}

function describeToolCall(
  name: string,
  args: Record<string, unknown>
): { label: string; detail?: string; icon: React.ComponentType<{ className?: string }> } {
  const tool = bareToolName(name);
  switch (tool) {
    case 'shell': {
      const cmd = String(args.command ?? '');
      const { label, icon } = describeShellCommand(cmd);
      return { label, detail: cmd.slice(0, 100), icon };
    }
    case 'text_editor': {
      const path = String(args.path ?? args.file_path ?? '');
      const command = String(args.command ?? '');
      const actionMap: Record<string, string> = {
        view: 'Reading',
        create: 'Creating',
        str_replace: 'Editing',
        insert: 'Inserting into',
      };
      const action = actionMap[command] ?? 'Editing';
      return { label: `${action} ${path}`, detail: path, icon: FileEdit };
    }
    case 'write':
      return { label: `Writing ${String(args.path ?? '')}`, detail: String(args.path ?? ''), icon: FileEdit };
    case 'edit':
      return { label: `Editing ${String(args.path ?? '')}`, detail: String(args.path ?? ''), icon: FileEdit };
    case 'read':
      return { label: `Reading ${String(args.path ?? '')}`, detail: String(args.path ?? ''), icon: Eye };
    case 'tree':
      return { label: 'Reading directory structure', icon: FolderOpen };
    default:
      return { label: name, icon: Terminal };
  }
}

// Extract GitHub PR/issue URLs from text
function extractGitHubUrl(text: string): string | null {
  const m = text.match(/https:\/\/github\.com\/[^\s<>")]+\/(?:pull|issues)\/\d+/);
  return m ? m[0] : null;
}

// ─── Step item ───────────────────────────────────────────────────────────────

function StepItem({
  step,
  isLast,
}: {
  step: AgentStep;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex items-start gap-3">
      {/* Status icon + connector line */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
            step.status === 'done'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              : step.status === 'error'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-500'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
          }`}
        >
          {step.status === 'done' && <Check className="w-3.5 h-3.5" />}
          {step.status === 'error' && <X className="w-3.5 h-3.5" />}
          {step.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2 mt-0.5">
          <p
            className={`text-sm leading-snug ${
              step.status === 'running' ? 'text-text-primary font-medium' : 'text-text-primary'
            }`}
          >
            {step.label}
          </p>
          {step.output && step.status === 'done' && (
            <button
              onClick={() => setExpanded((p) => !p)}
              className="text-[10px] text-text-secondary hover:text-text-primary shrink-0 mt-0.5 underline"
            >
              {expanded ? 'hide' : 'output'}
            </button>
          )}
        </div>
        {step.detail && step.status === 'running' && (
          <p className="text-xs text-text-secondary font-mono truncate mt-0.5 opacity-60">
            {step.detail}
          </p>
        )}
        {expanded && step.output && (
          <pre className="mt-2 text-xs bg-background-secondary rounded-lg p-2.5 overflow-x-auto text-text-secondary whitespace-pre-wrap break-all max-h-40">
            {step.output}
          </pre>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function TaskRunView({
  task,
  userToken,
  botMode,
  botAppId,
  repo,
  branch,
  onBack,
  onTaskUpdate,
}: {
  task: TaskRunTask;
  userToken: string;
  botMode?: boolean;
  botAppId?: string;
  repo: GitHubRunRepo;
  branch: string;
  onBack: () => void;
  onTaskUpdate: (updates: Partial<TaskRunTask>) => void;
}) {
  const { currentModel, currentProvider } = useModelAndProvider();
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [runStatus, setRunStatus] = useState<'starting' | 'running' | 'done' | 'error'>('starting');
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [finalSummary, setFinalSummary] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prUrlRef = useRef<string | null>(null);

  // Auto-scroll as steps appear
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps, runStatus]);

  useEffect(() => {
    let cancelled = false;
    abortRef.current = new AbortController();

    const run = async () => {
      try {
        // Guard: Goose must have a model configured to run agent tasks
        if (!currentModel || !currentProvider) {
          throw new Error(
            'No AI model configured. Open Goose Settings and add a model provider (e.g. OpenAI, Anthropic) before running tasks.'
          );
        }

        // Resolve the right token — installation token (bot identity) or user token
        let token = userToken;
        if (botMode && botAppId) {
          const repoOwner = repo.full_name.split('/')[0];
          const result = await window.electron.getGitHubInstallationToken(repoOwner);
          if ('token' in result) {
            token = result.token;
          } else {
            throw new Error(result.error);
          }
        }

        const session = await createSession(getInitialWorkingDir());
        if (cancelled) return;

        onTaskUpdate({ sessionId: session.id });
        setRunStatus('running');

        const prompt = buildTaskPrompt(task.title, token, repo, branch);
        const userMessage = createUserMessage(prompt);

        const { stream } = await reply({
          body: { session_id: session.id, user_message: userMessage },
          throwOnError: true,
          signal: abortRef.current!.signal,
          sseMaxRetryAttempts: 0,
        });

        for await (const event of stream) {
          if (cancelled) break;

          if (event.type === 'Message') {
            const msg = event.message;

            for (const content of msg.content) {
              if (content.type === 'toolRequest') {
                const req = content as ToolRequest & { type: 'toolRequest' };
                const tc = resolveToolCall(req.toolCall as Record<string, unknown>);
                if (tc) {
                  const { label, detail } = describeToolCall(tc.name, tc.arguments);
                  setSteps((prev) => [
                    ...prev,
                    { id: req.id, label, detail, status: 'running' },
                  ]);
                }
              } else if (content.type === 'toolResponse') {
                const resp = content as ToolResponse & { type: 'toolResponse' };
                const result = resolveToolResult(resp.toolResult as Record<string, unknown>);

                // Try to extract a PR URL from tool output
                if (result.text) {
                  const found = extractGitHubUrl(result.text);
                  if (found && !prUrlRef.current) {
                    prUrlRef.current = found;
                    setPrUrl(found);
                  }
                }

                setSteps((prev) =>
                  prev.map((s) =>
                    s.id === resp.id
                      ? {
                          ...s,
                          status: result.error ? 'error' : 'done',
                          output: result.text ?? result.error,
                        }
                      : s
                  )
                );
              } else if (content.type === 'text') {
                const text = (content as { type: 'text'; text: string }).text;
                // Look for GitHub URLs in final assistant text
                const found = extractGitHubUrl(text);
                if (found && !prUrlRef.current) {
                  prUrlRef.current = found;
                  setPrUrl(found);
                }
                setFinalSummary((prev) => prev + text);
              }
            }
          } else if (event.type === 'Error') {
            if (!cancelled) {
              setErrorMsg(event.error);
              setRunStatus('error');
            }
            return;
          } else if (event.type === 'Finish') {
            break;
          }
        }

        if (!cancelled) {
          setRunStatus('done');
          onTaskUpdate({
            status: prUrlRef.current ? 'open' : 'in_progress',
            prUrl: prUrlRef.current ?? undefined,
          } as Partial<TaskRunTask>);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Agent failed';
          setErrorMsg(msg);
          setRunStatus('error');
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = () => {
    abortRef.current?.abort();
    onBack();
  };

  return (
    <MainPanelLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={runStatus === 'running' ? handleCancel : onBack}
            className="p-1.5 h-auto"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-text-primary">{task.title}</p>
            <p className="text-xs text-text-secondary flex items-center gap-1">
              <Github className="w-3 h-3" />
              {repo.full_name} · {branch}
            </p>
          </div>
          {/* Status badge */}
          <div className="shrink-0">
            {runStatus === 'starting' && (
              <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Loader2 className="w-3 h-3 animate-spin" />
                Starting…
              </span>
            )}
            {runStatus === 'running' && (
              <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Working…
              </span>
            )}
            {runStatus === 'done' && (
              <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <Check className="w-3.5 h-3.5" />
                Done
              </span>
            )}
            {runStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Failed
              </span>
            )}
          </div>
        </div>

        {/* Steps + result */}
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-xl mx-auto flex flex-col gap-0">
            {/* Starting state */}
            {runStatus === 'starting' && steps.length === 0 && (
              <div className="flex items-center gap-3 py-6 text-sm text-text-secondary">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                Starting Goose agent…
              </div>
            )}

            {/* Step timeline */}
            {steps.map((step, idx) => (
              <StepItem key={step.id} step={step} isLast={idx === steps.length - 1 && runStatus !== 'running'} />
            ))}

            {/* "Still working" row after last completed step */}
            {runStatus === 'running' && steps.length > 0 && (
              <div className="flex items-center gap-3 pl-9 py-1 text-xs text-text-secondary">
                <Loader2 className="w-3 h-3 animate-spin" />
                Continuing…
              </div>
            )}

            {/* ── Result card ── */}
            {runStatus === 'done' && (
              <div className="mt-6 rounded-xl border border-border bg-background-secondary overflow-hidden">
                {prUrl ? (
                  <div className="p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                        <GitPullRequest className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary">
                          Pull request created
                        </p>
                        <p className="text-xs text-text-secondary truncate mt-0.5">{prUrl}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => window.electron.openExternal(prUrl)}
                      className="w-full gap-2"
                      size="sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on GitHub
                    </Button>
                  </div>
                ) : (
                  <div className="p-5 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600 shrink-0" />
                      <p className="text-sm font-semibold text-text-primary">Task complete</p>
                    </div>
                    {finalSummary.trim() && (
                      <p className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed max-h-32 overflow-hidden">
                        {finalSummary.trim().slice(0, 400)}
                        {finalSummary.trim().length > 400 ? '…' : ''}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.electron.openExternal(repo.html_url)}
                      className="w-full gap-2 mt-1"
                    >
                      <Github className="w-4 h-4" />
                      Open Repository
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {runStatus === 'error' && (
              <div className="mt-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {errorMsg ?? 'Agent encountered an error'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={onBack} className="text-xs">
                    Go back
                  </Button>
                  {(!currentModel || !currentProvider || errorMsg?.includes('model') || errorMsg?.includes('provider') || errorMsg?.includes('Provider')) && (
                    <Button
                      size="sm"
                      className="text-xs"
                      onClick={() => window.electron.openExternal('goose://settings')}
                    >
                      Open Goose Settings
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>
    </MainPanelLayout>
  );
}

// ─── Task prompt builder ─────────────────────────────────────────────────────

function buildTaskPrompt(
  taskDescription: string,
  token: string,
  repo: GitHubRunRepo,
  branch: string
): string {
  return `You are an autonomous GitHub coding agent, like Cursor Bug Bot or GitHub Copilot.

REPOSITORY: ${repo.full_name} (${repo.html_url})
BRANCH: ${branch}
GITHUB_TOKEN: ${token}

AVAILABLE TOOLS (developer extension):
- shell: run any shell command
- text_editor: read/write/edit files

HOW TO WORK WITH GITHUB:
1. Clone: git clone https://${token}@github.com/${repo.full_name}.git /tmp/${repo.name}
2. Work inside /tmp/${repo.name}
3. Create a branch: git checkout -b fix/<short-name>
4. Make code changes using text_editor or shell
5. Test if possible: run tests
6. Commit: git add -A && git commit -m "..."
7. Push: git push origin <branch-name>
8. Create PR:
   curl -s -X POST https://api.github.com/repos/${repo.full_name}/pulls \\
     -H "Authorization: Bearer ${token}" \\
     -H "Content-Type: application/json" \\
     -d '{"title":"...","head":"<branch-name>","base":"${branch}","body":"..."}'

IMPORTANT: When you create a PR or issue, output its GitHub URL (https://github.com/...) clearly.

TASK: ${taskDescription}

Work autonomously. Do not ask clarifying questions. Make a reasonable interpretation and execute.`;
}
