import { Skeleton } from './ui/skeleton';

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar skeleton - Soft Premium Style */}
      <div className="w-[280px] border-r border-slate-200 bg-white p-4 hidden md:flex flex-col">
        {/* Logo area */}
        <div className="flex items-center gap-3 px-3 h-16 border-b border-slate-100 mb-4">
          <Skeleton className="h-9 w-9 rounded-xl bg-slate-200" />
          <Skeleton className="h-5 w-28 bg-slate-200 rounded-lg" />
        </div>

        {/* Menu items */}
        <div className="space-y-3 px-3 flex-1 mt-2">
          <Skeleton className="h-11 w-full rounded-xl bg-slate-200" />
          <Skeleton className="h-11 w-full rounded-xl bg-slate-100" />
          <Skeleton className="h-11 w-full rounded-xl bg-slate-100" />
        </div>

        {/* User profile area at bottom */}
        <div className="mt-auto border-t border-slate-100 pt-4 px-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl bg-slate-200" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24 bg-slate-200 rounded-md" />
              <Skeleton className="h-3 w-32 bg-slate-100 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
        {/* Title block */}
        <Skeleton className="h-10 w-64 rounded-xl bg-slate-200" />
        
        {/* Cards row - 4 blocos para bater certo com o Balancete */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-36 rounded-2xl bg-white border border-slate-100 shadow-sm" />
          <Skeleton className="h-36 rounded-2xl bg-white border border-slate-100 shadow-sm" />
          <Skeleton className="h-36 rounded-2xl bg-white border border-slate-100 shadow-sm" />
          <Skeleton className="h-36 rounded-2xl bg-white border border-slate-100 shadow-sm" />
        </div>
        
        {/* Big table/chart area */}
        <Skeleton className="h-[400px] rounded-2xl bg-white border border-slate-100 shadow-sm" />
      </div>
    </div>
  );
}