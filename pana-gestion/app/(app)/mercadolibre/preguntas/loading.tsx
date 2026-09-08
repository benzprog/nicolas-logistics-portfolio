import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-9 w-80 max-w-full rounded-lg" />
      <div className="border-border space-y-3 rounded-lg border p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
