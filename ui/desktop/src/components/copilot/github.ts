import type { GitHubIssue, GitHubInstallation, GitHubRepo } from './types';

const GITHUB_API_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
});

export async function githubCreateIssue(
  token: string,
  repo: string,
  title: string,
  body: string
): Promise<GitHubIssue> {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: { ...GITHUB_API_HEADERS(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? `GitHub API error ${res.status}`);
  }
  return res.json() as Promise<GitHubIssue>;
}

export async function fetchGitHubIssues(
  token: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open'
): Promise<GitHubIssue[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues?state=${state}&per_page=30&sort=updated`,
    { headers: GITHUB_API_HEADERS(token) }
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? `GitHub API error ${res.status}`);
  }
  const data = (await res.json()) as GitHubIssue[];
  // Filter out pull requests (GitHub returns PRs in /issues endpoint)
  return data.filter((i) => !('pull_request' in i));
}

export async function fetchUserInstallations(token: string): Promise<GitHubInstallation[]> {
  try {
    const res = await fetch('https://api.github.com/user/installations?per_page=100', {
      headers: GITHUB_API_HEADERS(token),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { installations: GitHubInstallation[] };
    return data.installations ?? [];
  } catch {
    return [];
  }
}

export async function fetchBranches(token: string, fullName: string): Promise<string[]> {
  try {
    const res = await fetch(`https://api.github.com/repos/${fullName}/branches?per_page=100`, {
      headers: GITHUB_API_HEADERS(token),
    });
    if (!res.ok) return ['main'];
    const data = (await res.json()) as { name: string }[];
    return data.map((b) => b.name);
  } catch {
    return ['main'];
  }
}

const MAX_REPO_PAGES = 10;

export async function fetchGitHubRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  while (page <= MAX_REPO_PAGES) {
    // Installation tokens use /installation/repositories to list only the repos
    // the user explicitly granted access to — no extra repos exposed.
    const res = await fetch(
      `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
      { headers: GITHUB_API_HEADERS(token) }
    );
    if (!res.ok) throw new Error(`${res.status}`);
    const data = (await res.json()) as { repositories: GitHubRepo[]; total_count: number };
    const batch = data.repositories ?? [];
    repos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return repos;
}
