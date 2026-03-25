import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChefHat, BookOpen, Brain, Package, CalendarDays, ShoppingCart, Settings, LogOut } from "lucide-react";
import RecipeManager from "@/components/recipes/RecipeManager";
import AIRecipeGenerator from "@/components/recipes/AIRecipeGenerator";
import InventoryManager from "@/components/inventory/InventoryManager";
import MealPlanner from "@/components/meal-planner/MealPlanner";
import GroceryList from "@/components/grocery/GroceryList";

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("recipes");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <ChefHat className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ChefHat className="h-7 w-7 text-primary" />
            <span className="text-lg font-bold font-serif text-foreground hidden sm:inline">AI Recipe Manager</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden md:inline">
              {user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content with tabs */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap mb-6 bg-muted">
            <TabsTrigger value="recipes" className="gap-1.5 text-xs sm:text-sm">
              <BookOpen className="h-4 w-4" /> <span className="hidden sm:inline">Recipes</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5 text-xs sm:text-sm">
              <Brain className="h-4 w-4" /> <span className="hidden sm:inline">AI Chef</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-1.5 text-xs sm:text-sm">
              <Package className="h-4 w-4" /> <span className="hidden sm:inline">Inventory</span>
            </TabsTrigger>
            <TabsTrigger value="planner" className="gap-1.5 text-xs sm:text-sm">
              <CalendarDays className="h-4 w-4" /> <span className="hidden sm:inline">Meal Plan</span>
            </TabsTrigger>
            <TabsTrigger value="grocery" className="gap-1.5 text-xs sm:text-sm">
              <ShoppingCart className="h-4 w-4" /> <span className="hidden sm:inline">Grocery</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-1.5 text-xs sm:text-sm">
              <Settings className="h-4 w-4" /> <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recipes">
            <RecipeManager />
          </TabsContent>
          <TabsContent value="ai">
            <AIRecipeGenerator />
          </TabsContent>
          <TabsContent value="inventory">
            <InventoryManager />
          </TabsContent>
          <TabsContent value="planner">
            <MealPlanner />
          </TabsContent>
          <TabsContent value="grocery">
            <GroceryList />
          </TabsContent>
          <TabsContent value="account">
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <Settings className="h-12 w-12 mb-4 opacity-40" />
              <h3 className="text-lg font-semibold text-foreground">Account Settings</h3>
              <p>Coming soon — Diet restrictions, payments, and calendar sync.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
