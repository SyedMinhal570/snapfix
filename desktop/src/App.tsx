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

type Project = {
  id: string;
  name: string;
  client_name: string | null;
  screenshot_url: string;
  created_at: string;
  feedback: { count: number }[] | null;
};

type FeedbackItem = {
  id: string;
  project_id: string;
  annotated_image_url: string;
  comment_text: string;
  created_at: string;
};

type View = "issues" | "projects";

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

function AppHeader({
  title,
  subtitle,
  view,
  onViewChange,
  onRefresh,
  refreshing,
  onLogout,
  onBack,
}: {
  title: string;
  subtitle: string;
  view: View;
  onViewChange: (view: View) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onLogout: () => void;
  onBack?: () => void;
}) {
  return (
    <header className="header">
      <div>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        <nav className="view-nav" aria-label="Main">
          {onBack ? (
            <button type="button" className="nav-link" onClick={onBack}>
              ← Projects
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`nav-link${view === "issues" ? " active" : ""}`}
                onClick={() => onViewChange("issues")}
              >
                Issues
              </button>
              <button
                type="button"
                className={`nav-link${view === "projects" ? " active" : ""}`}
                onClick={() => onViewChange("projects")}
              >
                Projects
              </button>
            </>
          )}
        </nav>
      </div>
      <div className="header-actions">
        <button type="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        <button type="button" className="secondary" onClick={onLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}

function IssueList({
  view,
  onViewChange,
}: {
  view: View;
  onViewChange: (view: View) => void;
}) {
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
      <AppHeader
        title="Issues"
        subtitle="SnapFix desktop"
        view={view}
        onViewChange={onViewChange}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onLogout={handleLogout}
      />

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

function ProjectDetail({
  projectId,
  view,
  onViewChange,
  onBack,
}: {
  projectId: string;
  view: View;
  onViewChange: (view: View) => void;
  onBack: () => void;
}) {
  const [projectName, setProjectName] = useState("Project");
  const [clientName, setClientName] = useState<string | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const [{ data: proj }, { data: feedback, error }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, client_name")
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("feedback")
        .select("id, project_id, annotated_image_url, comment_text, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);

    if (error) {
      console.error(error.message);
    }

    if (proj) {
      setProjectName(proj.name);
      setClientName(proj.client_name);
    }
    setItems((feedback as FeedbackItem[]) ?? []);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await fetchData();
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
        .channel(`desktop-feedback-${projectId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "feedback",
            filter: `project_id=eq.${projectId}`,
          },
          (payload) => {
            const row = payload.new as FeedbackItem;
            setItems((prev) => {
              if (prev.some((i) => i.id === row.id)) return prev;
              return [row, ...prev];
            });
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [projectId, fetchData]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <main className="app">
      <AppHeader
        title={projectName}
        subtitle={clientName ? clientName : "Client feedback"}
        view={view}
        onViewChange={onViewChange}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onLogout={handleLogout}
        onBack={onBack}
      />

      {loading ? (
        <p className="muted center">Loading…</p>
      ) : items.length === 0 ? (
        <p className="muted center empty">No feedback yet.</p>
      ) : (
        <ul className="grid">
          {items.map((item) => (
            <li key={item.id} className="card">
              <img
                src={item.annotated_image_url}
                alt=""
                className="thumb thumb-contain"
              />
              <div className="card-body">
                <time dateTime={item.created_at}>
                  {new Date(item.created_at).toLocaleString()}
                </time>
                <p className="feedback-comment">
                  {item.comment_text.trim() || "No comment"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ProjectList({
  view,
  onViewChange,
}: {
  view: View;
  onViewChange: (view: View) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("projects")
      .select(
        "id, name, client_name, screenshot_url, created_at, feedback(count)",
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error.message);
      return;
    }

    setProjects((data as Project[]) ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await fetchProjects();
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
        .channel("desktop-projects")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "projects" },
          () => {
            void fetchProjects();
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "feedback" },
          () => {
            void fetchProjects();
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [fetchProjects]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchProjects();
    setRefreshing(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (selectedId) {
    return (
      <ProjectDetail
        projectId={selectedId}
        view={view}
        onViewChange={(next) => {
          setSelectedId(null);
          onViewChange(next);
        }}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <main className="app">
      <AppHeader
        title="Projects"
        subtitle="SnapFix desktop"
        view={view}
        onViewChange={onViewChange}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onLogout={handleLogout}
      />

      {loading ? (
        <p className="muted center">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="muted center empty">No projects yet.</p>
      ) : (
        <ul className="grid">
          {projects.map((project) => {
            const count = project.feedback?.[0]?.count ?? 0;
            return (
              <li key={project.id}>
                <button
                  type="button"
                  className="card card-button"
                  onClick={() => setSelectedId(project.id)}
                >
                  <img
                    src={project.screenshot_url}
                    alt=""
                    className="thumb"
                  />
                  <div className="card-body">
                    <div className="card-top">
                      <h2>{project.name}</h2>
                      <span className="badge status-in_progress">
                        {count} feedback
                      </span>
                    </div>
                    {project.client_name ? (
                      <p className="client-name">{project.client_name}</p>
                    ) : null}
                    <time dateTime={project.created_at}>
                      {formatDate(project.created_at)}
                    </time>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function AuthenticatedApp() {
  const [view, setView] = useState<View>("issues");

  if (view === "projects") {
    return <ProjectList view={view} onViewChange={setView} />;
  }

  return <IssueList view={view} onViewChange={setView} />;
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

  return session ? <AuthenticatedApp /> : <LoginForm />;
}

export default App;
