import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { PostHogProvider } from "posthog-js/react";
import { posthog, initPostHog } from "@/lib/posthog";
import CRTOverlay from "@/components/CRTOverlay";
import Index from "./pages/Index";
import Home from "./pages/Home";
import LevelEditor from "./pages/LevelEditor";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import ResetPassword from "./pages/ResetPassword";
import PublicProfile from "./pages/PublicProfile";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";

// Initialize PostHog
initPostHog();

const queryClient = new QueryClient();

const PostHogPageviewTracker = () => {
  const location = useLocation();
  useEffect(() => {
    posthog.capture("$pageview", {
      $current_url: window.location.href,
    });
  }, [location.pathname, location.search]);
  return null;
};

const App = () => (
  <PostHogProvider client={posthog}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PostHogPageviewTracker />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/play" element={<Index />} />
            <Route path="/level-editor" element={<LevelEditor />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/player/:username" element={<PublicProfile />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </PostHogProvider>
);

export default App;
