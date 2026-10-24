"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

const WEBGL_ERROR = /webgl/i;

export default function ErrorPage({ error, retry }: ErrorProps) {
  const graphics = WEBGL_ERROR.test(error.message);
  return (
    <main className="grid h-dvh place-items-center bg-zinc-100 p-6 text-center dark:bg-zinc-950">
      <div className="flex max-w-md flex-col items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          The 3D facility could not be shown
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {error.message || "An unexpected error stopped the scene."}
          {graphics &&
            " This view needs WebGL; check that hardware acceleration is on."}
        </p>
        <button
          type="button"
          onClick={retry}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
