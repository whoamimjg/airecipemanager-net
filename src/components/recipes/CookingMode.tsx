import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X, Clock, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import CookingTimer from "./CookingTimer";

interface CookingModeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  ingredients: any[];
  instructions: any[];
  prepTime: number | null;
  cookTime: number | null;
}

const CookingMode = ({ open, onOpenChange, title, ingredients, instructions, prepTime, cookTime }: CookingModeProps) => {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = ingredients overview
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const totalSteps = instructions.length;
  const progress = currentStep === -1 ? 0 : ((currentStep + 1) / totalSteps) * 100;

  const goNext = () => {
    if (currentStep < totalSteps - 1) {
      setCompletedSteps(prev => new Set(prev).add(currentStep));
      setCurrentStep(prev => prev + 1);
    }
  };

  const goPrev = () => {
    if (currentStep > -1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const finish = () => {
    setCompletedSteps(new Set());
    setCurrentStep(-1);
    onOpenChange(false);
  };

  const isLastStep = currentStep === totalSteps - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setCurrentStep(-1); setCompletedSteps(new Set()); } onOpenChange(o); }}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">{title}</h2>
            <p className="text-xs text-muted-foreground">
              {currentStep === -1 ? "Ingredients Overview" : `Step ${currentStep + 1} of ${totalSteps}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(prepTime || cookTime) && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {(prepTime || 0) + (cookTime || 0)} min
              </span>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setCurrentStep(-1); setCompletedSteps(new Set()); onOpenChange(false); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="px-5 pt-3">
          <Progress value={progress} className="h-2" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-5 py-6">
          {currentStep === -1 ? (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Before you start</h3>
              <p className="text-sm text-muted-foreground">Gather these ingredients:</p>
              <ul className="space-y-2">
                {ingredients.map((ing, i) => {
                  const text = typeof ing === "string"
                    ? ing
                    : [ing?.quantity || ing?.amount, ing?.unit, ing?.name, ing?.notes ? `(${ing.notes})` : ""]
                        .filter(Boolean)
                        .join(" ");
                  return (
                    <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                      {text}
                    </li>
                  );
                })}
              </ul>
              {ingredients.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No ingredients listed.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-6">
              <div className="flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground text-xl font-bold">
                {currentStep + 1}
              </div>
              <p className="text-lg leading-relaxed text-foreground max-w-md">
                {typeof instructions[currentStep] === "string" ? instructions[currentStep] : (instructions[currentStep] as any)?.text || ""}
              </p>
              {completedSteps.has(currentStep) && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Completed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Timer */}
        <div className="px-5 pb-2">
          <CookingTimer />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <Button variant="outline" onClick={goPrev} disabled={currentStep === -1}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>

          {/* Step dots */}
          <div className="flex gap-1.5 overflow-x-auto max-w-[200px]">
            <button
              onClick={() => setCurrentStep(-1)}
              className={`h-2.5 w-2.5 rounded-full shrink-0 transition-colors ${currentStep === -1 ? "bg-primary" : "bg-muted-foreground/30"}`}
            />
            {instructions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-2.5 w-2.5 rounded-full shrink-0 transition-colors ${
                  i === currentStep ? "bg-primary" : completedSteps.has(i) ? "bg-primary/50" : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {isLastStep ? (
            <Button onClick={finish} className="bg-primary text-primary-foreground">
              <CheckCircle2 className="mr-1 h-4 w-4" /> Done
            </Button>
          ) : (
            <Button onClick={goNext}>
              {currentStep === -1 ? "Start" : "Next"} <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CookingMode;
