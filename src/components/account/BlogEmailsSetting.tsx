import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** On/off switch for the email that goes out when a new blog post is published. */
const BlogEmailsSetting = () => {
  const queryClient = useQueryClient();
  const { data: subscribed, isLoading } = useQuery({
    queryKey: ["my-blog-emails"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_blog_emails");
      if (error) throw error;
      return data === true;
    },
  });

  const update = useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase.rpc("set_my_blog_emails", { p_subscribed: on });
      if (error) throw error;
      return on;
    },
    onSuccess: (on) => {
      queryClient.setQueryData(["my-blog-emails"], on);
      toast.success(on ? "You'll get an email for each new blog post." : "Blog emails turned off.");
    },
    onError: (e: { message?: string }) => toast.error(e.message || "Couldn't update your email setting."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Mail className="h-5 w-5" /> Emails
        </CardTitle>
        <CardDescription>We email you when a new blog post is published, with the full post inside.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <Label htmlFor="blog-emails">Email me new blog posts</Label>
        <Switch
          id="blog-emails"
          checked={!!subscribed}
          disabled={isLoading || update.isPending}
          onCheckedChange={(on) => update.mutate(on)}
        />
      </CardContent>
    </Card>
  );
};

export default BlogEmailsSetting;
