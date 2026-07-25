import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "expo-router";

import { supabase } from "@/lib/supabase";

type Issue = {
  id: string;
  title: string;
  status: string;
  screenshot_url: string;
  annotated_url: string | null;
  created_at: string;
};

const statusStyles: Record<string, { bg: string; text: string }> = {
  open: { bg: "#fffbeb", text: "#b45309" },
  in_progress: { bg: "#eff6ff", text: "#1d4ed8" },
  fixed: { bg: "#ecfdf5", text: "#047857" },
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  fixed: "Fixed",
};

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export default function IssuesScreen() {
  const navigation = useNavigation();
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={async () => {
            await supabase.auth.signOut();
          }}
          hitSlop={8}
        >
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

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
        .channel("mobile-issues")
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

  async function onRefresh() {
    setRefreshing(true);
    await fetchIssues();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      data={issues}
      keyExtractor={(item) => item.id}
      contentContainerStyle={
        issues.length === 0 ? styles.emptyContainer : styles.list
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>No issues yet.</Text>
      }
      renderItem={({ item }) => {
        const badge = statusStyles[item.status] ?? statusStyles.open;
        const thumb = item.annotated_url || item.screenshot_url;

        return (
          <View style={styles.card}>
            <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>
                    {statusLabels[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.date}>{formatDate(item.created_at)}</Text>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
  },
  list: {
    padding: 16,
    gap: 12,
    backgroundColor: "#fafafa",
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
  },
  emptyText: {
    color: "#71717a",
    fontSize: 14,
  },
  logout: {
    color: "#52525b",
    fontSize: 15,
    fontWeight: "500",
    marginRight: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    overflow: "hidden",
    marginBottom: 12,
  },
  thumb: {
    width: "100%",
    height: 160,
    backgroundColor: "#f4f4f5",
  },
  cardBody: {
    padding: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#171717",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  date: {
    fontSize: 12,
    color: "#71717a",
  },
});
