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
import { useLocalSearchParams, useNavigation } from "expo-router";

import { supabase } from "@/lib/supabase";

type FeedbackItem = {
  id: string;
  project_id: string;
  annotated_image_url: string;
  comment_text: string;
  created_at: string;
};

type Project = {
  id: string;
  name: string;
  client_name: string | null;
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;

    const [{ data: proj }, { data: feedback, error }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, client_name")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("feedback")
        .select("id, project_id, annotated_image_url, comment_text, created_at")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (error) {
      console.error(error.message);
    }

    setProject((proj as Project | null) ?? null);
    setItems((feedback as FeedbackItem[]) ?? []);
  }, [id]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: project?.name ?? "Project",
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
  }, [navigation, project?.name]);

  useEffect(() => {
    if (!id) return;

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
        .channel(`mobile-feedback-${id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "feedback",
            filter: `project_id=eq.${id}`,
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
  }, [id, fetchData]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
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
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={
        items.length === 0 ? styles.emptyContainer : styles.list
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListHeaderComponent={
        project ? (
          <View style={styles.headerBlock}>
            <Text style={styles.projectName}>{project.name}</Text>
            {project.client_name ? (
              <Text style={styles.client}>{project.client_name}</Text>
            ) : null}
            <Text style={styles.sectionLabel}>Client feedback</Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>No feedback yet.</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Image
            source={{ uri: item.annotated_image_url }}
            style={styles.thumb}
            contentFit="contain"
          />
          <View style={styles.cardBody}>
            <Text style={styles.date}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
            <Text style={styles.comment}>
              {item.comment_text.trim() || "No comment"}
            </Text>
          </View>
        </View>
      )}
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
    backgroundColor: "#fafafa",
  },
  emptyContainer: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: "#fafafa",
  },
  emptyText: {
    color: "#71717a",
    fontSize: 14,
    textAlign: "center",
    marginTop: 24,
  },
  logout: {
    color: "#52525b",
    fontSize: 15,
    fontWeight: "500",
    marginRight: 4,
  },
  headerBlock: {
    marginBottom: 12,
  },
  projectName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#171717",
  },
  client: {
    marginTop: 4,
    fontSize: 14,
    color: "#52525b",
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 4,
    fontSize: 15,
    fontWeight: "600",
    color: "#171717",
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
    height: 180,
    backgroundColor: "#f4f4f5",
  },
  cardBody: {
    padding: 12,
  },
  date: {
    fontSize: 12,
    color: "#71717a",
    marginBottom: 6,
  },
  comment: {
    fontSize: 14,
    color: "#171717",
    lineHeight: 20,
  },
});
