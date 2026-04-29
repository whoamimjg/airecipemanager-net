import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChefHat, BookOpen, Brain, Package, CalendarDays, ShoppingCart,
  Check, ArrowRight, Sparkles, Star, Utensils, Timer, Bell, BarChart3
} from "lucide-react";
import heroImg from "@/assets/hero-kitchen.jpg";
import plannerImg from "@/assets/feature-planner.jpg";
import groceryImg from "@/assets/feature-grocery.jpg";
import inventoryImg from "@/assets/feature-inventory.jpg";

const stats = [
  { value: "10K+", label: "Recipes Managed" },
  { value: "500+", label: "Happy Cooks" },
  { value: "30%", label: "Less Food Waste" },
  { value: "4.9★", label: "User Rating" },
];

const features = [
  {
    icon: BookOpen,
    title: "Recipe Manager",
    description: "Clip recipes from any website with a URL or add them manually. Build your personal digital cookbook that goes everywhere with you.",
  },
  {
    icon: Brain,
    title: "AI Recipe Generator",
    description: "Our AI reads your inventory and recipe collection to generate fresh meal ideas tailored to what you already have on hand.",
  },
  {
    icon: Package,
    title: "Kitchen Inventory",
    description: "Track everything in your fridge, pantry, and freezer with categories, barcodes, quantities, and expiration date alerts.",
  },
  {
    icon: CalendarDays,
    title: "Meal Planner",
    description: "Drag & drop recipes into a beautiful weekly calendar. Plan breakfast, lunch, dinner & snacks with ease.",
  },
  {
    icon: ShoppingCart,
    title: "Smart Grocery Lists",
    description: "Auto-generated from your meal plans. Compare prices across Kroger, Meijer, Walmart & Giant Eagle.",
  },
  {
    icon: Bell,
    title: "Expiration Alerts",
    description: "Never let food go to waste again. Get notified before items expire so you can use them in time.",
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
    period: "/mo",
    recipes: "75",
    highlight: false,
    features: ["75 recipes", "URL recipe clipping", "Full inventory tracking", "Meal planner", "Expiration alerts"],
  },
  {
    name: "Chef Pro",
    price: "$25",
    period: "/mo",
    recipes: "250",
    highlight: true,
    features: ["250 recipes", "AI recipe generation", "Smart grocery lists", "Price comparison", "Calendar sync", "Priority support"],
  },
  {
    name: "Unlimited",
    price: "$35",
    period: "/mo",
    recipes: "∞",
    highlight: false,
    features: ["Unlimited recipes", "Everything in Chef Pro", "Advanced AI suggestions", "Household members", "API access"],
  },
];

const howItWorks = [
  { step: "1", icon: Utensils, title: "Add Your Recipes", desc: "Import from any URL or type them in manually." },
  { step: "2", icon: Package, title: "Stock Your Pantry", desc: "Log what's in your kitchen with quantities and expiration dates." },
  { step: "3", icon: CalendarDays, title: "Plan Your Week", desc: "Drag recipes onto the calendar for each meal." },
  { step: "4", icon: ShoppingCart, title: "Shop Smarter", desc: "Get an auto-generated grocery list with price comparisons." },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/20 bg-brand-slate text-white">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="AI Recipe Manager" className="h-8 w-8 rounded" />
            <span className="text-xl font-bold tracking-tight">AI Recipe Manager</span>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-white/80 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-white/80 hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="text-sm text-white/80 hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">Log in</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm" className="bg-cta text-cta-foreground hover:bg-cta/90 rounded-lg font-medium">
                Get Started <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-slate text-white">
        <div className="absolute inset-0 opacity-20">
          <img src={heroImg} alt="" width={1920} height={1080} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-brand-slate/60" />
        </div>
        <div className="container relative mx-auto px-4 py-24 md:py-36 lg:py-44">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/20 px-4 py-1.5 text-sm font-medium text-accent backdrop-blur-sm border border-accent/30">
              <Sparkles className="h-4 w-4" /> Your kitchen. Simplified.
            </div>
            <h1 className="text-4xl font-bold leading-[1.1] md:text-5xl lg:text-6xl text-white">
              Your kitchen.
              <span className="block text-accent">Simplified.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/85 leading-relaxed">
              AI Recipe Manager helps you plan meals, discover new ideas, and cook with what you already have — powered by AI that knows your kitchen.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/auth?mode=signup">
                <Button size="lg" className="bg-cta text-cta-foreground hover:bg-cta/90 text-base px-8 h-12 rounded-lg font-medium shadow-lg">
                  Start cooking smarter <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline" className="text-base px-8 h-12 rounded-lg font-medium bg-transparent border-2 border-white/80 text-white hover:bg-white hover:text-brand-slate">
                  See how it works
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Stats */}
      <section className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-primary md:text-4xl">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1 text-sm font-medium text-accent">
              <BarChart3 className="h-3.5 w-3.5" /> Powerful Features
            </div>
            <h2 className="text-3xl font-bold md:text-5xl text-foreground">Everything Your Kitchen Needs</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground text-lg">
              Six powerful tools working together in one intelligent platform.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="group border-border bg-card hover:shadow-xl hover:border-primary/20 hover:-translate-y-1 transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary group-hover:from-primary group-hover:to-primary/80 group-hover:text-primary-foreground transition-all duration-300 shadow-sm">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg text-card-foreground">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase Sections with Images */}
      <section className="bg-secondary/20">
        {/* Meal Planner Showcase */}
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <CalendarDays className="h-3 w-3" /> Meal Planning
              </div>
              <h2 className="text-3xl font-bold md:text-4xl text-foreground">Plan Every Meal, Effortlessly</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Drag and drop your favorite recipes onto a weekly calendar. Plan breakfast, lunch, dinner, and snacks for the whole family. Items already in your inventory get a star so you know what you've got covered.
              </p>
              <ul className="mt-6 space-y-3">
                {["Week, month & day views", "Drag & drop from your recipes", "Inventory items marked with ★", "Sync with Google & Apple Calendar"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-primary" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="overflow-hidden rounded-2xl shadow-2xl shadow-primary/10 border border-border">
                <img src={plannerImg} alt="Meal planner calendar interface" width={800} height={600} loading="lazy" className="w-full" />
              </div>
              <div className="absolute -bottom-4 -left-4 h-24 w-24 rounded-2xl bg-primary/10 -z-10" />
              <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full bg-accent/10 -z-10" />
            </div>
          </div>
        </div>

        {/* Inventory Showcase */}
        <div className="container mx-auto px-4 pb-20 md:pb-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="order-2 lg:order-1 relative">
              <div className="overflow-hidden rounded-2xl shadow-2xl shadow-primary/10 border border-border">
                <img src={inventoryImg} alt="Organized kitchen pantry" width={800} height={600} loading="lazy" className="w-full" />
              </div>
              <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-2xl bg-accent/10 -z-10" />
            </div>
            <div className="order-1 lg:order-2">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                <Package className="h-3 w-3" /> Kitchen Inventory
              </div>
              <h2 className="text-3xl font-bold md:text-4xl text-foreground">Know What's in Your Kitchen</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Track every item by category, storage location, barcode, quantity, and price. Get notifications before things expire so nothing goes to waste.
              </p>
              <ul className="mt-6 space-y-3">
                {["Fridge, pantry, freezer & cabinet tracking", "Barcode scanning support", "Expiration date alerts", "Price per unit tracking"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-primary" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Grocery Showcase */}
        <div className="container mx-auto px-4 pb-20 md:pb-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <ShoppingCart className="h-3 w-3" /> Smart Grocery
              </div>
              <h2 className="text-3xl font-bold md:text-4xl text-foreground">Shop Smarter, Save More</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Your grocery list builds itself from your meal plan. Items you already have in inventory are excluded. Compare prices across Kroger, Meijer, Walmart, and Giant Eagle.
              </p>
              <ul className="mt-6 space-y-3">
                {["Auto-generated from meal plans", "Excludes items already in inventory", "Price comparison across stores", "Add items manually anytime"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-primary" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="overflow-hidden rounded-2xl shadow-2xl shadow-primary/10 border border-border">
                <img src={groceryImg} alt="Smart grocery list on phone" width={800} height={600} loading="lazy" className="w-full" />
              </div>
              <div className="absolute -top-4 -left-4 h-16 w-16 rounded-full bg-primary/10 -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
              <Timer className="h-3.5 w-3.5" /> Get Started in Minutes
            </div>
            <h2 className="text-3xl font-bold md:text-5xl text-foreground">How It Works</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground text-lg">
              Four simple steps to a smarter kitchen.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((item, i) => (
              <div key={item.title} className="relative text-center">
                {i < howItWorks.length - 1 && (
                  <div className="absolute top-8 left-[60%] hidden h-[2px] w-[80%] bg-gradient-to-r from-primary/30 to-transparent lg:block" />
                )}
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-bold shadow-lg shadow-primary/25">
                  {item.step}
                </div>
                <item.icon className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-28 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Pricing
            </div>
            <h2 className="text-3xl font-bold md:text-5xl text-foreground">Simple, Honest Pricing</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground text-lg">
              Start free. Upgrade when you're ready. No hidden fees.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative flex flex-col border-border bg-card ${
                  plan.highlight
                    ? "ring-2 ring-primary shadow-2xl shadow-primary/10 scale-[1.03]"
                    : "hover:shadow-lg hover:-translate-y-1"
                } transition-all duration-300`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-lg">
                      <Star className="h-3 w-3" /> Most Popular
                    </span>
                  </div>
                )}
                <CardHeader className="text-center pb-2 pt-8">
                  <CardTitle className="text-base font-semibold text-card-foreground">{plan.name}</CardTitle>
                  <div className="mt-3">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.recipes} recipes</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col pt-4">
                  <ul className="flex-1 space-y-2.5 mb-6">
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
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {plan.price === "Free" ? "Get Started Free" : "Choose Plan"}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl rounded-2xl bg-brand-navy p-12 text-center shadow-2xl md:p-16">
            <img src="/logo.png" alt="" className="mx-auto mb-6 h-14 w-14 rounded" />
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Ready to transform your kitchen?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-white/80 text-lg">
              Join thousands of home cooks who save time, reduce waste, and eat better with AI Recipe Manager.
            </p>
            <Link to="/auth?mode=signup">
              <Button size="lg" className="mt-8 bg-cta text-cta-foreground hover:bg-cta/90 text-base px-10 h-12 rounded-lg font-medium shadow-lg">
                Start cooking smarter <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-navy text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="AI Recipe Manager" className="h-7 w-7 rounded" />
              <span className="font-bold text-white">AI Recipe Manager</span>
            </div>
            <div className="flex gap-6 text-sm text-white/70">
              <a href="#features" className="hover:text-accent transition-colors">Features</a>
              <a href="#pricing" className="hover:text-accent transition-colors">Pricing</a>
              <Link to="/auth" className="hover:text-accent transition-colors">Sign In</Link>
            </div>
            <p className="text-sm text-white/60">
              © {new Date().getFullYear()} airecipemanager.com
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
