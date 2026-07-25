import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import "./App.css";

type Issue = {
  id: string;
  title: string;
  status: string;
  screenshot_url: string;
  annotated_url: string | null;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  fixed: "Fixed",
};

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
    }
  }

  return (
    <main className="login">
      <h1>SnapFix</h1>
      <p className="muted">Sign in to view issues</p>

      <form onSubmit={handleSubmit} className="login-form">
        <label>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

function IssueList() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchIssues = useCallback(async () => {
    const { data, error } = await supabase
      .from("issues")
      .select("id, title, status, screenshot_url, annotated_url, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error.message);
      return;
    }

    setIssues((data as Issue[]) ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await fetchIssues();
      if (cancelled) return;
      setLoading(false);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
        .channel("desktop-issues")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "issues" },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const issue = payload.new as Issue;
              setIssues((prev) => {
                if (prev.some((i) => i.id === issue.id)) return prev;
                return [issue, ...prev];
              });
              return;
            }

            if (payload.eventType === "UPDATE") {
              const updated = payload.new as Issue;
              setIssues((prev) =>
                prev.map((issue) =>
                  issue.id === updated.id
                    ? {
                        ...issue,
                        status: updated.status,
                        title: updated.title,
                        screenshot_url: updated.screenshot_url,
                        annotated_url: updated.annotated_url,
                      }
                    : issue,
                ),
              );
            }
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [fetchIssues]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchIssues();
    setRefreshing(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>Issues</h1>
          <p className="muted">SnapFix desktop</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" className="secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      {loading ? (
        <p className="muted center">Loading…</p>
      ) : issues.length === 0 ? (
        <p className="muted center empty">No issues yet.</p>
      ) : (
        <ul className="grid">
          {issues.map((issue) => (
            <li key={issue.id} className="card">
              <img
                src={issue.annotated_url || issue.screenshot_url}
                alt=""
                className="thumb"
              />
              <div className="card-body">
                <div className="card-top">
                  <h2>{issue.title}</h2>
                  <span className={`badge status-${issue.status}`}>
                    {statusLabels[issue.status] ?? issue.status}
                  </span>
                </div>
                <time dateTime={issue.created_at}>
                  {formatDate(issue.created_at)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <main className="login">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return session ? <IssueList /> : <LoginForm />;
}

export default App;
