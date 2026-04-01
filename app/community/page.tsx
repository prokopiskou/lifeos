import { redirect } from "next/navigation";

import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/server";
import CommunityFeedClient from "./CommunityFeedClient";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/community");
  }

  return (
    <>
      <CommunityFeedClient />
      <LogoutButton />
      <BottomNav />
    </>
  );
}

