import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Users, Wallet, Landmark, ShieldCheck } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";
import { Skeleton } from './ui/skeleton';

// ✅ Menus atualizados com vocabulário de FinTech
const menuItems = [
  { icon: LayoutDashboard, label: "Painel Geral", path: "/" },
  { icon: Users, label: "Participantes", path: "/participantes" }, // Exemplo de rota futura
  { icon: Wallet, label: "Transações", path: "/transacoes" },    // Exemplo de rota futura
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { isLoading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (isLoading) {
    return <DashboardLayoutSkeleton />;
  }

  // ✅ Tela de Login Premium (FinTech Style)
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="flex flex-col items-center p-10 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 max-w-md w-full transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
            <Landmark className="w-10 h-10 text-primary" />
          </div>
          
          <div className="flex flex-col items-center gap-3 w-full mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-center">
              Acesse sua Caixinha
            </h1>
            <p className="text-sm text-slate-500 text-center max-w-[280px] leading-relaxed">
              Gestão financeira comunitária segura e transparente. Faça login para continuar.
            </p>
          </div>

          <div className="w-full space-y-4">
            <Button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              size="lg"
              className="w-full rounded-xl h-12 text-base font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              Entrar com Segurança
            </Button>
            <p className="text-xs text-center text-slate-400 font-medium uppercase tracking-wider">
              Acesso restrito a membros
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user } = useAuth();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => window.location.reload(),
  });
  const logout = () => logoutMutation.mutate();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location) || menuItems[0];
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-slate-200/60 bg-slate-50/50"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-20 justify-center border-b border-slate-200/50">
            <div className="flex items-center gap-3 px-3 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center hover:bg-slate-200 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-5 w-5 text-slate-600" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm shrink-0">
                    <Landmark className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold tracking-tight text-lg truncate text-slate-900">
                    Caixinha
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-2 pt-4">
            <SidebarMenu className="px-3 py-1 space-y-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-11 transition-all font-medium rounded-xl ${
                        isActive 
                          ? "bg-primary/10 text-primary hover:bg-primary/15" 
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                      }`}
                    >
                      <item.icon
                        className={`h-5 w-5 ${isActive ? "text-primary" : "text-slate-500"}`}
                      />
                      <span className={isActive ? "font-semibold" : ""}>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-slate-200/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-200/70 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Avatar className="h-10 w-10 border border-slate-200 shadow-sm shrink-0">
                    <AvatarFallback className="text-sm font-bold bg-primary/5 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-bold text-slate-900 truncate leading-none">
                      {user?.name || "Usuário"}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-1.5 font-medium">
                      {user?.role || "Admin"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg border-slate-100">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 rounded-lg m-1 font-medium"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair da conta</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        
        {/* Resize Handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-slate-50/30">
        {isMobile && (
          <div className="flex border-b border-slate-200/60 h-16 items-center justify-between bg-white/80 px-4 backdrop-blur-md sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700" />
              <div className="flex flex-col gap-0.5">
                <span className="font-bold tracking-tight text-slate-900 text-lg">
                  {activeMenuItem?.label ?? "Menu"}
                </span>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar skeleton - Soft Premium Style */}
      <div className="w-[280px] border-r border-slate-200 bg-white p-4 flex flex-col">
        {/* Logo area */}
        <div className="flex items-center gap-3 px-3 h-16 border-b border-slate-100 mb-4">
          <Skeleton className="h-9 w-9 rounded-xl bg-slate-200" />
          <Skeleton className="h-5 w-28 bg-slate-200 rounded-lg" />
        </div>

        {/* Menu items */}
        <div className="space-y-3 px-3 flex-1">
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
      <div className="flex-1 p-8 space-y-8 max-w-7xl mx-auto w-full">
        {/* Title block */}
        <Skeleton className="h-10 w-64 rounded-xl bg-slate-200" />
        
        {/* Cards row */}
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