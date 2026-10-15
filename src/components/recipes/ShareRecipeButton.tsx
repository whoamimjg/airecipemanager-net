import { useState } from "react";
import { Share2, Mail, Copy, Check, Facebook, Linkedin, Instagram, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { isNative, shareContent } from "@/lib/native";
import { shareLinks, shareToInstagram } from "@/components/share/share-links";

interface ShareRecipeButtonProps {
  recipeId: string;
  recipeTitle: string;
  variant?: "icon" | "full";
}

const ShareRecipeButton = ({ recipeId, recipeTitle, variant = "icon" }: ShareRecipeButtonProps) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = `https://airecipemanager.com/recipe/${recipeId}`;
  const shareText = `Check out this recipe: ${recipeTitle}`;

  const nativeShare = async () => {
    const res = await shareContent({ title: recipeTitle, text: shareText, url: shareUrl });
    if (res.method === "clipboard" && res.ok) {
      toast.success("Link copied to clipboard!");
    } else if (!res.ok) {
      toast.error("Failed to share");
    }
  };

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

  const shareLinkedIn = () => {
    window.open(shareLinks(shareUrl, recipeTitle).linkedin, "_blank", "noopener,noreferrer,width=640,height=560");
  };

  const shareInstagram = () => shareToInstagram(shareUrl, recipeTitle);

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
        {isNative() && (
          <DropdownMenuItem onClick={nativeShare}>
            <Smartphone className="mr-2 h-4 w-4" /> Share via…
          </DropdownMenuItem>
        )}
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
        <DropdownMenuItem onClick={shareLinkedIn}>
          <Linkedin className="mr-2 h-4 w-4" /> LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareInstagram}>
          <Instagram className="mr-2 h-4 w-4" /> Instagram
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ShareRecipeButton;
