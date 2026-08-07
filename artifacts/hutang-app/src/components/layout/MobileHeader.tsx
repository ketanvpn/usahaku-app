import { BookOpen, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface MobileHeaderProps {
  children: React.ReactNode;
}

export function MobileHeader({ children }: MobileHeaderProps) {
  return (
    <header className="md:hidden flex items-center justify-between p-4 border-b bg-white/85 backdrop-blur-xl no-print h-16 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-primary">Usahaku</h1>
          <p className="text-[10px] text-muted-foreground leading-tight">by KetanTech</p>
        </div>
      </div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="rounded-xl bg-white/70">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[280px] p-0 bg-sidebar text-sidebar-foreground border-sidebar-border"
        >
          <div className="relative overflow-hidden border-b border-white/10 p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(110,231,183,0.22),transparent_55%)]" />
            <div className="relative flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/15">
                <BookOpen className="h-5 w-5 text-emerald-200" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-white">Usahaku</h1>
                <p className="text-[10px] text-sidebar-foreground/55">by KetanTech</p>
              </div>
            </div>
          </div>
          <div className="px-3 py-2 overflow-y-auto max-h-[calc(100vh-80px)]">{children}</div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
