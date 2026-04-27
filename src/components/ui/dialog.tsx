// only change footer alignment
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-wrap gap-2 justify-start", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";
