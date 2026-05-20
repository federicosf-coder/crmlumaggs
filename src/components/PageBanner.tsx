interface PageBannerProps {
  title: string;
  description?: string;
  avatar?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageBanner({ title, description, avatar, children }: PageBannerProps) {
  return (
    <div className="mb-6 rounded-xl border bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          {avatar}
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground text-xs mt-1 font-light">{description}</p>
            )}
          </div>
        </div>
        {children && <div className="shrink-0 self-start">{children}</div>}
      </div>
    </div>
  );
}
