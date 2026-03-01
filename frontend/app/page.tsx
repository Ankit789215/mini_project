import { redirect } from "next/navigation";

export default function Home() {
  // We use simple redirects in frontend/context/AuthContext, but pushing them
  // straight to /auth immediately on root load is good practice here.
  redirect("/auth");
}
