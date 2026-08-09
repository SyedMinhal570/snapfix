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
import { useNavigation, useRouter } from "expo-router";

import { supabase } from "@/lib/supabase";

type Project = {
  id: string;
  name: string;
  client_name: string | null;
  screenshot_url: string;
  created_at: string;
  feedback: { count: number }[] | null;
};

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export default function ProjectsScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={() => router.replace("/")} hitSlop={8}>
          <Text style={styles.navLink}>Issues</Text>
        </Pressable>
      ),
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
  }, [navigation, router]);

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
        .channel("mobile-projects")
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

  async function onRefresh() {
    setRefreshing(true);
    await fetchProjects();
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
      data={projects}
      keyExtractor={(item) => item.id}
      contentContainerStyle={
        projects.length === 0 ? styles.emptyContainer : styles.list
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>No projects yet.</Text>
      }
      renderItem={({ item }) => {
        const count = item.feedback?.[0]?.count ?? 0;
        return (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/projects/${item.id}`)}
          >
            <Image
              source={{ uri: item.screenshot_url }}
              style={styles.thumb}
              contentFit="cover"
            />
            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={[styles.badge, { backgroundColor: "#eff6ff" }]}>
                  <Text style={[styles.badgeText, { color: "#1d4ed8" }]}>
                    {count} feedback
                  </Text>
                </View>
              </View>
              {item.client_name ? (
                <Text style={styles.client} numberOfLines={1}>
                  {item.client_name}
                </Text>
              ) : null}
              <Text style={styles.date}>{formatDate(item.created_at)}</Text>
            </View>
          </Pressable>
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
  navLink: {
    color: "#52525b",
    fontSize: 15,
    fontWeight: "500",
    marginLeft: 4,
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
  client: {
    fontSize: 13,
    color: "#52525b",
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: "#71717a",
  },
});
