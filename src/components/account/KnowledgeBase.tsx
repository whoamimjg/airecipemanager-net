import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, PlayCircle, FileText, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ARTICLES = [
  {
    title: "Getting Started with AI Recipe Manager",
    description: "Learn how to set up your account, add your first recipe, and explore AI-powered features.",
    type: "article" as const,
    category: "Getting Started",
  },
  {
    title: "How to Scan Receipts",
    description: "Step-by-step guide to scanning grocery receipts and auto-populating your inventory.",
    type: "article" as const,
    category: "Inventory",
  },
  {
    title: "Using the AI Chef",
    description: "Generate recipes based on your pantry inventory, dietary preferences, and cravings.",
    type: "video" as const,
    category: "AI Features",
  },
  {
    title: "Meal Planning 101",
    description: "Plan your weekly meals, sync with your calendar, and auto-generate grocery lists.",
    type: "video" as const,
    category: "Meal Planning",
  },
  {
    title: "Tracking Kitchen Expenses",
    description: "Understand your food spending and waste with the built-in expense reports.",
    type: "article" as const,
    category: "Expenses",
  },
  {
    title: "Sharing Recipes with Friends",
    description: "Create shareable recipe links and export recipes for others to enjoy.",
    type: "article" as const,
    category: "Recipes",
  },
];

const KnowledgeBase = () => {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Knowledge Base
          </CardTitle>
          <CardDescription>
            Browse guides, tutorials, and how-to videos to get the most out of AI Recipe Manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ARTICLES.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="mt-0.5">
                {item.type === "video" ? (
                  <PlayCircle className="h-5 w-5 text-primary" />
                ) : (
                  <FileText className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {item.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Coming Soon</CardTitle>
          <CardDescription>
            We're working on more tutorials and video content. Check back regularly for updates!
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
};

export default KnowledgeBase;
