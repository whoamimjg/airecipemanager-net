import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChefHat, Mail, Trash2, ShieldCheck, AlertCircle } from "lucide-react";

const DeleteAccount = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-horizontal.svg" alt="AI Recipe Manager" className="h-8 w-auto" />
          </Link>
          <Link to="/auth">
            <Button variant="outline" size="sm">Sign In</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-10 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold font-serif text-foreground">
            Delete Your AI Recipe Manager Account
          </h1>
          <p className="text-muted-foreground">
            We're sorry to see you go. You can delete your account and all associated data using either method below.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Trash2 className="h-5 w-5 text-primary" />
              Option 1: Delete in the App (Recommended)
            </CardTitle>
            <CardDescription>Fastest way — your account is removed immediately.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-foreground">
              <li>Sign in to your account on the web or mobile app.</li>
              <li>Open <strong>Account</strong> from the top navigation.</li>
              <li>Scroll to the bottom of the <strong>Settings</strong> tab.</li>
              <li>Tap <strong>Delete Account</strong> and confirm.</li>
            </ol>
            <div className="pt-2">
              <Link to="/auth">
                <Button>Sign In to Delete</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Mail className="h-5 w-5 text-primary" />
              Option 2: Email Support
            </CardTitle>
            <CardDescription>If you can't access your account, contact us by email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Email{" "}
              <a
                href="mailto:support@airecipemanager.com?subject=Account%20Deletion%20Request"
                className="text-primary font-medium underline"
              >
                support@airecipemanager.com
              </a>{" "}
              from the address associated with your account and request deletion.
            </p>
            <p className="text-muted-foreground">
              Requests are processed within <strong>30 days</strong>. We may ask you to verify your identity before
              deleting the account.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <AlertCircle className="h-5 w-5 text-destructive" />
              What Gets Deleted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-foreground">
              <li>Account information (email, name, profile, avatar)</li>
              <li>All saved and AI-generated recipes</li>
              <li>Meal plans and calendar entries</li>
              <li>Kitchen inventory items and storage data</li>
              <li>Grocery lists</li>
              <li>Uploaded photos (avatars, recipe images, receipts)</li>
              <li>Diet preferences and meal time settings</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              What May Be Retained
            </CardTitle>
            <CardDescription>
              As described in <Link to="/privacy" className="text-primary underline">Privacy Policy section 8</Link> (Data Retention).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-foreground">
              <li>Tax and payment records required by law (typically 7 years)</li>
              <li>Anonymized analytics data that cannot be linked back to you</li>
              <li>Records needed to resolve disputes or enforce our agreements</li>
            </ul>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground pt-4">
          Questions? Contact{" "}
          <a href="mailto:support@airecipemanager.com" className="text-primary underline">
            support@airecipemanager.com
          </a>
        </div>
      </main>
    </div>
  );
};

export default DeleteAccount;
