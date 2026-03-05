export default function ErrorState({
  title = "Something went wrong",
  message,
}: {
  title?: string
  message?: string
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-8 dark:border-red-900 dark:bg-red-950/30">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
          <svg
            className="h-6 w-6 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h2 className="mt-4 text-base font-semibold text-red-800 dark:text-red-300">
          {title}
        </h2>
        {message != null && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
