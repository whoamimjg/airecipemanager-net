import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number | null;
  onChange?: (rating: number) => void;
  size?: "sm" | "md";
  readonly?: boolean;
}

const StarRating = ({ rating, onChange, size = "md", readonly = false }: StarRatingProps) => {
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={cn(
            "transition-colors",
            !readonly && "hover:scale-110 cursor-pointer",
            readonly && "cursor-default"
          )}
        >
          <Star
            className={cn(
              iconSize,
              star <= (rating || 0)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
};

export default StarRating;
