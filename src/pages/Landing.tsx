import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChefHat, BookOpen, Brain, Package, CalendarDays, ShoppingCart,
  Check, ArrowRight, Sparkles, Star
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Recipe Manager",
    description: "Clip recipes from any website or add them manually. Build your personal cookbook.",
  },
  {
    icon: Brain,
    title: "AI Recipe Generator",
    description: "Generate recipes from your inventory and existing collection. Smart suggestions included.",
  },
  {
    icon: Package,
    title: "Kitchen Inventory",
    description: "Track everything in your fridge, pantry, and freezer. Get expiration alerts.",
  },
  {
    icon: CalendarDays,
    title: "Meal Planner",
    description: "Drag & drop recipes into a weekly calendar. Plan breakfast, lunch, dinner & snacks.",
  },
  {
    icon: ShoppingCart,
    title: "Smart Grocery Lists",
    description: "Auto-generated from meal plans. Compare prices across major grocery stores.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    recipes: "25",
    highlight: false,
    features: ["25 recipes", "Manual recipe entry", "Basic inventory", "Grocery list"],
  },
  {
    name: "Home Cook",
    price: "$10",
    period: "/month",
    recipes: "75",
    highlight: false,
    features: ["75 recipes", "URL recipe clipping", "Full inventory tracking", "Meal planner", "Expiration alerts"],
  },
  {
    name: "Chef Pro",
    price: "$25",
    period: "/month",
    recipes: "250",
    highlight: true,
    features: ["250 recipes", "AI recipe generation", "Smart grocery lists", "Price comparison", "Calendar sync", "Priority support"],
  },
  {
    name: "Unlimited",
    price: "$35",
    period: "/month",
    recipes: "Unlimited",
    highlight: false,
    features: ["Unlimited recipes", "Everything in Chef Pro", "Advanced AI suggestions", "Multiple household members", "API access"],
  },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <ChefHat className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold font-serif text-foreground">AI Recipe Manager</span>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Get Started <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative mx-auto px-4 text-center">
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
            <Sparkles className="mr-1 h-3 w-3" /> AI-Powered Kitchen Management
          </Badge>
          <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight md:text-6xl lg:text-7xl text-foreground">
            Your Smart
            <span className="text-primary"> Kitchen Companion</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Manage recipes, track inventory, plan meals, and generate grocery lists — all powered by AI.
            From your pantry to your plate, simplified.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8 py-6">
                Start Free — No Card Required
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="text-base px-8 py-6">
                See How It Works
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold md:text-5xl text-foreground">Everything Your Kitchen Needs</h2>
            <p className="mt-4 text-muted-foreground text-lg">Five powerful tools, one intelligent platform.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="group border-border bg-card hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                <CardHeader>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl text-card-foreground">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-28 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold md:text-5xl text-foreground">Simple, Honest Pricing</h2>
            <p className="mt-4 text-muted-foreground text-lg">Start free. Upgrade when you're ready.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative flex flex-col border-border bg-card ${
                  plan.highlight
                    ? "ring-2 ring-primary shadow-xl scale-[1.02]"
                    : "hover:shadow-lg"
                } transition-all`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      <Star className="mr-1 h-3 w-3" /> Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-lg text-card-foreground">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.recipes} recipes</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <ul className="flex-1 space-y-3 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth?mode=signup" className="w-full">
                    <Button
                      className={`w-full ${
                        plan.highlight
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {plan.price === "Free" ? "Get Started" : "Choose Plan"}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <ChefHat className="h-6 w-6 text-primary" />
            <span className="font-bold font-serif text-foreground">AI Recipe Manager</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} airecipemanager.com — All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
