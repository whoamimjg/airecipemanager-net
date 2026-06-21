import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  body: string;
  status: string;
  published_at: string | null;
  updated_at: string;
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const blank: Partial<Post> = { title: "", slug: "", excerpt: "", cover_image_url: "", body: "", status: "draft" };

const AdminBlog = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Partial<Post> | null>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["admin-blog"],
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Post[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Partial<Post>) => {
      const slug = p.slug?.trim() || slugify(p.title || "");
      const payload: any = {
        title: p.title,
        slug,
        excerpt: p.excerpt || null,
        cover_image_url: p.cover_image_url || null,
        body: p.body || "",
        status: p.status || "draft",
        updated_at: new Date().toISOString(),
      };
      if (payload.status === "published") {
        payload.published_at = p.published_at || new Date().toISOString();
      }
      if (p.id) {
        const { error } = await supabase.from("blog_posts").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("blog_posts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to save"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); queryClient.invalidateQueries({ queryKey: ["admin-blog"] }); },
    onError: () => toast.error("Failed to delete"),
  });

  if (editing) {
    const e = editing;
    const set = (patch: Partial<Post>) => setEditing({ ...e, ...patch });
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{e.id ? "Edit post" : "New post"}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={!e.title || save.isPending} onClick={() => save.mutate(e)}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={e.title || ""} onChange={(ev) => set({ title: ev.target.value, slug: e.slug || slugify(ev.target.value) })} placeholder="Post title" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={e.slug || ""} onChange={(ev) => set({ slug: slugify(ev.target.value) })} placeholder="post-url-slug" />
              <p className="text-xs text-muted-foreground">airecipemanager.com/blog/{e.slug || "…"}</p>
            </div>
            <div className="space-y-2">
              <Label>Excerpt</Label>
              <Textarea rows={2} value={e.excerpt || ""} onChange={(ev) => set({ excerpt: ev.target.value })} placeholder="Short summary shown on the blog list & search results" />
            </div>
            <div className="space-y-2">
              <Label>Cover image URL</Label>
              <Input value={e.cover_image_url || ""} onChange={(ev) => set({ cover_image_url: ev.target.value })} placeholder="https://…" />
            </div>
            <div className="space-y-2">
              <Label>Body (Markdown)</Label>
              <Textarea rows={16} className="font-mono text-sm" value={e.body || ""} onChange={(ev) => set({ body: ev.target.value })} placeholder="# Heading&#10;&#10;Write your post in Markdown…" />
            </div>
            <div className="flex items-center gap-2">
              <Label>Status:</Label>
              <Button size="sm" variant={e.status === "draft" ? "default" : "outline"} onClick={() => set({ status: "draft" })}>Draft</Button>
              <Button size="sm" variant={e.status === "published" ? "default" : "outline"} onClick={() => set({ status: "published" })}>Published</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Blog</h1>
        <Button onClick={() => setEditing({ ...blank })}><Plus className="mr-1 h-4 w-4" /> New post</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Posts</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : !posts || posts.length === 0 ? (
            <p className="text-muted-foreground">No posts yet. Create your first one.</p>
          ) : (
            <div className="divide-y divide-border">
              {posts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{p.title}</span>
                      <Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">/blog/{p.slug}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {p.status === "published" && (
                      <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">
                        <Button size="icon" variant="ghost"><ExternalLink className="h-4 w-4" /></Button>
                      </a>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete "${p.title}"?`)) remove.mutate(p.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBlog;
