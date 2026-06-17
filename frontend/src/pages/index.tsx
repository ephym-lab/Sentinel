import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/monitor");
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#07080a] text-slate-400 text-sm">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-rose-500 animate-spin" />
        Redirecting to dashboard...
      </div>
    </div>
  );
}
