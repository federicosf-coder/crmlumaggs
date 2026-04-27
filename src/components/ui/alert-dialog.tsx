const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-wrap gap-2 justify-start", className)} {...props} />
);
AlertDialogFooter.displayName = "AlertDialogFooter";
