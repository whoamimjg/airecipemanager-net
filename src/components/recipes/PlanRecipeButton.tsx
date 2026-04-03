import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { format, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface PlanRecipeButtonProps {
  recipeId: string;
  recipeTitle: string;
}

const PlanRecipeButton = ({ recipeId, recipeTitle }: PlanRecipeButtonProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [mealSlot, setMealSlot] = useState("dinner");

  const planMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !user) throw new Error("Missing data");
      const { error } = await supabase.from("meal_plans").insert({
        user_id: user.id,
        recipe_id: recipeId,
        date: format(selectedDate, "yyyy-MM-dd"),
        meal_slot: mealSlot,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      queryClient.invalidateQueries({ queryKey: ["recipe-last-planned"] });
      toast.success(`"${recipeTitle}" planned for ${format(selectedDate!, "MMM d, yyyy")} (${mealSlot})`);
      setOpen(false);
      setSelectedDate(undefined);
    },
    onError: () => toast.error("Failed to plan recipe"),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => e.stopPropagation()}
        >
          <CalendarDays className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 space-y-3" align="end" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-medium text-foreground">Plan this recipe</p>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          disabled={(date) => isBefore(date, startOfDay(new Date()))}
          className={cn("p-0 pointer-events-auto")}
        />
        <Select value={mealSlot} onValueChange={setMealSlot}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="breakfast">Breakfast</SelectItem>
            <SelectItem value="lunch">Lunch</SelectItem>
            <SelectItem value="dinner">Dinner</SelectItem>
            <SelectItem value="snack">Snack</SelectItem>
          </SelectContent>
        </Select>
        <Button
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!selectedDate || planMutation.isPending}
          onClick={() => planMutation.mutate()}
          size="sm"
        >
          {planMutation.isPending ? "Adding..." : "Add to Meal Plan"}
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export default PlanRecipeButton;
