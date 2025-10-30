import dynamic from "next/dynamic";

const VideoQueue = dynamic(() => import("../components/VideoQueue"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100">
      <VideoQueue />
    </main>
  );
}
