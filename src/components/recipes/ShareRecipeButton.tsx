import { useState } from "react";
import { Share2, Mail, Copy, Check, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ShareRecipeButtonProps {
  recipeId: string;
  recipeTitle: string;
  variant?: "icon" | "full";
}

const ShareRecipeButton = ({ recipeId, recipeTitle, variant = "icon" }: ShareRecipeButtonProps) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/recipe/${recipeId}`;
  const shareText = `Check out this recipe: ${recipeTitle}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const shareEmail = () => {
    const subject = encodeURIComponent(`Recipe: ${recipeTitle}`);
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank", "width=600,height=400");
  };

  const shareInstagram = () => {
    // Instagram doesn't support direct URL sharing; copy link and notify
    copyLink();
    toast.info("Link copied! Paste it in your Instagram story or post.");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "full" ? (
          <Button variant="outline" size="sm">
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Share2 className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={copyLink}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copied!" : "Copy Link"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareEmail}>
          <Mail className="mr-2 h-4 w-4" /> Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareFacebook}>
          <Facebook className="mr-2 h-4 w-4" /> Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareInstagram}>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </svg>
          Instagram
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ShareRecipeButton;
