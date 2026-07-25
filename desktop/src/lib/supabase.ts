import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://aejdiieyyvqwsyjyjklv.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlamRpaWV5eXZxd3N5anlqa2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MjkxMDksImV4cCI6MjEwMDQwNTEwOX0.tZLu_hqRlnRVrDyZjvdOaPR8KitngI4alIubo-E7R0c";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
