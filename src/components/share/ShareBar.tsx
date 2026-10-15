import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Facebook, Instagram, Linkedin, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shareLinks, shareToInstagram } from "@/components/share/share-links";

/** Share buttons for a public page: Facebook, LinkedIn, X, Instagram, email and copy link. */
const ShareBar = ({ url, title, className }: { url: string; title: string; className?: string }) => {
  const [copied, setCopied] = useState(false);
  const links = shareLinks(url, title);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link. Copy it from the address bar.");
    }
  };

  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer,width=640,height=560");

  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm ${className ?? ""}`} role="group" aria-label="Share this page">
      <span className="mr-1 text-muted-foreground">Share:</span>
      <Button variant="outline" size="sm" onClick={() => open(links.facebook)}>
        <Facebook className="mr-1.5 h-4 w-4" /> Facebook
      </Button>
      <Button variant="outline" size="sm" onClick={() => open(links.linkedin)}>
        <Linkedin className="mr-1.5 h-4 w-4" /> LinkedIn
      </Button>
      <Button variant="outline" size="sm" onClick={() => open(links.x)}>
        <span className="mr-1.5 font-bold" aria-hidden="true">X</span> Post
      </Button>
      <Button variant="outline" size="sm" onClick={() => shareToInstagram(url, title)}>
        <Instagram className="mr-1.5 h-4 w-4" /> Instagram
      </Button>
      <Button variant="outline" size="sm" onClick={() => { window.location.href = links.email; }}>
        <Mail className="mr-1.5 h-4 w-4" /> Email
      </Button>
      <Button variant="outline" size="sm" onClick={copy}>
        {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
};

export default ShareBar;
